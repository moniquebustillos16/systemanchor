<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductTransaction;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductTransactionController extends Controller
{
    /**
     * Display all product transactions.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ProductTransaction::with('product:id,sku,name')->latest();
        $allowed = $this->allowedWarehouseIds($request->user());
        if (is_array($allowed)) {
            $query->whereHas('product', fn ($products) => $this->scopeProducts($products, $allowed));
        }
        $transactions = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
        $this->assertProductAllowed(
            isset($validated['product_id']) ? Product::find($validated['product_id']) : null,
            $this->allowedWarehouseIds($request->user())
        );
    }

    /**
     * Store a new product transaction.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => [
                'nullable',
                'uuid',
                'exists:products,id',
            ],

            'product_name' => [
                'required',
                'string',
                'max:255',
            ],

            'transaction_type' => [
                'required',
                Rule::in([
                    'purchase',
                    'sale',
                    'receiving',
                    'shipment',
                    'return',
                ]),
            ],

            'reference_id' => [
                'nullable',
                'uuid',
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'partner_id' => [
                'nullable',
                'uuid',
            ],

            'partner_type' => [
                'required',
                Rule::in([
                    'supplier',
                    'customer',
                ]),
            ],

            'quantity' => [
                'required',
                'numeric',
                'min:0',
            ],

            'unit_price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'status' => [
                'nullable',
                Rule::in([
                    'pending',
                    'processing',
                    'completed',
                    'cancelled',
                    'shipped',
                    'received',
                    'returned',
                ]),
            ],
        ]);

        /*
        |--------------------------------------------------------------------------
        | Validate Partner Type
        |--------------------------------------------------------------------------
        */

        if (! empty($validated['partner_id'])) {

            if ($validated['partner_type'] === 'supplier') {

                $exists = Supplier::where(
                    'id',
                    $validated['partner_id']
                )->exists();

                if (! $exists) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Supplier not found.',
                    ], 422);
                }
            }

            if ($validated['partner_type'] === 'customer') {

                $exists = Customer::where(
                    'id',
                    $validated['partner_id']
                )->exists();

                if (! $exists) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Customer not found.',
                    ], 422);
                }
            }
        }

        $transaction = ProductTransaction::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Product transaction created successfully.',
            'data' => $transaction->load('product'),
        ], 201);
    }

    /**
     * Display a specific product transaction.
     */
    public function show(Request $request, ProductTransaction $productTransaction): JsonResponse
    {
        $this->assertProductAllowed(
            $productTransaction->product,
            $this->allowedWarehouseIds($request->user())
        );

        return response()->json([
            'success' => true,
            'data' => $productTransaction->load('product:id,sku,name'),
        ]);
    }

    /**
     * Update a product transaction.
     */
    public function update(
        Request $request,
        ProductTransaction $productTransaction
    ): JsonResponse {
        $this->assertProductAllowed(
            $productTransaction->product,
            $this->allowedWarehouseIds($request->user())
        );
        $validated = $request->validate([
            'product_id' => [
                'sometimes',
                'nullable',
                'uuid',
                'exists:products,id',
            ],

            'product_name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'transaction_type' => [
                'sometimes',
                Rule::in([
                    'purchase',
                    'sale',
                    'receiving',
                    'shipment',
                    'return',
                ]),
            ],

            'reference_id' => [
                'sometimes',
                'nullable',
                'uuid',
            ],

            'reference_number' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
            ],

            'partner_id' => [
                'sometimes',
                'nullable',
                'uuid',
            ],

            'partner_type' => [
                'sometimes',
                Rule::in([
                    'supplier',
                    'customer',
                ]),
            ],

            'quantity' => [
                'sometimes',
                'numeric',
                'min:0',
            ],

            'unit_price' => [
                'sometimes',
                'numeric',
                'min:0',
            ],

            'status' => [
                'sometimes',
                Rule::in([
                    'pending',
                    'processing',
                    'completed',
                    'cancelled',
                    'shipped',
                    'received',
                    'returned',
                ]),
            ],
        ]);

        if (array_key_exists('product_id', $validated)) {
            $this->assertProductAllowed(
                $validated['product_id'] ? Product::find($validated['product_id']) : null,
                $this->allowedWarehouseIds($request->user())
            );
        }

        $productTransaction->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Product transaction updated successfully.',
            'data' => $productTransaction->fresh()->load('product:id,sku,name'),
        ]);
    }

    /**
     * Delete a product transaction.
     */
    public function destroy(
        Request $request,
        ProductTransaction $productTransaction
    ): JsonResponse {
        $this->assertProductAllowed(
            $productTransaction->product,
            $this->allowedWarehouseIds($request->user())
        );
        $productTransaction->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product transaction deleted successfully.',
        ]);
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

    private function scopeProducts($query, array $warehouseIds): void
    {
        $query->where(function ($products) use ($warehouseIds) {
            $products->whereIn('warehouse_id', $warehouseIds)
                ->orWhereHas('inventoryBalances', fn ($balances) => $balances
                    ->whereIn('warehouse_id', $warehouseIds));
        });
    }

    private function assertProductAllowed(?Product $product, ?array $warehouseIds): void
    {
        if ($warehouseIds === null) {
            return;
        }
        if (! $product) {
            abort(404, 'Product not found.');
        }
        if (($product->warehouse_id && in_array((string) $product->warehouse_id, $warehouseIds, true))
            || ($warehouseIds !== [] && $product->inventoryBalances()
                ->whereIn('warehouse_id', $warehouseIds)
                ->exists())) {
            return;
        }

        abort(404, 'Product not found.');
    }
}
