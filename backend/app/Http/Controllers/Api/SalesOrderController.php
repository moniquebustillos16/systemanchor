<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\ReturnModel;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SalesOrderController extends Controller
{
    private const STATS_CACHE_TTL = 20; // seconds

    public function index(Request $request)
    {
        $query = SalesOrder::with(['customer:id,name', 'warehouse:id,code,name'])
            ->whereNull('deleted_at');

        // Non–access-all users only see SOs for their assigned warehouses
        $this->applyWarehouseScope($query, $request);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('so_number', 'ilike', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        $sort = $request->query('sort', 'order_date');
        $dir = $request->query('dir', 'desc') === 'asc' ? 'asc' : 'desc';
        if (in_array($sort, ['so_number', 'order_date', 'total', 'status', 'created_at'], true)) {
            $query->orderBy($sort, $dir);
        } else {
            $query->orderByDesc('order_date');
        }

        $perPage = min((int) $request->query('per_page', 15), 100);

        $page = $query->paginate($perPage);
        $orders = $page->getCollection();
        $orderIds = $orders->pluck('id')->all();
        $shippedByOrder = [];
        $returnedByOrder = [];
        $shipmentRows = collect();

        if ($orderIds !== []) {
            $shipmentRows = Shipment::query()
                ->whereIn('sales_order_id', $orderIds)
                ->where('status', '!=', 'cancelled')
                ->get(['sales_order_id', 'lines']);
            foreach ($shipmentRows as $shipment) {
                foreach ($shipment->lines ?? [] as $line) {
                    $productId = (string) ($line['product_id'] ?? '');
                    if ($productId !== '') {
                        $key = $shipment->sales_order_id.'|'.$productId;
                        $shippedByOrder[$key] = ($shippedByOrder[$key] ?? 0) + (float) ($line['qty'] ?? 0);
                    }
                }
            }

            foreach (ReturnModel::query()
                ->whereIn('sales_order_id', $orderIds)
                ->get(['sales_order_id', 'lines']) as $return) {
                foreach ($return->lines ?? [] as $line) {
                    $productId = (string) ($line['product_id'] ?? '');
                    if ($productId !== '') {
                        $key = $return->sales_order_id.'|'.$productId;
                        $returnedByOrder[$key] = ($returnedByOrder[$key] ?? 0) + (float) ($line['qty'] ?? 0);
                    }
                }
            }
        }

        $orders->each(function (SalesOrder $order) use ($shipmentRows, $shippedByOrder, $returnedByOrder) {
            $orderLines = collect($order->lines ?? [])
                ->filter(fn ($line) => ! empty($line['product_id']))
                ->groupBy(fn ($line) => (string) $line['product_id']);
            $orderShipments = $shipmentRows->where('sales_order_id', $order->id);
            $hasShipmentLines = $orderShipments->contains(
                fn (Shipment $shipment) => ! empty($shipment->lines)
            );
            $canInferSingleLegacyShipment = ! $hasShipmentLines
                && $orderShipments->count() === 1
                && empty($orderShipments->first()?->lines);
            $hasAmbiguousLegacyShipment = ! $canInferSingleLegacyShipment
                && $orderShipments->contains(fn (Shipment $shipment) => empty($shipment->lines));

            $transactionLines = $orderLines->map(function ($lines, $productId) use (
                $order,
                $canInferSingleLegacyShipment,
                $hasAmbiguousLegacyShipment,
                $shippedByOrder,
                $returnedByOrder
            ) {
                $orderedQty = (float) $lines->sum(fn ($line) => (float) ($line['qty'] ?? 0));
                $key = $order->id.'|'.$productId;
                $shippedQty = $shippedByOrder[$key]
                    ?? ($canInferSingleLegacyShipment ? $orderedQty : 0.0);
                $returnedQty = $returnedByOrder[$key] ?? 0.0;
                $firstLine = $lines->first();

                return [
                    'product_id' => (string) $productId,
                    'product_name' => $firstLine['product_name'] ?? $firstLine['name'] ?? null,
                    'ordered_qty' => $orderedQty,
                    'shipped_qty' => $shippedQty,
                    'returned_qty' => $returnedQty,
                    'remaining_to_ship' => $hasAmbiguousLegacyShipment
                        ? 0
                        : max(0, $orderedQty - $shippedQty),
                    'remaining_to_return' => $hasAmbiguousLegacyShipment
                        ? 0
                        : max(0, $shippedQty - $returnedQty),
                ];
            })->values()->all();

            $order->setAttribute('transaction_lines', $transactionLines);
        });

        return response()->json($page);
    }

    /**
     * Scoped stats for non–access-all users; global cache only for full-access users.
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            $payload = Cache::remember('sales_orders:stats', self::STATS_CACHE_TTL, function () {
                return $this->computeStats(null);
            });

            return response()->json($payload);
        }

        $cacheKey = 'sales_orders:stats:user:'.$user->id;
        $payload = Cache::remember($cacheKey, self::STATS_CACHE_TTL, function () use ($allowed) {
            return $this->computeStats($allowed);
        });

        return response()->json($payload);
    }

    public function show(Request $request, string $id)
    {
        $so = SalesOrder::with(['customer', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $this->assertCanAccessSalesOrder($request->user(), $so);

        return response()->json($so);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'so_number' => 'nullable|string|max:50|unique:sales_orders,so_number',
            'customer_id' => 'required|uuid|exists:customers,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'order_date' => 'nullable|date',
            'expected_date' => 'nullable|date',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'items' => 'nullable|numeric|min:0',
            'total' => 'nullable|numeric|min:0',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'required|uuid|exists:products,id',
            'lines.*.product_name' => 'nullable|string|max:255',
            'lines.*.qty' => 'required|numeric|gt:0',
            'lines.*.unit_price' => 'nullable|numeric|min:0',
            'status' => ['nullable', Rule::in([
                'pending', 'processing', 'cancelled',
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

        $soNumber = $validated['so_number'] ?? null;
        if (empty($soNumber)) {
            $soNumber = $this->generateSoNumber();
        }

        $so = SalesOrder::create([
            'so_number' => $soNumber,
            'customer_id' => $validated['customer_id'],
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'order_date' => $validated['order_date'] ?? now()->toDateString(),
            'expected_date' => $validated['expected_date'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'items' => (int) max(1, round((float) ($validated['items'] ?? 1))),
            'total' => (float) ($validated['total'] ?? 0),
            'lines' => $validated['lines'],
            'status' => $validated['status'] ?? 'pending',
        ]);

        $so->load(['customer:id,name', 'warehouse:id,code,name']);
        $this->forgetStatsCache($request->user());

        try {
            $this->notifyAll(
                'info',
                'Sales order created',
                ($so->so_number ?? 'SO').' was created',
                '/sales-orders'
            );
        } catch (\Throwable $e) {
            Log::warning('SO notifyAll failed: '.$e->getMessage());
        }

        return response()->json([
            'message' => 'Sales order created',
            'data' => $so,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $so = SalesOrder::whereNull('deleted_at')->findOrFail($id);
        $this->assertCanAccessSalesOrder($request->user(), $so);

        if ($request->exists('warehouse_id')
            && (string) $request->input('warehouse_id') !== (string) $so->warehouse_id
            && Shipment::query()->where('sales_order_id', $so->id)->exists()) {
            abort(409, 'A sales order warehouse cannot change after a shipment has been created.');
        }

        if ($request->exists('lines')) {
            abort(409, 'Sales order product lines are immutable after creation.');
        }
        if ($request->input('status') === 'cancelled' && Shipment::query()
            ->where('sales_order_id', $so->id)
            ->exists()) {
            abort(409, 'A sales order with posted shipments cannot be cancelled.');
        }

        $oldStatus = $so->status;

        $validated = $request->validate([
            'customer_id' => 'sometimes|uuid|exists:customers,id',
            'warehouse_id' => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date' => 'sometimes|date',
            'expected_date' => 'sometimes|nullable|date',
            'reference' => 'sometimes|nullable|string|max:255',
            'notes' => 'sometimes|nullable|string|max:2000',
            'items' => 'sometimes|numeric|min:0',
            'total' => 'sometimes|numeric|min:0',
            'status' => ['sometimes', Rule::in([
                'pending', 'processing', 'cancelled',
            ])],
        ]);

        if (array_key_exists('warehouse_id', $validated)) {
            if ($validated['warehouse_id'] === null && is_array($this->allowedWarehouseIds($request->user()))) {
                abort(422, 'A warehouse is required for your account.');
            }
            if ($validated['warehouse_id'] !== null) {
                $this->assertCanAccessWarehouseId($request->user(), (string) $validated['warehouse_id']);
            }
        }

        if (array_key_exists('items', $validated)) {
            $validated['items'] = (int) max(1, round((float) $validated['items']));
        }
        if (array_key_exists('total', $validated)) {
            $validated['total'] = (float) $validated['total'];
        }

        $so->update($validated);
        $so->load(['customer:id,name', 'warehouse:id,code,name']);
        $this->forgetStatsCache($request->user());

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'shipped'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            try {
                $this->notifyAll(
                    $type,
                    'Sales order updated',
                    ($so->so_number ?? 'SO')." is now {$validated['status']}",
                    '/sales-orders'
                );
            } catch (\Throwable $e) {
                Log::warning('SO notifyAll failed: '.$e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Sales order updated',
            'data' => $so,
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $so = SalesOrder::whereNull('deleted_at')->findOrFail($id);
        $this->assertCanAccessSalesOrder($request->user(), $so);
        if (Shipment::query()->where('sales_order_id', $so->id)->exists()) {
            abort(409, 'A sales order with posted shipments cannot be deleted.');
        }

        $so->delete();
        $this->forgetStatsCache($request->user());

        return response()->json(['message' => 'Sales order deleted']);
    }

    /* ─────────────────────────────────────────────
     |  WAREHOUSE SCOPE
     ───────────────────────────────────────────── */

    /**
     * null  = access all warehouses
     * array = only these warehouse UUIDs
     *
     * @return list<string>|null
     */
    private function allowedWarehouseIds(?User $user): ?array
    {
        if (! $user) {
            return [];
        }

        if (method_exists($user, 'canAccessAllWarehouses') && $user->canAccessAllWarehouses()) {
            return null;
        }

        if (! empty($user->access_all_warehouses)) {
            return null;
        }

        $ids = [];

        if (method_exists($user, 'warehouses')) {
            $ids = $user->warehouses()
                ->pluck('warehouses.id')
                ->map(fn ($id) => (string) $id)
                ->all();
        }

        if (! empty($user->warehouse_id)) {
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
            if (! in_array($requested, $allowed, true)) {
                abort(403, 'You do not have access to this warehouse.');
            }

            return;
        }

        $query->whereIn('warehouse_id', $allowed);
    }

    private function assertCanAccessSalesOrder(?User $user, SalesOrder $so): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        $wid = $so->warehouse_id !== null ? (string) $so->warehouse_id : null;

        if ($wid === null || ! in_array($wid, $allowed, true)) {
            abort(403, 'You do not have access to this sales order warehouse.');
        }
    }

    private function assertCanAccessWarehouseId(?User $user, string $warehouseId): void
    {
        $allowed = $this->allowedWarehouseIds($user);

        if ($allowed === null) {
            return;
        }

        if (! in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    /**
     * @param  list<string>|null  $allowedWarehouseIds
     */
    private function computeStats(?array $allowedWarehouseIds): array
    {
        $query = SalesOrder::query()->whereNull('deleted_at');

        if (is_array($allowedWarehouseIds)) {
            if ($allowedWarehouseIds === []) {
                return [
                    'all' => 0,
                    'pending' => 0,
                    'done' => 0,
                    'total_value' => 0.0,
                ];
            }
            $query->whereIn('warehouse_id', $allowedWarehouseIds);
        }

        $row = $query
            ->selectRaw("
                COUNT(*) as all_count,
                COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status IN ('completed','shipped') THEN 1 ELSE 0 END), 0) as done,
                COALESCE(SUM(total), 0) as total_value
            ")
            ->first();

        return [
            'all' => (int) ($row->all_count ?? 0),
            'pending' => (int) ($row->pending ?? 0),
            'done' => (int) ($row->done ?? 0),
            'total_value' => (float) ($row->total_value ?? 0),
        ];
    }

    private function forgetStatsCache(?User $user): void
    {
        Cache::forget('sales_orders:stats');
        if ($user) {
            Cache::forget('sales_orders:stats:user:'.$user->id);
        }
    }

    private function generateSoNumber(): string
    {
        $prefix = 'SO-'.now()->format('Ymd').'-';
        for ($i = 0; $i < 8; $i++) {
            $candidate = $prefix.strtoupper(Str::random(4));
            if (! SalesOrder::where('so_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $prefix.strtoupper(Str::random(8));
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
                        'type' => $type,
                        'title' => $title,
                        'message' => $message,
                        'page' => $page,
                        'is_read' => false,
                    ]);
                }
            });
    }
}
