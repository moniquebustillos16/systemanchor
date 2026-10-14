<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with(['category', 'warehouse', 'supplier'])
            ->whereNull('deleted_at');
        $allowedWarehouses = $this->allowedWarehouseIds($request->user());

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'ilike', "%{$search}%")
                    ->orWhere('name', 'ilike', "%{$search}%");
            });
        }

        if (is_array($allowedWarehouses)) {
            $query->where(function ($products) use ($allowedWarehouses) {
                $products->whereIn('warehouse_id', $allowedWarehouses)
                    ->orWhereHas('inventoryBalances', fn ($balances) => $balances
                        ->whereIn('warehouse_id', $allowedWarehouses));
            });
            $query->with(['inventoryBalances' => fn ($balances) => $balances
                ->whereIn('warehouse_id', $allowedWarehouses)]);
        } else {
            $query->with('inventoryBalances');
        }

        $perPage = min((int) $request->query('per_page', 15), 100);
        $products = $query->paginate($perPage);
        if (is_array($allowedWarehouses)) {
            $products->getCollection()->transform(fn (Product $product) => $this->scopeProductQuantity($product));
        }

        return response()->json($products);
    }

    public function store(Request $request, InventoryService $inventoryService)
    {
        $validated = $request->validate([
            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->whereNull('deleted_at'),
            ],
            'name' => 'required|string|max:255',
            'barcode' => 'nullable|string|max:100',
            'serial' => 'nullable|string|max:100',
            'category_id' => 'nullable|uuid|exists:categories,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'supplier_id' => 'nullable|uuid|exists:suppliers,id',
            'qty' => 'nullable|numeric|min:0',
            'min_stock' => 'nullable|numeric|min:0',
            'max_stock' => 'nullable|numeric|min:0',
            'price' => 'nullable|numeric|min:0',
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        if (! empty($validated['warehouse_id'])) {
            $this->assertWarehouseAllowed($request, $validated['warehouse_id']);
        }

        $initialQty = round((float) ($validated['qty'] ?? 0), 4);
        if ($initialQty > 0 && empty($validated['warehouse_id'])) {
            return response()->json([
                'message' => 'A warehouse is required when creating opening stock.',
            ], 422);
        }

        $product = DB::transaction(function () use ($validated, $initialQty, $inventoryService, $request) {
            $productData = $validated;
            $productData['qty'] = 0;
            $product = Product::create($productData);

            if ($initialQty > 0) {
                $inventoryService->post([
                    'type' => 'ADJUSTMENT',
                    'product_id' => $product->id,
                    'qty' => $initialQty,
                    'warehouse_id' => $validated['warehouse_id'],
                    'from_warehouse_id' => $validated['warehouse_id'],
                    'reason' => 'opening-balance',
                    'reference' => 'Opening stock',
                    'idempotency_key' => 'opening-stock:'.$product->id,
                ], $request->user()?->id);
            } elseif (! empty($validated['warehouse_id'])) {
                Inventory::firstOrCreate(
                    ['product_id' => $product->id, 'warehouse_id' => $validated['warehouse_id']],
                    [
                        'qty' => 0,
                        'min_stock' => $product->min_stock,
                        'max_stock' => $product->max_stock,
                        'reserved_qty' => 0,
                        'status' => 'active',
                    ]
                );
            }

            return $product->fresh();
        });
        $product->load(['category', 'warehouse', 'supplier']);

        return response()->json(['message' => 'Product created', 'data' => $product], 201);
    }

    public function show(Request $request, string $id)
    {
        $product = Product::with(['category', 'warehouse', 'supplier'])
            ->whereNull('deleted_at')
            ->findOrFail($id);
        $allowedWarehouses = $this->allowedWarehouseIds($request->user());
        $this->assertProductAllowed($product, $allowedWarehouses);
        if (is_array($allowedWarehouses)) {
            $product->load(['inventoryBalances' => fn ($balances) => $balances
                ->whereIn('warehouse_id', $allowedWarehouses)]);
            $this->scopeProductQuantity($product);
        }

        return response()->json($product);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);
        $this->assertProductAllowed($product, $this->allowedWarehouseIds($request->user()));

        if ($request->exists('qty')) {
            return response()->json([
                'message' => 'Use a stock movement adjustment to change inventory quantity.',
            ], 422);
        }

        $validated = $request->validate([
            'sku' => [
                'sometimes', 'string', 'max:100',
                Rule::unique('products', 'sku')->ignore($id)->whereNull('deleted_at'),
            ],
            'name' => 'sometimes|string|max:255',
            'barcode' => 'nullable|string|max:100',
            'serial' => 'nullable|string|max:100',
            'category_id' => 'nullable|uuid|exists:categories,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'supplier_id' => 'nullable|uuid|exists:suppliers,id',
            'min_stock' => 'sometimes|numeric|min:0',
            'max_stock' => 'sometimes|numeric|min:0',
            'price' => 'sometimes|numeric|min:0',
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        if (! empty($validated['warehouse_id'])) {
            $this->assertWarehouseAllowed($request, $validated['warehouse_id']);
        }

        $product->update($validated);
        $product->load(['category', 'warehouse', 'supplier']);
        $allowedWarehouses = $this->allowedWarehouseIds($request->user());
        if (is_array($allowedWarehouses)) {
            $product->load(['inventoryBalances' => fn ($balances) => $balances
                ->whereIn('warehouse_id', $allowedWarehouses)]);
            $this->scopeProductQuantity($product);
        }

        return response()->json(['message' => 'Product updated', 'data' => $product]);
    }

    public function destroy(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);
        $this->assertProductAllowed($product, $this->allowedWarehouseIds($request->user()));
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    private function allowedWarehouseIds(?User $user): ?array
    {
        if (! $user) {
            return [];
        }
        if ($user->canAccessAllWarehouses()) {
            return null;
        }

        $ids = $user->warehouses()->pluck('warehouses.id')->map(fn ($id) => (string) $id)->all();
        if ($user->warehouse_id) {
            $ids[] = (string) $user->warehouse_id;
        }

        return array_values(array_unique($ids));
    }

    private function assertWarehouseAllowed(Request $request, string $warehouseId): void
    {
        $allowed = $this->allowedWarehouseIds($request->user());
        if (is_array($allowed) && ! in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    private function assertProductAllowed(Product $product, ?array $allowedWarehouses): void
    {
        if ($allowedWarehouses === null) {
            return;
        }
        if ($product->warehouse_id && in_array((string) $product->warehouse_id, $allowedWarehouses, true)) {
            return;
        }
        if ($allowedWarehouses !== [] && $product->inventoryBalances()
            ->whereIn('warehouse_id', $allowedWarehouses)
            ->exists()) {
            return;
        }

        abort(404, 'Product not found.');
    }

    private function scopeProductQuantity(Product $product): Product
    {
        $product->qty = (string) $product->inventoryBalances
            ->sum(fn ($balance) => (float) $balance->qty);
        $product->unallocated_qty = '0.0000';

        return $product;
    }
}
