<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Roles;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RolesController extends Controller
{
    /**
     * GET /api/roles
     */
    public function index(Request $request)
    {
        $query = Roles::query()->whereNull('deleted_at');

        // Search
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sort = $request->query('sort', 'name');
        $dir  = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
        $allowedSorts = ['name', 'description', 'created_at'];
        if (!in_array($sort, $allowedSorts)) {
            $sort = 'name';
        }
        $query->orderBy($sort, $dir);

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        if ($request->boolean('paginate', true) && !$request->has('all')) {
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data'         => $paginator->items(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
            ]);
        }

        return response()->json([
            'data' => $query->limit($perPage)->get(),
        ]);
    }

    /**
     * GET /api/roles/{id}
     */
    public function show(string $id)
    {
        $role = Roles::findOrFail($id);

        return response()->json(['data' => $role]);
    }

    /**
     * POST /api/roles
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:100|unique:roles,name',
            'description' => 'nullable|string|max:255',
        ]);

        $role = Roles::create([
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        return response()->json([
            'message' => 'Role created successfully',
            'data'    => $role,
        ], 201);
    }

    /**
     * PUT / PATCH /api/roles/{id}
     */
    public function update(Request $request, string $id)
    {
        $role = Roles::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'description' => 'nullable|string|max:255',
        ]);

        $role->update($validated);

        return response()->json([
            'message' => 'Role updated successfully',
            'data'    => $role,
        ]);
    }

    /**
     * DELETE /api/roles/{id}
     */
    public function destroy(string $id)
    {
        $role = Roles::findOrFail($id);
        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully',
        ]);
    }

    /**
     * GET /api/roles/stats
     */
    public function stats()
    {
        $base = Roles::whereNull('deleted_at');

        return response()->json([
            'all' => $base->count(),
        ]);
    }
}