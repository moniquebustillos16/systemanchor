<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    /**
     * List all permissions (with optional search & pagination).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Permission::query()->withCount('roles');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 15);
        $permissions = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $permissions,
        ]);
    }

    /**
     * Permission statistics.
     */
    public function stats(): JsonResponse
    {
        $total = Permission::count();

        return response()->json([
            'success' => true,
            'data'    => [
                'total' => $total,
            ],
        ]);
    }

    /**
     * Show a single permission (with its roles).
     */
    public function show(string $id): JsonResponse
    {
        $permission = Permission::with('roles')->find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Permission not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $permission,
        ]);
    }

    /**
     * Create a new permission.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'        => 'required|string|max:100|unique:permissions,name',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $permission = Permission::create($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Permission created successfully.',
            'data'    => $permission,
        ], 201);
    }

    /**
     * Update an existing permission.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Permission not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name'        => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('permissions', 'name')->ignore($permission->id),
            ],
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $permission->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Permission updated successfully.',
            'data'    => $permission->fresh(),
        ]);
    }

    /**
     * Delete a permission.
     */
    public function destroy(string $id): JsonResponse
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Permission not found.',
            ], 404);
        }

        // Detach from all roles first
        $permission->roles()->detach();
        $permission->delete();

        return response()->json([
            'success' => true,
            'message' => 'Permission deleted successfully.',
        ]);
    }
}