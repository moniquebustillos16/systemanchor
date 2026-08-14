<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class ProductTransactionController extends Controller
{
    /**
     * Display all product transactions.
     */
    public function index(): JsonResponse
    {
        $transactions = ProductTransaction::with('product')
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
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

        if (!empty($validated['partner_id'])) {

            if ($validated['partner_type'] === 'supplier') {

                $exists = \App\Models\Supplier::where(
                    'id',
                    $validated['partner_id']
                )->exists();

                if (!$exists) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Supplier not found.',
                    ], 422);
                }
            }

            if ($validated['partner_type'] === 'customer') {

                $exists = \App\Models\Customer::where(
                    'id',
                    $validated['partner_id']
                )->exists();

                if (!$exists) {
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
    public function show(ProductTransaction $productTransaction): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $productTransaction->load('product'),
        ]);
    }

    /**
     * Update a product transaction.
     */
    public function update(
        Request $request,
        ProductTransaction $productTransaction
    ): JsonResponse {
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

        $productTransaction->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Product transaction updated successfully.',
            'data' => $productTransaction->fresh()->load('product'),
        ]);
    }

    /**
     * Delete a product transaction.
     */
    public function destroy(
        ProductTransaction $productTransaction
    ): JsonResponse {
        $productTransaction->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product transaction deleted successfully.',
        ]);
    }
}