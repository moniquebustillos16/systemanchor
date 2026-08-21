<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Minimal columns for the Users table (smaller JSON = faster).
     */
    private const LIST_COLUMNS = [
        'id',
        'name',
        'email',
        'role_id',
        'warehouse_id',
        'status',
        'last_login_at',
        'created_at',
        'updated_at',
    ];

    protected function userWith(): array
    {
        // Include multi-warehouse relation when the pivot / method exists
        $with = ['role', 'warehouse'];
        if (method_exists(User::class, 'warehouses')) {
            $with[] = 'warehouses';
        }

        return $with;
    }

    protected function listColumns(): array
    {
        $cols = self::LIST_COLUMNS;
        if (Schema::hasColumn('users', 'access_all_warehouses')) {
            $cols[] = 'access_all_warehouses';
        }

        return $cols;
    }

    /**
     * Sync multi-warehouse assignment.
     * - access_all_warehouses = true  → clear pivot, null warehouse_id
     * - otherwise → sync warehouse_ids pivot + set primary warehouse_id to first id
     */
    protected function syncUserWarehouses(User $user, bool $accessAll, array $warehouseIds): void
    {
        $warehouseIds = array_values(array_unique(array_filter($warehouseIds)));

        if ($accessAll) {
            if (Schema::hasColumn('users', 'access_all_warehouses')) {
                $user->access_all_warehouses = true;
            }
            $user->warehouse_id = null;
            $user->save();

            if (method_exists($user, 'warehouses')) {
                $user->warehouses()->sync([]);
            }

            return;
        }

        if (Schema::hasColumn('users', 'access_all_warehouses')) {
            $user->access_all_warehouses = false;
        }

        // Primary (legacy single column) = first selected
        $user->warehouse_id = $warehouseIds[0] ?? null;
        $user->save();

        if (method_exists($user, 'warehouses')) {
            $user->warehouses()->sync($warehouseIds);
        }
    }

    /**
     * GET /api/users
     */
    public function index(Request $request)
    {
        $query = User::query()
            ->select($this->listColumns())
            ->with($this->userWith())
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $driver = $query->getConnection()->getDriverName();
            $op = $driver === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $op) {
                $q->where('name', $op, "%{$search}%")
                  ->orWhere('email', $op, "%{$search}%");
            });
        }

        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($roleId = $request->query('role_id')) {
            $query->where('role_id', $roleId);
        }

        // Match primary OR pivot membership OR access-all
        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where(function ($q) use ($warehouseId) {
                $q->where('warehouse_id', $warehouseId);

                if (Schema::hasColumn('users', 'access_all_warehouses')) {
                    $q->orWhere('access_all_warehouses', true);
                }

                if (method_exists(User::class, 'warehouses')) {
                    $q->orWhereHas('warehouses', function ($wq) use ($warehouseId) {
                        $wq->where('warehouses.id', $warehouseId);
                    });
                }
            });
        }

        $sort = $request->query('sort', 'name');
        $dir  = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
        if (!in_array($sort, ['name', 'email', 'status', 'created_at', 'last_login_at'], true)) {
            $sort = 'name';
        }
        $query->orderBy($sort, $dir);

        $perPage = min(max((int) $request->query('per_page', 100), 1), 500);

        if (!$request->boolean('paginate')) {
            return response()->json([
                'data' => $query->limit($perPage)->get(),
            ]);
        }

        $p = $query->paginate($perPage);

        return response()->json([
            'data'         => $p->items(),
            'current_page' => $p->currentPage(),
            'last_page'    => $p->lastPage(),
            'total'        => $p->total(),
            'per_page'     => $p->perPage(),
        ]);
    }

    public function show(string $id)
    {
        $user = User::with($this->userWith())->findOrFail($id);

        return response()->json(['data' => $user]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'                   => 'required|string|max:255',
            'email'                  => 'required|email|max:255|unique:users,email',
            'password'               => 'required|string|min:6|max:255',
            'role_id'                => 'nullable|uuid|exists:roles,id',
            'warehouse_id'           => 'nullable|uuid|exists:warehouses,id',
            'warehouse_ids'          => 'nullable|array',
            'warehouse_ids.*'        => 'uuid|exists:warehouses,id',
            'access_all_warehouses'  => 'nullable|boolean',
            'status'                 => 'nullable|string|max:30|in:active,inactive,suspended',
            'phone'                  => 'nullable|string|max:50',
            'job_title'              => 'nullable|string|max:150',
            'department'             => 'nullable|string|max:150',
        ]);

        $accessAll = $request->boolean('access_all_warehouses');
        $warehouseIds = $validated['warehouse_ids'] ?? [];
        if (!$accessAll && empty($warehouseIds) && !empty($validated['warehouse_id'])) {
            $warehouseIds = [$validated['warehouse_id']];
        }

        $data = [
            'name'         => $validated['name'],
            'email'        => $validated['email'],
            'password'     => $validated['password'],
            'role_id'      => $validated['role_id'] ?? null,
            'warehouse_id' => $accessAll ? null : ($warehouseIds[0] ?? $validated['warehouse_id'] ?? null),
            'status'       => $validated['status'] ?? 'active',
            'phone'        => $validated['phone'] ?? null,
            'job_title'    => $validated['job_title'] ?? null,
            'department'   => $validated['department'] ?? null,
        ];

        if (Schema::hasColumn('users', 'access_all_warehouses')) {
            $data['access_all_warehouses'] = $accessAll;
        }

        $user = User::create($data);
        $this->syncUserWarehouses($user, $accessAll, $warehouseIds);
        $user->load($this->userWith());

        return response()->json([
            'message' => 'User created successfully',
            'data'    => $user,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name'                   => 'sometimes|required|string|max:255',
            'email'                  => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password'               => 'sometimes|nullable|string|min:6|max:255',
            'role_id'                => 'nullable|uuid|exists:roles,id',
            'warehouse_id'           => 'nullable|uuid|exists:warehouses,id',
            'warehouse_ids'          => 'nullable|array',
            'warehouse_ids.*'        => 'uuid|exists:warehouses,id',
            'access_all_warehouses'  => 'nullable|boolean',
            'status'                 => 'nullable|string|max:30|in:active,inactive,suspended',
            'phone'                  => 'nullable|string|max:50',
            'job_title'              => 'nullable|string|max:150',
            'department'             => 'nullable|string|max:150',
        ]);

        if (array_key_exists('password', $validated) && empty($validated['password'])) {
            unset($validated['password']);
        }

        $touchWarehouses = $request->has('access_all_warehouses')
            || $request->has('warehouse_ids')
            || $request->has('warehouse_id');

        $accessAll = $request->has('access_all_warehouses')
            ? $request->boolean('access_all_warehouses')
            : (bool) ($user->access_all_warehouses ?? false);

        $warehouseIds = $validated['warehouse_ids']
            ?? ($request->has('warehouse_id') && $validated['warehouse_id']
                ? [$validated['warehouse_id']]
                : null);

        // Strip warehouse fields from mass-assign; handled by syncUserWarehouses
        unset($validated['warehouse_ids'], $validated['access_all_warehouses']);

        if ($touchWarehouses) {
            if ($accessAll) {
                $validated['warehouse_id'] = null;
            } elseif (is_array($warehouseIds)) {
                $validated['warehouse_id'] = $warehouseIds[0] ?? null;
            }
            if (Schema::hasColumn('users', 'access_all_warehouses')) {
                $validated['access_all_warehouses'] = $accessAll;
            }
        }

        $user->update($validated);

        if ($touchWarehouses) {
            $ids = is_array($warehouseIds) ? $warehouseIds : [];
            $this->syncUserWarehouses($user->fresh(), $accessAll, $ids);
        }

        $user->load($this->userWith());

        return response()->json([
            'message' => 'User updated successfully',
            'data'    => $user,
        ]);
    }

    /**
     * PUT /api/users/{id}/warehouses
     * Body: { access_all_warehouses?: bool, warehouse_ids?: string[] }
     */
    public function syncWarehouses(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'access_all_warehouses' => 'nullable|boolean',
            'warehouse_ids'         => 'nullable|array',
            'warehouse_ids.*'       => 'uuid|exists:warehouses,id',
        ]);

        $accessAll = $request->boolean('access_all_warehouses');
        $warehouseIds = $validated['warehouse_ids'] ?? [];

        $this->syncUserWarehouses($user, $accessAll, $warehouseIds);
        $user->load($this->userWith());

        return response()->json([
            'message' => 'Warehouse access updated',
            'data'    => $user,
        ]);
    }

    public function destroy(string $id)
    {
        User::findOrFail($id)->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * One SQL query instead of 4× COUNT.
     */
    public function stats()
    {
        $row = User::query()
            ->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_count,
                COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) AS inactive_count,
                COALESCE(SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END), 0) AS suspended_count
            ")
            ->first();

        return response()->json([
            'all'       => (int) ($row->total ?? 0),
            'active'    => (int) ($row->active_count ?? 0),
            'inactive'  => (int) ($row->inactive_count ?? 0),
            'suspended' => (int) ($row->suspended_count ?? 0),
        ]);
    }
}
