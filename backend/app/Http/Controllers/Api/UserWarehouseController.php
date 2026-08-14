<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserWarehouse;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class UserWarehouseController extends Controller
{
    /**
     * GET /api/user-warehouses
     * Optional filters: user_id, warehouse_id
     */
    public function index(Request $request)
    {
        $query = UserWarehouse::with(['user:id,name,email,role_id,status', 'warehouse']);

        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }

        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        if ($request->boolean('paginate', true) && !$request->has('all')) {
            $paginator = $query->orderByDesc('created_at')->paginate($perPage);

            return response()->json([
                'data'         => $paginator->items(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
            ]);
        }

        return response()->json([
            'data' => $query->orderByDesc('created_at')->limit($perPage)->get(),
        ]);
    }

    /**
     * GET /api/user-warehouses/{id}
     */
    public function show(string $id)
    {
        $row = UserWarehouse::with(['user', 'warehouse'])->findOrFail($id);

        return response()->json(['data' => $row]);
    }

    /**
     * POST /api/user-warehouses
     * Attach one warehouse to a user.
     * Body: { user_id, warehouse_id }
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id'      => 'required|uuid|exists:users,id',
            'warehouse_id' => 'required|uuid|exists:warehouses,id',
        ]);

        $exists = UserWarehouse::where('user_id', $validated['user_id'])
            ->where('warehouse_id', $validated['warehouse_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'User already has access to this warehouse',
            ], 422);
        }

        $row = UserWarehouse::create($validated);
        $row->load(['user', 'warehouse']);

        return response()->json([
            'message' => 'Warehouse assigned to user',
            'data'    => $row,
        ], 201);
    }

    /**
     * PUT /api/users/{user}/warehouses
     * Sync full list of warehouses for a user.
     * Body: {
     *   warehouse_ids: uuid[],
     *   access_all_warehouses?: bool
     * }
     */
    public function sync(Request $request, string $userId)
    {
        $user = User::whereNull('deleted_at')->findOrFail($userId);

        $validated = $request->validate([
            'warehouse_ids'         => 'nullable|array',
            'warehouse_ids.*'       => 'uuid|exists:warehouses,id',
            'access_all_warehouses' => 'nullable|boolean',
        ]);

        $accessAll = (bool) ($validated['access_all_warehouses'] ?? false);

        DB::transaction(function () use ($user, $validated, $accessAll) {
            if (Schema::hasColumn('users', 'access_all_warehouses')) {
                $user->access_all_warehouses = $accessAll;
                $user->save();
            }

            if ($accessAll) {
                $ids = Warehouse::whereNull('deleted_at')->pluck('id')->all();
            } else {
                $ids = array_values(array_unique($validated['warehouse_ids'] ?? []));
            }

            // Replace pivot rows
            UserWarehouse::where('user_id', $user->id)->delete();

            $now = now();
            $rows = array_map(fn ($wid) => [
                'id'           => (string) \Illuminate\Support\Str::uuid(),
                'user_id'      => $user->id,
                'warehouse_id' => $wid,
                'created_at'   => $now,
            ], $ids);

            if (!empty($rows)) {
                UserWarehouse::insert($rows);
            }

            // Keep optional primary warehouse_id in sync
            if (Schema::hasColumn('users', 'warehouse_id')) {
                $user->warehouse_id = $ids[0] ?? null;
                $user->save();
            }
        });

        $user->load(['role', 'warehouse', 'warehouses']);

        return response()->json([
            'message' => 'User warehouses updated',
            'data'    => $user,
        ]);
    }

    /**
     * GET /api/users/{user}/warehouses
     * List warehouses for one user (respects access_all_warehouses).
     */
    public function forUser(string $userId)
    {
        $user = User::with(['warehouses', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($userId);

        $accessAll = (bool) ($user->access_all_warehouses ?? false);

        if ($accessAll) {
            $warehouses = Warehouse::whereNull('deleted_at')
                ->orderBy('name')
                ->get();
        } else {
            $warehouses = $user->warehouses;
            // Include primary if not already in pivot
            if ($user->warehouse && !$warehouses->contains('id', $user->warehouse->id)) {
                $warehouses = $warehouses->prepend($user->warehouse);
            }
        }

        return response()->json([
            'data' => [
                'user_id'               => $user->id,
                'access_all_warehouses' => $accessAll,
                'warehouses'            => $warehouses->values(),
            ],
        ]);
    }

    /**
     * DELETE /api/user-warehouses/{id}
     * Remove one assignment.
     */
    public function destroy(string $id)
    {
        $row = UserWarehouse::findOrFail($id);
        $row->delete();

        return response()->json([
            'message' => 'Warehouse access removed',
        ]);
    }

    /**
     * DELETE /api/users/{user}/warehouses/{warehouse}
     * Detach a specific warehouse from a user.
     */
    public function detach(string $userId, string $warehouseId)
    {
        $deleted = UserWarehouse::where('user_id', $userId)
            ->where('warehouse_id', $warehouseId)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Assignment not found'], 404);
        }

        return response()->json(['message' => 'Warehouse access removed']);
    }
}