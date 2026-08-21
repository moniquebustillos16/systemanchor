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
        // Pivot may be composite PK only (no `id` column) – never SELECT id.
        $query = DB::table('role_permissions')
            ->select(['role_id', 'permission_id']);

        if ($roleId = $request->query('role_id')) {
            $query->where('role_id', $roleId);
        }

        if ($permissionId = $request->query('permission_id')) {
            $query->where('permission_id', $permissionId);
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), 500);

        // Fast path for role filter – no Eloquent, no with(), no paginator
        if ($request->query('role_id') && !$request->boolean('paginate')) {
            return response()->json([
                'success' => true,
                'data'    => $query->limit($perPage)->get(),
            ]);
        }

        $records = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $records,
        ]);
    }

    /**
     * GET /roles/{role}/permissions
     *
     * Hot path for Roles.tsx matrix.
     * - Default: lean permission rows (id, name, description)
     * - ?ids_only=1: only permission UUIDs (smallest / fastest – preferred by the UI)
     *
     * One indexed query. No Schema::hasColumn (hits information_schema every request).
     * No Eloquent. No separate existence check (empty list is fine for the matrix).
     */
    public function forRole(string $roleId, Request $request): JsonResponse
    {
        // UI only needs IDs to tick checkboxes – catalog already has name/description
        if ($request->boolean('ids_only')) {
            $ids = DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->pluck('permission_id')
                ->values()
                ->all();

            return response()->json([
                'success' => true,
                'data'    => [
                    'permission_ids' => $ids,
                ],
            ]);
        }

        $permissions = DB::table('role_permissions as rp')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('rp.role_id', $roleId)
            ->orderBy('p.name')
            ->select(['p.id', 'p.name', 'p.description'])
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'role'        => ['id' => $roleId],
                'permissions' => $permissions,
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
        $record->load(['role:id,name', 'permission:id,name,description']);

        return response()->json([
            'success' => true,
            'message' => 'Permission assigned to role successfully.',
            'data'    => $record,
        ], 201);
    }

    /**
     * Sync (replace) all permissions for a role.
     * Body: { "permission_ids": ["uuid1", "uuid2", ...] }
     *
     * Fast path:
     * - no per-id exists:permissions,id (was N DB checks)
     * - no Eloquent $role->permissions()->sync()
     * - one DELETE + bulk INSERT in a transaction
     */
    public function sync(Request $request, string $roleId): JsonResponse
    {
        if (!DB::table('roles')->where('id', $roleId)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'permission_ids'   => 'required|array',
            // Format only — avoid exists:permissions,id on every element
            'permission_ids.*' => 'uuid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $permissionIds = array_values(array_unique(
            $validator->validated()['permission_ids']
        ));

        // Optional: one IN query to drop unknown IDs (still a single round-trip)
        if ($permissionIds !== []) {
            $permissionIds = DB::table('permissions')
                ->whereIn('id', $permissionIds)
                ->pluck('id')
                ->all();
        }

        DB::transaction(function () use ($roleId, $permissionIds) {
            DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->delete();

            if ($permissionIds === []) {
                return;
            }

            $rows = array_map(
                static fn (string $pid) => [
                    'role_id'       => $roleId,
                    'permission_id' => $pid,
                ],
                $permissionIds
            );

            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('role_permissions')->insert($chunk);
            }
        });

        // Return the list we just wrote — no extra SELECT
        return response()->json([
            'success' => true,
            'message' => 'Role permissions synced successfully.',
            'data'    => [
                'role'           => ['id' => $roleId],
                'permission_ids' => $permissionIds,
            ],
        ]);
    }

    /**
     * Detach a single permission from a role (body).
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