<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\RolePermissions;
use App\Models\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RolePermissionController extends Controller
{
    /**
     * List all role–permission assignments (optional filters).
     */
    public function index(Request $request): JsonResponse
    {
        $query = RolePermissions::with(['role', 'permission']);

        if ($roleId = $request->query('role_id')) {
            $query->where('role_id', $roleId);
        }

        if ($permissionId = $request->query('permission_id')) {
            $query->where('permission_id', $permissionId);
        }

        $perPage = (int) $request->query('per_page', 50);
        $records = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $records,
        ]);
    }

    /**
     * Get all permissions for a specific role.
     */
    public function forRole(string $roleId): JsonResponse
    {
        $role = Roles::with('permissions')->find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'role'        => $role->only(['id', 'name', 'description']),
                'permissions' => $role->permissions,
            ],
        ]);
    }

    /**
     * Assign a single permission to a role.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'role_id'       => 'required|uuid|exists:roles,id',
            'permission_id' => 'required|uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $exists = RolePermissions::where('role_id', $data['role_id'])
            ->where('permission_id', $data['permission_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'This permission is already assigned to the role.',
            ], 409);
        }

        $record = RolePermissions::create($data);
        $record->load(['role', 'permission']);

        return response()->json([
            'success' => true,
            'message' => 'Permission assigned to role successfully.',
            'data'    => $record,
        ], 201);
    }

    /**
     * Sync (replace) all permissions for a role.
     * Body: { "permission_ids": ["uuid1", "uuid2", ...] }
     */
    public function sync(Request $request, string $roleId): JsonResponse
    {
        $role = Roles::find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'permission_ids'   => 'required|array',
            'permission_ids.*' => 'uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $permissionIds = $validator->validated()['permission_ids'];

        DB::transaction(function () use ($role, $permissionIds) {
            $role->permissions()->sync($permissionIds);
        });

        $role->load('permissions');

        return response()->json([
            'success' => true,
            'message' => 'Role permissions synced successfully.',
            'data'    => [
                'role'        => $role->only(['id', 'name', 'description']),
                'permissions' => $role->permissions,
            ],
        ]);
    }

    /**
     * Detach a single permission from a role.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'role_id'       => 'required|uuid|exists:roles,id',
            'permission_id' => 'required|uuid|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $deleted = RolePermissions::where('role_id', $data['role_id'])
            ->where('permission_id', $data['permission_id'])
            ->delete();

        if (!$deleted) {
            return response()->json([
                'success' => false,
                'message' => 'Assignment not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Permission removed from role successfully.',
        ]);
    }

    /**
     * Detach a permission from a role via URL params.
     * DELETE /roles/{role}/permissions/{permission}
     */
    public function detach(string $roleId, string $permissionId): JsonResponse
    {
        $role = Roles::find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
            ], 404);
        }

        $detached = $role->permissions()->detach($permissionId);

        if (!$detached) {
            return response()->json([
                'success' => false,
                'message' => 'Permission was not assigned to this role.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Permission removed from role successfully.',
        ]);
    }
}