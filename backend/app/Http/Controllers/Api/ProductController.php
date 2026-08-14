<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with(['category', 'warehouse', 'supplier'])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sku', 'ilike', "%{$search}%")
                  ->orWhere('name', 'ilike', "%{$search}%");
            });
        }

        $perPage = min((int) $request->query('per_page', 15), 100);
        return response()->json($query->paginate($perPage));
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

        $product = Product::create($validated);
        $product->load(['category', 'warehouse', 'supplier']);

        return response()->json(['message' => 'Product created', 'data' => $product], 201);
    }

    public function show(string $id)
    {
        $product = Product::with(['category', 'warehouse', 'supplier'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return response()->json($product);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $validated = $request->validate([
            'sku'          => 'sometimes|string|max:100|unique:products,sku,' . $id,
            'name'         => 'sometimes|string|max:255',
            'barcode'      => 'nullable|string|max:100',
            'serial'       => 'nullable|string|max:100',
            'category_id'  => 'nullable|uuid|exists:categories,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'supplier_id'  => 'nullable|uuid|exists:suppliers,id',
            'qty'          => 'sometimes|numeric|min:0',
            'min_stock'    => 'sometimes|numeric|min:0',
            'max_stock'    => 'sometimes|numeric|min:0',
            'price'        => 'sometimes|numeric|min:0',
            'status'       => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        $product->update($validated);
        $product->load(['category', 'warehouse', 'supplier']);

        return response()->json(['message' => 'Product updated', 'data' => $product]);
    }

    public function destroy(string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }
}