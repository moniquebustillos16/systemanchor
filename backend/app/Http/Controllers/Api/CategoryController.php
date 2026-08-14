<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * Display a listing of categories.
     */
    public function index(Request $request)
    {
        $query = Category::query();

        if (Schema::hasColumn('categories', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        if ($search = $request->query('search')) {
            $query->where('name', 'ilike', "%{$search}%");
        }

        $categories = $query
            ->orderBy('name')
            ->get(['id', 'name', 'created_at', 'updated_at']);

        // Optional product counts if relation exists
        if (method_exists(Category::class, 'products')) {
            $categories->loadCount('products');
        }

        return response()->json($categories);
    }

    /**
     * Store a newly created category.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')->where(function ($q) {
                    if (Schema::hasColumn('categories', 'deleted_at')) {
                        $q->whereNull('deleted_at');
                    }
                }),
            ],
        ]);

        $category = Category::create([
            'name' => trim($validated['name']),
        ]);

        return response()->json($category, 201);
    }

    /**
     * Display the specified category.
     */
    public function show(string $id)
    {
        $query = Category::query()->where('id', $id);

        if (Schema::hasColumn('categories', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $category = $query->firstOrFail();

        if (method_exists(Category::class, 'products')) {
            $category->loadCount('products');
        }

        return response()->json($category);
    }

    /**
     * Update the specified category.
     */
    public function update(Request $request, string $id)
    {
        $query = Category::query()->where('id', $id);

        if (Schema::hasColumn('categories', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $category = $query->firstOrFail();

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('categories', 'name')
                    ->ignore($category->id)
                    ->where(function ($q) {
                        if (Schema::hasColumn('categories', 'deleted_at')) {
                            $q->whereNull('deleted_at');
                        }
                    }),
            ],
        ]);

        $category->update([
            'name' => trim($validated['name']),
        ]);

        return response()->json($category);
    }

    /**
     * Soft-delete (or hard-delete) the specified category.
     */
    public function destroy(string $id)
    {
        $query = Category::query()->where('id', $id);

        if (Schema::hasColumn('categories', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $category = $query->firstOrFail();

        if (Schema::hasColumn('categories', 'deleted_at') && method_exists($category, 'delete')) {
            // Prefer SoftDeletes if the model uses it
            $category->delete();
        } else {
            $category->forceDelete();
        }

        return response()->json(null, 204);
    }
}