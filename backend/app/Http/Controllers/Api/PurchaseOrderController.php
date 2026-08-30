<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    private const STATS_CACHE_TTL = 20; // seconds

    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier:id,name', 'warehouse:id,code,name'])
            ->whereNull('deleted_at');

        // Non–access-all users only see POs for assigned warehouses
        $this->applyWarehouseScope($query, $request);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'ilike', "%{$search}%")
                  ->orWhereHas('supplier', function ($sq) use ($search) {
                      $sq->where('name', 'ilike', "%{$search}%");
                  });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('supplier_id') && $request->supplier_id !== 'all') {
            $query->where('supplier_id', $request->supplier_id);
        }

        $sort = $request->query('sort', 'order_date');
        $dir  = $request->query('dir', 'desc') === 'asc' ? 'asc' : 'desc';
        if (in_array($sort, ['po_number', 'order_date', 'total', 'status', 'created_at'], true)) {
            $query->orderBy($sort, $dir);
        } else {
            $query->orderByDesc('order_date');
        }

        $perPage = min((int) $request->query('per_page', 15), 100);

        return response()->json($query->paginate($perPage));
    }

    public function stats(Request $request)
    {
        $user = $request->user();
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            $payload = Cache::remember('purchase_orders:stats', self::STATS_CACHE_TTL, function () {
                return $this->computeStats(null);
            });

            return response()->json($payload);
        }

        $cacheKey = 'purchase_orders:stats:user:' . $user->id;
        $payload = Cache::remember($cacheKey, self::STATS_CACHE_TTL, function () use ($allowed) {
            return $this->computeStats($allowed);
        });

        return response()->json($payload);
    }

    public function show(Request $request, string $id)
    {
        $po = PurchaseOrder::with(['supplier', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $this->assertCanAccessPurchaseOrder($request->user(), $po);

        return response()->json($po);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'po_number'      => 'nullable|string|max:50|unique:purchase_orders,po_number',
            'supplier_id'    => 'required|uuid|exists:suppliers,id',
            'warehouse_id'   => 'nullable|uuid|exists:warehouses,id',
            'order_date'     => 'nullable|date',
            'expected_date'  => 'nullable|date',
            'reference'      => 'nullable|string|max:255',
            'notes'          => 'nullable|string|max:2000',
            'product_name'   => 'nullable|string|max:255',
            'items'          => 'nullable|numeric|min:0',
            'total'          => 'nullable|numeric|min:0',
            'status'         => ['nullable', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        $warehouseId = $validated['warehouse_id'] ?? null;
        if ($warehouseId !== null) {
            $this->assertCanAccessWarehouseId($request->user(), (string) $warehouseId);
        } else {
            $allowed = $this->allowedWarehouseIds($request->user());
            if (is_array($allowed)) {
                return response()->json([
                    'message' => 'warehouse_id is required for your account.',
                ], 422);
            }
        }

        $poNumber = $validated['po_number'] ?? null;
        if (empty($poNumber)) {
            $poNumber = $this->generatePoNumber();
        }

        $po = PurchaseOrder::create([
            'po_number'     => $poNumber,
            'supplier_id'   => $validated['supplier_id'],
            'warehouse_id'  => $validated['warehouse_id'] ?? null,
            'order_date'    => $validated['order_date'] ?? now()->toDateString(),
            'expected_date' => $validated['expected_date'] ?? null,
            'reference'     => $validated['reference'] ?? null,
            'notes'         => $validated['notes'] ?? null,
            'product_name'  => $validated['product_name'] ?? 'Product offer',
            'items'         => (int) max(1, round((float) ($validated['items'] ?? 1))),
            'total'         => (float) ($validated['total'] ?? 0),
            'status'        => $validated['status'] ?? 'pending',
        ]);

        $po->load(['supplier:id,name', 'warehouse:id,code,name']);
        $this->forgetStatsCache($request->user());

        try {
            $this->notifyAll(
                'info',
                'Purchase order created',
                ($po->po_number ?? 'PO') . ' was created',
                '/purchase-orders'
            );
        } catch (\Throwable $e) {
            Log::warning('PO notifyAll failed: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Purchase order created',
            'data'    => $po,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $po = PurchaseOrder::whereNull('deleted_at')->findOrFail($id);
        $this->assertCanAccessPurchaseOrder($request->user(), $po);

        $oldStatus = $po->status;

        $validated = $request->validate([
            'supplier_id'    => 'sometimes|uuid|exists:suppliers,id',
            'warehouse_id'   => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date'     => 'sometimes|date',
            'expected_date'  => 'sometimes|nullable|date',
            'reference'      => 'sometimes|nullable|string|max:255',
            'notes'          => 'sometimes|nullable|string|max:2000',
            'items'          => 'sometimes|numeric|min:0',
            'total'          => 'sometimes|numeric|min:0',
            'status'         => ['sometimes', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        if (array_key_exists('warehouse_id', $validated) && $validated['warehouse_id'] !== null) {
            $this->assertCanAccessWarehouseId($request->user(), (string) $validated['warehouse_id']);
        }

        if (array_key_exists('items', $validated)) {
            $validated['items'] = (int) max(1, round((float) $validated['items']));
        }
        if (array_key_exists('total', $validated)) {
            $validated['total'] = (float) $validated['total'];
        }

        $po->update($validated);
        $po->load(['supplier:id,name', 'warehouse:id,code,name']);
        $this->forgetStatsCache($request->user());

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'received'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            try {
                $this->notifyAll(
                    $type,
                    'Purchase order updated',
                    ($po->po_number ?? 'PO') . " is now {$validated['status']}",
                    '/purchase-orders'
                );
            } catch (\Throwable $e) {
                Log::warning('PO notifyAll failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Purchase order updated',
            'data'    => $po,
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $po = PurchaseOrder::whereNull('deleted_at')->findOrFail($id);
        $this->assertCanAccessPurchaseOrder($request->user(), $po);

        $po->delete();
        $this->forgetStatsCache($request->user());

        return response()->json(['message' => 'Purchase order deleted']);
    }

    /* ─────────────────────────────────────────────
     |  WAREHOUSE SCOPE
     ───────────────────────────────────────────── */

    /**
     * @return list<string>|null  null = all warehouses
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

    private function applyWarehouseScope($query, Request $request): void
    {
        $allowed = $this->allowedWarehouseIds($request->user());

        if ($allowed === null) {
            return;
        }

        if ($allowed === []) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $requested = (string) $request->warehouse_id;
            if (!in_array($requested, $allowed, true)) {
                abort(403, 'You do not have access to this warehouse.');
            }
            return;
        }

        $query->whereIn('warehouse_id', $allowed);
    }

    private function assertCanAccessPurchaseOrder(?User $user, PurchaseOrder $po): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        $wid = $po->warehouse_id !== null ? (string) $po->warehouse_id : null;

        if ($wid === null || !in_array($wid, $allowed, true)) {
            abort(403, 'You do not have access to this purchase order warehouse.');
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
     * @param  list<string>|null  $allowedWarehouseIds
     */
    private function computeStats(?array $allowedWarehouseIds): array
    {
        $query = PurchaseOrder::query()->whereNull('deleted_at');

        if (is_array($allowedWarehouseIds)) {
            if ($allowedWarehouseIds === []) {
                return [
                    'all'         => 0,
                    'pending'     => 0,
                    'done'        => 0,
                    'total_value' => 0.0,
                ];
            }
            $query->whereIn('warehouse_id', $allowedWarehouseIds);
        }

        $row = $query
            ->selectRaw("
                COUNT(*) as all_count,
                COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status IN ('completed','received','shipped') THEN 1 ELSE 0 END), 0) as done,
                COALESCE(SUM(total), 0) as total_value
            ")
            ->first();

        return [
            'all'         => (int) ($row->all_count ?? 0),
            'pending'     => (int) ($row->pending ?? 0),
            'done'        => (int) ($row->done ?? 0),
            'total_value' => (float) ($row->total_value ?? 0),
        ];
    }

    private function forgetStatsCache(?User $user): void
    {
        Cache::forget('purchase_orders:stats');
        if ($user) {
            Cache::forget('purchase_orders:stats:user:' . $user->id);
        }
    }

    private function generatePoNumber(): string
    {
        $prefix = 'PO-' . now()->format('Ymd') . '-';
        for ($i = 0; $i < 8; $i++) {
            $candidate = $prefix . strtoupper(Str::random(4));
            if (!PurchaseOrder::where('po_number', $candidate)->exists()) {
                return $candidate;
            }
        }
        return $prefix . strtoupper(Str::random(8));
    }

    private function notifyAll(string $type, string $title, string $message, string $page): void
    {
        User::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->select('id')
            ->chunkById(100, function ($users) use ($type, $title, $message, $page) {
                foreach ($users as $user) {
                    Notification::create([
                        'user_id' => $user->id,
                        'type'    => $type,
                        'title'   => $title,
                        'message' => $message,
                        'page'    => $page,
                        'is_read' => false,
                    ]);
                }
            });
    }
}