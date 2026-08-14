<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with(['category', 'warehouse', 'supplier'])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'ilike', "%{$search}%")
                  ->orWhere('name', 'ilike', "%{$search}%")
                  ->orWhere('barcode', 'ilike', "%{$search}%")
                  ->orWhere('serial', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        if ($status = $request->query('status')) {
            match ($status) {
                'out-of-stock' => $query->where('qty', '<=', 0),
                'low-stock'    => $query->whereColumn('qty', '<', 'min_stock')->where('qty', '>', 0),
                'active'       => $query->whereColumn('qty', '>=', 'min_stock'),
                default        => null,
            };
        }

        $sort = $request->query('sort', 'sku');
        $dir  = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
        if (in_array($sort, ['sku', 'name', 'qty', 'price', 'created_at'], true)) {
            $query->orderBy($sort, $dir);
        }

        $perPage = min((int) $request->query('per_page', 15), 100);
        $page = $query->paginate($perPage);

        $page->getCollection()->transform(function (Product $p) {
            $p->display_status = $this->displayStatus($p);
            $p->stock_value    = (float) $p->qty * (float) $p->price;
            return $p;
        });

        return response()->json($page);
    }

    public function stats()
    {
        $base = Product::whereNull('deleted_at');

        return response()->json([
            'total_products'  => (clone $base)->count(),
            'low_stock'       => (clone $base)->whereColumn('qty', '<', 'min_stock')->where('qty', '>', 0)->count(),
            'out_of_stock'    => (clone $base)->where('qty', '<=', 0)->count(),
            'inventory_value' => (float) (clone $base)->selectRaw('COALESCE(SUM(qty * price), 0) as t')->value('t'),
        ]);
    }

    public function show(string $id)
    {
        $product = Product::with(['category', 'warehouse', 'supplier', 'images'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $product->display_status = $this->displayStatus($product);
        $product->stock_value    = (float) $product->qty * (float) $product->price;

        return response()->json($product);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku'          => 'required|string|max:100|unique:products,sku',
            'name'         => 'required|string|max:255',
            'barcode'      => 'nullable|string|max:100',
            'serial'       => 'nullable|string|max:100',
            'category_id'  => 'nullable|uuid|exists:categories,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'supplier_id'  => 'nullable|uuid|exists:suppliers,id',
            'qty'          => 'nullable|numeric|min:0',
            'min_stock'    => 'nullable|numeric|min:0',
            'max_stock'    => 'nullable|numeric|min:0',
            'price'        => 'nullable|numeric|min:0',
            'status'       => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $product = Product::create([
            'sku'          => $validated['sku'],
            'name'         => $validated['name'],
            'barcode'      => $validated['barcode'] ?? null,
            'serial'       => $validated['serial'] ?? null,
            'category_id'  => $validated['category_id'] ?? null,
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'supplier_id'  => $validated['supplier_id'] ?? null,
            'qty'          => $validated['qty'] ?? 0,
            'min_stock'    => $validated['min_stock'] ?? 0,
            'max_stock'    => $validated['max_stock'] ?? 0,
            'price'        => $validated['price'] ?? 0,
            'status'       => $validated['status'] ?? 'active',
        ]);

        $product->load(['category', 'warehouse', 'supplier']);
        $product->display_status = $this->displayStatus($product);
        $product->stock_value    = (float) $product->qty * (float) $product->price;

        $this->notifyStockLevel($product);

        return response()->json([
            'message' => 'Product created successfully',
            'data'    => $product,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $validated = $request->validate([
            'qty'          => 'sometimes|numeric|min:0',
            'min_stock'    => 'sometimes|numeric|min:0',
            'max_stock'    => 'sometimes|numeric|min:0',
            'price'        => 'sometimes|numeric|min:0',
            'warehouse_id' => 'sometimes|nullable|uuid|exists:warehouses,id',
            'status'       => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        $product->update($validated);
        $product->load(['category', 'warehouse', 'supplier']);

        $product->display_status = $this->displayStatus($product);
        $product->stock_value    = (float) $product->qty * (float) $product->price;

        if (array_key_exists('qty', $validated) || array_key_exists('min_stock', $validated)) {
            $this->notifyStockLevel($product);
        }

        return response()->json([
            'message' => 'Inventory updated successfully',
            'data'    => $product,
        ]);
    }

    public function destroy(string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);
        $product->delete();

        return response()->json([
            'message' => 'Product deleted successfully',
        ]);
    }

    private function displayStatus(Product $p): string
    {
        if ((float) $p->qty <= 0) {
            return 'out-of-stock';
        }
        if ((float) $p->qty < (float) $p->min_stock) {
            return 'low-stock';
        }
        return 'active';
    }

    /** Create notifications for all active users when stock is low or out. */
    private function notifyStockLevel(Product $product): void
    {
        $qty = (float) $product->qty;
        $min = (float) $product->min_stock;

        if ($qty > 0 && $qty >= $min) {
            return;
        }

        $type = $qty <= 0 ? 'danger' : 'warning';
        $title = $qty <= 0 ? 'Out of stock' : 'Low stock alert';
        $message = $qty <= 0
            ? "{$product->sku} {$product->name} has reached zero quantity"
            : "{$product->sku} {$product->name} is below minimum ({$qty} / {$min})";

        User::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->select('id')
            ->chunkById(100, function ($users) use ($type, $title, $message) {
                foreach ($users as $user) {
                    Notification::create([
                        'user_id' => $user->id,
                        'type'    => $type,
                        'title'   => $title,
                        'message' => $message,
                        'page'    => '/products',
                        'is_read' => false,
                    ]);
                }
            });
    }
}