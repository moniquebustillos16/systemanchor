<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserWarehouse;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class UserWarehouseController extends Controller
{
    private const CACHE_TTL = 30;

    public function index(Request $request)
    {
        $query = UserWarehouse::query()->with([
            'user:id,name,email,role_id,status',
            'warehouse:id,code,name,location,status',
        ]);

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

    public function show(string $id)
    {
        $row = UserWarehouse::with([
            'user:id,name,email,role_id,status',
            'warehouse:id,code,name,location,status',
        ])->findOrFail($id);

        return response()->json(['data' => $row]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id'      => 'required|uuid|exists:users,id',
            'warehouse_id' => 'required|uuid|exists:warehouses,id',
        ]);

        if (UserWarehouse::where('user_id', $validated['user_id'])
            ->where('warehouse_id', $validated['warehouse_id'])
            ->exists()) {
            return response()->json([
                'message' => 'User already has access to this warehouse',
            ], 422);
        }

        $row = UserWarehouse::create($validated);
        $row->load([
            'user:id,name,email,role_id,status',
            'warehouse:id,code,name,location,status',
        ]);
        $this->bustUserCache($validated['user_id']);

        return response()->json([
            'message' => 'Warehouse assigned to user',
            'data'    => $row,
        ], 201);
    }

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
                $q = Warehouse::query();
                if (Schema::hasColumn('warehouses', 'deleted_at')) {
                    $q->whereNull('deleted_at');
                }
                $ids = $q->pluck('id')->all();
            } else {
                $ids = array_values(array_unique($validated['warehouse_ids'] ?? []));
            }

            UserWarehouse::where('user_id', $user->id)->delete();

            if ($ids !== []) {
                $now = now();
                $rows = array_map(fn ($wid) => [
                    'id'           => (string) Str::uuid(),
                    'user_id'      => $user->id,
                    'warehouse_id' => $wid,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ], $ids);
                foreach (array_chunk($rows, 100) as $chunk) {
                    UserWarehouse::insert($chunk);
                }
            }

            if (Schema::hasColumn('users', 'warehouse_id')) {
                $user->warehouse_id = $ids[0] ?? null;
                $user->save();
            }
        });

        $this->bustUserCache($user->id);

        $user->load([
            'role:id,name',
            'warehouse:id,code,name',
            'warehouses:id,code,name,location,status',
        ]);

        return response()->json([
            'message' => 'User warehouses updated',
            'data'    => $user,
        ]);
    }

    public function forUser(string $userId)
    {
        $cacheKey = "user:{$userId}:warehouses";

        $payload = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($userId) {
            $user = User::query()
                ->with(['role:id,name'])
                ->whereNull('deleted_at')
                ->findOrFail($userId);

            $accessAll = (bool) ($user->access_all_warehouses ?? false);

            // Admin role → treat as full warehouse access (same as access_all_warehouses)
            $roleName = strtolower(preg_replace('/[\s_-]+/', '', (string) ($user->role->name ?? $user->role_name ?? '')));
            if (in_array($roleName, ['admin', 'administrator', 'superadmin', 'superadministrator', 'systemadmin', 'root', 'owner'], true)) {
                $accessAll = true;
            }

            if ($accessAll) {
                $q = Warehouse::query()->orderBy('name');
                if (Schema::hasColumn('warehouses', 'deleted_at')) {
                    $q->whereNull('deleted_at');
                }
                $warehouses = $q->get(['id', 'code', 'name', 'location', 'status']);
            } else {
                // Non-admin → only assigned warehouses
                $warehouses = $user->warehouses()
                    ->select([
                        'warehouses.id',
                        'warehouses.code',
                        'warehouses.name',
                        'warehouses.location',
                        'warehouses.status',
                    ])
                    ->orderBy('warehouses.name')
                    ->get();

                // Also include primary warehouse if set
                if (!empty($user->warehouse_id)) {
                    $primary = Warehouse::find($user->warehouse_id);
                    if ($primary && !$warehouses->contains('id', $primary->id)) {
                        $warehouses = $warehouses->prepend($primary);
                    }
                }
            }

            return [
                'user_id'               => $user->id,
                'access_all_warehouses' => $accessAll,
                'warehouses'            => $warehouses->values(),
            ];
        });

        return response()->json(['data' => $payload]);
    }

    public function destroy(string $id)
    {
        $row = UserWarehouse::findOrFail($id);
        $userId = $row->user_id;
        $row->delete();
        $this->bustUserCache($userId);

        return response()->json(['message' => 'Warehouse access removed']);
    }

    public function detach(string $userId, string $warehouseId)
    {
        $deleted = UserWarehouse::where('user_id', $userId)
            ->where('warehouse_id', $warehouseId)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Assignment not found'], 404);
        }

        $this->bustUserCache($userId);

        return response()->json(['message' => 'Warehouse access removed']);
    }

    private function bustUserCache(string $userId): void
    {
        try {
            Cache::forget("user:{$userId}:warehouses");
        } catch (\Throwable $e) {
            /* ignore */
        }
    }
}