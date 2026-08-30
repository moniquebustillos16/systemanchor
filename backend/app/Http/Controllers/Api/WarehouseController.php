<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WarehouseController extends Controller
{
    private const LIST_CACHE_TTL = 30;

    private const CANDIDATE_COLUMNS = [
        'id', 'code', 'name', 'location', 'address', 'capacity',
        'utilized', 'status', 'manager', 'created_at', 'updated_at',
    ];

    public function index(Request $request)
    {
        try {
            if (!Schema::hasTable('warehouses')) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $cols = $this->existingColumns();
            if ($cols === []) {
                $cols = ['id'];
            }

            $search = trim((string) $request->query('search', ''));
            $status = $request->query('status');
            $sort = $request->query('sort', in_array('code', $cols, true) ? 'code' : $cols[0]);
            if (!in_array($sort, $cols, true)) {
                $sort = $cols[0];
            }
            $dir = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
            $perPage = min(max((int) $request->query('per_page', 100), 1), 200);
            $plain = $request->boolean('all')
                || $request->has('all')
                || !$request->boolean('paginate', true);
            $page = max((int) $request->query('page', 1), 1);

            // Scope: null = all warehouses; array = only assigned ids
            $allowed = $this->allowedWarehouseIds($request->user());

            // Cache must be per-user when scoped, otherwise every user gets the full list
            $useCache = $search === '' && !$request->filled('status');
            $scopeKey = $allowed === null
                ? 'all'
                : ('u:' . ($request->user()?->id ?? 'guest') . ':' . md5(implode(',', $allowed)));
            $cacheKey = $useCache
                ? sprintf(
                    'warehouses:list:%s:%s:%s:%d:%d:%s',
                    $scopeKey,
                    $sort,
                    $dir,
                    $perPage,
                    $page,
                    $plain ? 'plain' : 'page'
                )
                : null;

            if ($cacheKey && ($cached = Cache::get($cacheKey)) !== null) {
                return response()->json($cached);
            }

            $query = DB::table('warehouses')->select($cols);

            if (in_array('deleted_at', $this->allTableColumns(), true)) {
                $query->whereNull('deleted_at');
            }

            // Enforce assigned warehouses for non–access-all users
            if (is_array($allowed)) {
                if ($allowed === []) {
                    $payload = [
                        'success' => true,
                        'data'    => [],
                    ];
                    if (!$plain) {
                        $payload['current_page'] = 1;
                        $payload['last_page'] = 1;
                        $payload['total'] = 0;
                        $payload['per_page'] = $perPage;
                    }
                    if ($cacheKey) {
                        Cache::put($cacheKey, $payload, self::LIST_CACHE_TTL);
                    }
                    return response()->json($payload);
                }
                $query->whereIn('id', $allowed);
            }

            if ($search !== '') {
                $op = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
                $query->where(function ($q) use ($search, $op, $cols) {
                    foreach (['code', 'name', 'location', 'address', 'manager'] as $c) {
                        if (in_array($c, $cols, true)) {
                            $q->orWhere($c, $op, "%{$search}%");
                        }
                    }
                });
            }

            if ($request->filled('status') && in_array('status', $cols, true)) {
                $query->where('status', $status);
            }

            $query->orderBy($sort, $dir);

            if ($plain) {
                $payload = [
                    'success' => true,
                    'data'    => $query->limit($perPage)->get(),
                ];
            } else {
                $total = (clone $query)->count();
                $payload = [
                    'success'      => true,
                    'data'         => $query->forPage($page, $perPage)->get(),
                    'current_page' => $page,
                    'last_page'    => (int) ceil($total / max($perPage, 1)) ?: 1,
                    'total'        => $total,
                    'per_page'     => $perPage,
                ];
            }

            if ($cacheKey) {
                Cache::put($cacheKey, $payload, self::LIST_CACHE_TTL);
            }

            return response()->json($payload);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'Failed to load warehouses',
                'error'   => config('app.debug') ? $e->getMessage() : null,
                'data'    => [],
            ], 200);
        }
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'code'     => 'required|string|max:50',
            'address'  => 'nullable|string',
            'location' => 'nullable|string',
            'capacity' => 'nullable|numeric|min:0',
            'utilized' => 'nullable|numeric|min:0|max:100',
            'status'   => 'nullable',
            'manager'  => 'nullable|string|max:255',
        ]);

        $status = $this->normalizeStatus($data['status'] ?? 'active');
        $location = $data['location'] ?? $data['address'] ?? null;
        $all = $this->allTableColumns();

        $payload = [
            'name'   => $data['name'],
            'code'   => $data['code'],
            'status' => $status,
        ];

        if (in_array('location', $all, true)) {
            $payload['location'] = $location;
        } elseif (in_array('address', $all, true)) {
            $payload['address'] = $location;
        }
        if (in_array('capacity', $all, true)) {
            $payload['capacity'] = $data['capacity'] ?? 0;
        }
        if (in_array('utilized', $all, true)) {
            $payload['utilized'] = $data['utilized'] ?? 0;
        }
        if (in_array('manager', $all, true)) {
            $payload['manager'] = $data['manager'] ?? null;
        }

        $warehouse = Warehouse::create($payload);
        $this->bustListCache();

        return response()->json([
            'success' => true,
            'message' => 'Warehouse created successfully',
            'data'    => $warehouse,
        ], 201);
    }

    public function show(Request $request, string $id)
    {
        $warehouse = Warehouse::query()->findOrFail($id);
        $this->assertCanAccessWarehouse($request->user(), (string) $id);

        return response()->json([
            'success' => true,
            'data'    => $warehouse,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $warehouse = Warehouse::query()->findOrFail($id);

        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'code'     => 'sometimes|string|max:50',
            'address'  => 'nullable|string',
            'location' => 'nullable|string',
            'capacity' => 'nullable|numeric|min:0',
            'utilized' => 'nullable|numeric|min:0|max:100',
            'status'   => 'nullable',
            'manager'  => 'nullable|string|max:255',
        ]);

        if (array_key_exists('status', $data)) {
            $data['status'] = $this->normalizeStatus($data['status']);
        }
        if (!isset($data['location']) && isset($data['address'])) {
            $data['location'] = $data['address'];
        }
        unset($data['address']);

        $all = $this->allTableColumns();
        foreach (array_keys($data) as $key) {
            if (!in_array($key, $all, true)) {
                unset($data[$key]);
            }
        }

        $warehouse->update($data);
        $this->bustListCache();

        return response()->json([
            'success' => true,
            'message' => 'Warehouse updated successfully',
            'data'    => $warehouse->fresh(),
        ]);
    }

    public function destroy(string $id)
    {
        Warehouse::query()->findOrFail($id)->delete();
        $this->bustListCache();

        return response()->json([
            'success' => true,
            'message' => 'Warehouse deleted successfully',
        ]);
    }

    /* ─────────────────────────────────────────────
     |  WAREHOUSE SCOPE (dropdown + list)
     ───────────────────────────────────────────── */

    /**
     * null  = user may see every warehouse (access_all_warehouses)
     * array = only these warehouse UUIDs
     *
     * @return list<string>|null
     */
    private function allowedWarehouseIds(?User $user): ?array
    {
        if (!$user) {
            return [];
        }

        if (method_exists($user, 'canAccessAllWarehouses') && $user->canAccessAllWarehouses()) {
            return null;
        }

        if (!empty($user->access_all_warehouses)) {
            return null;
        }

        $ids = [];

        if (method_exists($user, 'warehouses')) {
            $ids = $user->warehouses()
                ->pluck('warehouses.id')
                ->map(fn ($id) => (string) $id)
                ->all();
        }

        if (!empty($user->warehouse_id)) {
            $ids[] = (string) $user->warehouse_id;
        }

        return array_values(array_unique($ids));
    }

    private function assertCanAccessWarehouse(?User $user, string $warehouseId): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        if (!in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    private function normalizeStatus(mixed $status): string
    {
        if (is_bool($status)) {
            return $status ? 'active' : 'inactive';
        }
        if (is_string($status)) {
            return strtolower($status) === 'active' ? 'active' : 'inactive';
        }
        return 'active';
    }

    /** @return string[] */
    private function existingColumns(): array
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        try {
            $all = $this->allTableColumns();
            $cached = array_values(array_filter(
                self::CANDIDATE_COLUMNS,
                fn (string $c) => in_array($c, $all, true)
            ));
        } catch (\Throwable $e) {
            $cached = ['id', 'code', 'name'];
        }
        return $cached;
    }

    /** @return string[] */
    private function allTableColumns(): array
    {
        static $cols = null;
        if ($cols !== null) {
            return $cols;
        }
        try {
            $cols = Schema::getColumnListing('warehouses');
        } catch (\Throwable $e) {
            $cols = [];
        }
        return $cols;
    }

    private function bustListCache(): void
    {
        // Legacy global keys + common per-page variants
        foreach (['20', '30', '50', '100', '200'] as $n) {
            Cache::forget("warehouses:list:all:code:asc:{$n}:1:plain");
            Cache::forget("warehouses:list:code:asc:{$n}:1:plain");
        }
    }
}