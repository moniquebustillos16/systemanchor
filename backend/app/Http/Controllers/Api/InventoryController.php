<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    /** Columns needed by the Inventory table UI */
    private const LIST_COLUMNS = [
        'id', 'sku', 'name', 'barcode', 'serial',
        'category_id', 'warehouse_id', 'supplier_id',
        'qty', 'min_stock', 'max_stock', 'price', 'status',
        'created_at', 'updated_at',
    ];

    private const STATS_CACHE_TTL = 20; // seconds

    /* ─────────────────────────────────────────────
     |  LIST
     ───────────────────────────────────────────── */

    public function index(Request $request)
    {
        $query = Product::query()
            ->select(self::LIST_COLUMNS)
            ->whereNull('deleted_at');

        // Enforce assigned-warehouse scope for non–access-all users
        $this->applyWarehouseScope($query, $request);

        $with = ['category:id,name', 'warehouse:id,code,name', 'supplier:id,name'];
        if ($request->boolean('with_images')) {
            $with[] = 'images';
            $with[] = 'primaryImage';
        }
        $query->with($with);

        if ($search = $request->query('search')) {
            $driver = $query->getConnection()->getDriverName();
            $op = $driver === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($search, $op) {
                $q->where('sku', $op, "%{$search}%")
                  ->orWhere('name', $op, "%{$search}%")
                  ->orWhere('barcode', $op, "%{$search}%")
                  ->orWhere('serial', $op, "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Optional client filter — must still be within allowed set (checked in applyWarehouseScope)
        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        if ($status = $request->query('status')) {
            match ($status) {
                'out-of-stock' => $query->where('qty', '<=', 0),
                'low-stock'    => $query->whereColumn('qty', '<', 'min_stock')->where('qty', '>', 0),
                'active'       => $query->whereColumn('qty', '>=', 'min_stock'),
                default        => null,
            };
        }

        $sort = $request->query('sort', 'sku');
        $dir  = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
        if (in_array($sort, ['sku', 'name', 'qty', 'price', 'created_at'], true)) {
            $query->orderBy($sort, $dir);
        } else {
            $query->orderBy('sku', 'asc');
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        if ($request->boolean('all') || !$request->boolean('paginate', true)) {
            $items = $query->limit($perPage)->get();
            $items->transform(fn (Product $p) => $this->decorate($p));

            return response()->json([
                'success' => true,
                'data'    => $items,
                'total'   => $items->count(),
            ]);
        }

        $page = $query->paginate($perPage);
        $page->getCollection()->transform(fn (Product $p) => $this->decorate($p));

        return response()->json($page);
    }

    /* ─────────────────────────────────────────────
     |  STATS
     ───────────────────────────────────────────── */

    public function stats(Request $request)
    {
        $user = $request->user();
        $allowed = $this->allowedWarehouseIds($user);

        // Global cache only for users who can see all warehouses
        if ($allowed === null) {
            $payload = Cache::remember('inventory:stats', self::STATS_CACHE_TTL, function () {
                return $this->computeStats(null);
            });

            return response()->json($payload);
        }

        // Scoped users: cache per user so numbers match their warehouses
        $cacheKey = 'inventory:stats:user:' . $user->id;
        $payload = Cache::remember($cacheKey, self::STATS_CACHE_TTL, function () use ($allowed) {
            return $this->computeStats($allowed);
        });

        return response()->json($payload);
    }

    /* ─────────────────────────────────────────────
     |  SHOW (includes images for detail / edit modal)
     ───────────────────────────────────────────── */

    public function show(Request $request, string $id)
    {
        $product = Product::with([
                'category:id,name',
                'warehouse:id,code,name',
                'supplier:id,name',
                'images',
                'primaryImage',
            ])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $this->assertCanAccessProduct($request->user(), $product);

        return response()->json($this->decorate($product));
    }

    /* ─────────────────────────────────────────────
     |  CREATE
     ───────────────────────────────────────────── */

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku'          => 'required|string|max:100|unique:products,sku',
            'name'         => 'required|string|max:255',
            'barcode'      => 'nullable|string|max:100',
            'serial'       => 'nullable|string|max:100',
            'category_id'  => 'nullable|uuid|exists:categories,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'supplier_id'  => 'nullable|uuid|exists:suppliers,id',
            'qty'          => 'nullable|numeric|min:0',
            'min_stock'    => 'nullable|numeric|min:0',
            'max_stock'    => 'nullable|numeric|min:0',
            'price'        => 'nullable|numeric|min:0',
            'status'       => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        // Non–access-all users may only create products in assigned warehouses
        $warehouseId = $validated['warehouse_id'] ?? null;
        if ($warehouseId !== null) {
            $this->assertCanAccessWarehouseId($request->user(), (string) $warehouseId);
        } else {
            // Require a warehouse for restricted users
            $allowed = $this->allowedWarehouseIds($request->user());
            if (is_array($allowed)) {
                return response()->json([
                    'message' => 'warehouse_id is required for your account.',
                ], 422);
            }
        }

        $product = Product::create([
            'sku'          => $validated['sku'],
            'name'         => $validated['name'],
            'barcode'      => $validated['barcode'] ?? null,
            'serial'       => $validated['serial'] ?? null,
            'category_id'  => $validated['category_id'] ?? null,
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'supplier_id'  => $validated['supplier_id'] ?? null,
            'qty'          => $validated['qty'] ?? 0,
            'min_stock'    => $validated['min_stock'] ?? 0,
            'max_stock'    => $validated['max_stock'] ?? 0,
            'price'        => $validated['price'] ?? 0,
            'status'       => $validated['status'] ?? 'active',
        ]);

        $product->load(['category:id,name', 'warehouse:id,code,name', 'supplier:id,name']);

        $this->notifyStockLevel($product);
        $this->forgetStatsCache($request->user());

        return response()->json([
            'message' => 'Product created successfully',
            'data'    => $this->decorate($product),
        ], 201);
    }

    /* ─────────────────────────────────────────────
     |  UPDATE
     ───────────────────────────────────────────── */

    public function update(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        // Must already be allowed to see this product
        $this->assertCanAccessProduct($request->user(), $product);

        $validated = $request->validate([
            'sku' => [
                'sometimes', 'required', 'string', 'max:100',
                Rule::unique('products', 'sku')->ignore($product->id),
            ],
            'name'         => 'sometimes|required|string|max:255',
            'barcode'      => 'sometimes|nullable|string|max:100',
            'serial'       => 'sometimes|nullable|string|max:100',
            'category_id'  => 'sometimes|nullable|uuid|exists:categories,id',
            'warehouse_id' => 'sometimes|nullable|uuid|exists:warehouses,id',
            'supplier_id'  => 'sometimes|nullable|uuid|exists:suppliers,id',
            'qty'          => 'sometimes|numeric|min:0',
            'min_stock'    => 'sometimes|numeric|min:0',
            'max_stock'    => 'sometimes|numeric|min:0',
            'price'        => 'sometimes|numeric|min:0',
            'status'       => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        // Moving to another warehouse must also be allowed
        if (array_key_exists('warehouse_id', $validated) && $validated['warehouse_id'] !== null) {
            $this->assertCanAccessWarehouseId($request->user(), (string) $validated['warehouse_id']);
        }

        $product->update($validated);
        $product->load([
            'category:id,name',
            'warehouse:id,code,name',
            'supplier:id,name',
            'images',
            'primaryImage',
        ]);

        if (array_key_exists('qty', $validated) || array_key_exists('min_stock', $validated)) {
            $this->notifyStockLevel($product);
        }
        $this->forgetStatsCache($request->user());

        return response()->json([
            'message' => 'Inventory updated successfully',
            'data'    => $this->decorate($product),
        ]);
    }

    /* ─────────────────────────────────────────────
     |  DELETE (soft)
     ───────────────────────────────────────────── */

    public function destroy(Request $request, string $id)
    {
        $product = Product::whereNull('deleted_at')->findOrFail($id);

        $this->assertCanAccessProduct($request->user(), $product);

        $product->delete();
        $this->forgetStatsCache($request->user());

        return response()->json([
            'message' => 'Product deleted successfully',
        ]);
    }

    /* ─────────────────────────────────────────────
     |  WAREHOUSE SCOPE HELPERS
     ───────────────────────────────────────────── */

    /**
     * null  = user may access all warehouses (access_all_warehouses)
     * array = only these warehouse UUIDs (may be empty)
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

        // Include primary warehouse_id if set
        if (!empty($user->warehouse_id)) {
            $ids[] = (string) $user->warehouse_id;
        }

        return array_values(array_unique($ids));
    }

    /**
     * Restrict a product query to the current user's warehouses.
     * Also rejects a client-supplied warehouse_id outside their assignment.
     */
    private function applyWarehouseScope($query, Request $request): void
    {
        $allowed = $this->allowedWarehouseIds($request->user());

        if ($allowed === null) {
            return; // full access
        }

        if ($allowed === []) {
            // No warehouses assigned → no products
            $query->whereRaw('1 = 0');
            return;
        }

        if ($request->filled('warehouse_id')) {
            $requested = (string) $request->warehouse_id;
            if (!in_array($requested, $allowed, true)) {
                abort(403, 'You do not have access to this warehouse.');
            }
            // index() will also apply where warehouse_id = requested
            return;
        }

        $query->whereIn('warehouse_id', $allowed);
    }

    private function assertCanAccessProduct(?User $user, Product $product): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        $wid = $product->warehouse_id !== null ? (string) $product->warehouse_id : null;

        if ($wid === null || !in_array($wid, $allowed, true)) {
            abort(403, 'You do not have access to this product warehouse.');
        }
    }

    private function assertCanAccessWarehouseId(?User $user, string $warehouseId): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        if (!in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    /**
     * @param  list<string>|null  $allowedWarehouseIds  null = all
     */
    private function computeStats(?array $allowedWarehouseIds): array
    {
        $query = Product::query()->whereNull('deleted_at');

        if (is_array($allowedWarehouseIds)) {
            if ($allowedWarehouseIds === []) {
                return [
                    'total_products'  => 0,
                    'low_stock'       => 0,
                    'out_of_stock'    => 0,
                    'inventory_value' => 0.0,
                ];
            }
            $query->whereIn('warehouse_id', $allowedWarehouseIds);
        }

        $row = $query
            ->selectRaw("
                COUNT(*) as total_products,
                COALESCE(SUM(CASE WHEN qty > 0 AND qty < min_stock THEN 1 ELSE 0 END), 0) as low_stock,
                COALESCE(SUM(CASE WHEN qty <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock,
                COALESCE(SUM(qty * price), 0) as inventory_value
            ")
            ->first();

        return [
            'total_products'  => (int) ($row->total_products ?? 0),
            'low_stock'       => (int) ($row->low_stock ?? 0),
            'out_of_stock'    => (int) ($row->out_of_stock ?? 0),
            'inventory_value' => (float) ($row->inventory_value ?? 0),
        ];
    }

    private function forgetStatsCache(?User $user): void
    {
        Cache::forget('inventory:stats');
        if ($user) {
            Cache::forget('inventory:stats:user:' . $user->id);
        }
    }

    /* ─────────────────────────────────────────────
     |  HELPERS
     ───────────────────────────────────────────── */

    private function decorate(Product $p): Product
    {
        $p->display_status = $this->displayStatus($p);
        $p->stock_value    = (float) $p->qty * (float) $p->price;

        return $p;
    }

    private function displayStatus(Product $p): string
    {
        if ((float) $p->qty <= 0) {
            return 'out-of-stock';
        }
        if ((float) $p->qty < (float) $p->min_stock) {
            return 'low-stock';
        }

        return 'active';
    }

    private function notifyStockLevel(Product $product): void
    {
        $qty = (float) $product->qty;
        $min = (float) $product->min_stock;

        if ($qty > 0 && $qty >= $min) {
            return;
        }

        $type  = $qty <= 0 ? 'danger' : 'warning';
        $title = $qty <= 0 ? 'Out of stock' : 'Low stock alert';
        $message = $qty <= 0
            ? "{$product->sku} {$product->name} has reached zero quantity"
            : "{$product->sku} {$product->name} is below minimum ({$qty} / {$min})";

        User::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->select('id')
            ->chunkById(200, function ($users) use ($type, $title, $message) {
                $now  = now();
                $rows = [];
                foreach ($users as $user) {
                    $rows[] = [
                        'id'         => (string) \Illuminate\Support\Str::uuid(),
                        'user_id'    => $user->id,
                        'type'       => $type,
                        'title'      => $title,
                        'message'    => $message,
                        'page'       => '/products',
                        'is_read'    => false,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                if ($rows !== []) {
                    DB::table('notifications')->insert($rows);
                }
            });
    }
}