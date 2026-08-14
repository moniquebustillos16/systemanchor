<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Supplier::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('contact', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%")
                  ->orWhere('city', 'ilike', "%{$search}%")
                  ->orWhere('product_offers', 'ilike', "%{$search}%");
            });
        }

        $perPage = min((int) $request->get('per_page', 15), 100);
        $suppliers = $query->orderBy('name')->paginate($perPage);

        return response()->json($suppliers);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'contact'         => 'nullable|string|max:150',
            'email'           => 'nullable|email|max:255',
            'phone'           => 'nullable|string|max:50',
            'city'            => 'nullable|string|max:100',
            'product_offers'  => 'nullable|string',
            'score'           => 'nullable|numeric|min:0|max:100',
            'status'          => ['nullable', 'string', 'max:30', Rule::in(['active', 'inactive', 'pending'])],
        ]);

        $validated['score']  = $validated['score']  ?? 80;
        $validated['status'] = $validated['status'] ?? 'active';

        $supplier = Supplier::create($validated);

        return response()->json($supplier, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $supplier = Supplier::findOrFail($id);

        return response()->json($supplier);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'name'            => 'sometimes|required|string|max:255',
            'contact'         => 'nullable|string|max:150',
            'email'           => 'nullable|email|max:255',
            'phone'           => 'nullable|string|max:50',
            'city'            => 'nullable|string|max:100',
            'product_offers'  => 'nullable|string',
            'score'           => 'nullable|numeric|min:0|max:100',
            'status'          => ['nullable', 'string', 'max:30', Rule::in(['active', 'inactive', 'pending'])],
        ]);

        $supplier->update($validated);

        return response()->json($supplier);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete(); // soft delete

        return response()->json(null, 204);
    }
}