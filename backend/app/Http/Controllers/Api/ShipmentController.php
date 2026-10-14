<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ShipmentController extends Controller
{
    /**
     * null  = access all warehouses
     * array = restricted to these warehouse ids (may be empty)
     */
    private function allowedWarehouseIds(Request $request): ?array
    {
        /** @var User|null $user */
        $user = $request->user();
        if (! $user) {
            return [];
        }

        // Prefer explicit all-access flag (do NOT use accessibleWarehouseIds() for admins —
        // that method returns every warehouse id as a Collection, not null).
        if (method_exists($user, 'canAccessAllWarehouses') && $user->canAccessAllWarehouses()) {
            return null;
        }

        // Assigned warehouses only
        try {
            $ids = $user->warehouses()->pluck('warehouses.id');
        } catch (\Throwable $e) {
            $ids = collect();
        }

        // Normalize Collection / array → string[]
        if ($ids instanceof Collection) {
            $list = $ids->map(fn ($id) => (string) $id)->filter()->values()->all();
        } elseif (is_array($ids)) {
            $list = array_values(array_unique(array_map('strval', $ids)));
        } else {
            $list = [];
        }

        // Include primary warehouse_id if set
        if (! empty($user->warehouse_id)) {
            $list[] = (string) $user->warehouse_id;
            $list = array_values(array_unique($list));
        }

        return $list;
    }

    private function assertWarehouseAllowed(Request $request, ?string $warehouseId, string $action = 'access'): void
    {
        $allowed = $this->allowedWarehouseIds($request);
        if ($allowed === null) {
            return;
        }

        if ($warehouseId === null || $warehouseId === '') {
            abort(403, "A warehouse is required to {$action} this shipment.");
        }

        if (! in_array((string) $warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    private function applyWarehouseScope($query, Request $request)
    {
        $allowed = $this->allowedWarehouseIds($request);
        if ($allowed === null) {
            return $query;
        }

        if ($allowed === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('warehouse_id', $allowed);
    }

    public function index(Request $request)
    {
        $query = Shipment::with(['salesOrder.customer', 'warehouse'])
            ->orderByDesc('created_at');

        $query = $this->applyWarehouseScope($query, $request);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('shipment_number', 'ilike', "%{$search}%")
                    ->orWhere('tracking', 'ilike', "%{$search}%")
                    ->orWhere('carrier', 'ilike', "%{$search}%")
                    ->orWhereHas('salesOrder', function ($so) use ($search) {
                        $so->where('so_number', 'ilike', "%{$search}%");
                    });
            });
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $wid = (string) $request->warehouse_id;
            $allowed = $this->allowedWarehouseIds($request);
            if (is_array($allowed) && ! in_array($wid, $allowed, true)) {
                abort(403, 'Warehouse not assigned to this user.');
            }
            $query->where('warehouse_id', $wid);
        }

        return response()->json($query->paginate(20));
    }

    public function stats(Request $request)
    {
        $base = $this->applyWarehouseScope(Shipment::query(), $request);

        return response()->json([
            'all' => (clone $base)->count(),
            'open' => (clone $base)->whereIn('status', ['shipped', 'processing'])->count(),
            'delivered' => (clone $base)->where('status', 'completed')->count(),
            'packages' => (int) (clone $base)->sum('packages'),
        ]);
    }

    public function show(Request $request, string $id)
    {
        $shipment = Shipment::with(['salesOrder.customer', 'warehouse'])
            ->findOrFail($id);

        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'view');

        return response()->json($shipment);
    }

    public function store(Request $request, InventoryService $inventoryService)
    {
        $data = $request->validate([
            'sales_order_id' => ['required', 'uuid', 'exists:sales_orders,id'],
            'carrier' => ['required', 'string', 'max:100'],
            'tracking' => ['nullable', 'string', 'max:100'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'packages' => ['required', 'integer', 'min:1'],
            'date' => ['required', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['shipped', 'processing'])],
        ]);

        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            if (empty($data['warehouse_id'])) {
                abort(403, 'A warehouse is required to create a shipment.');
            }
            $this->assertWarehouseAllowed($request, (string) $data['warehouse_id'], 'create');
        }

        $shipment = DB::transaction(function () use ($data, $request, $inventoryService) {
            $salesOrder = SalesOrder::query()
                ->lockForUpdate()
                ->findOrFail($data['sales_order_id']);
            if ($salesOrder->status === 'cancelled') {
                abort(422, 'A cancelled sales order cannot be shipped.');
            }
            $this->assertCanAccessSalesOrderWarehouse($request, $salesOrder);
            if ($salesOrder->warehouse_id !== null
                && (string) $salesOrder->warehouse_id !== (string) $data['warehouse_id']) {
                throw ValidationException::withMessages([
                    'warehouse_id' => ['Shipment warehouse must match its sales order warehouse.'],
                ]);
            }
            $this->assertWithinSalesOrderLines($salesOrder, $data['lines']);

            $last = Shipment::withTrashed()->orderByDesc('created_at')->first();
            $seq = $last ? ((int) Str::after($last->shipment_number, 'SH-')) + 1 : 100;
            $data['shipment_number'] = 'SH-'.$seq;
            $data['status'] = $data['status'] ?? 'processing';

            $shipment = Shipment::create($data);
            $inventoryService->postDocumentLines(
                'OUT',
                $shipment->id,
                $shipment->shipment_number,
                $shipment->warehouse_id,
                $shipment->lines ?? [],
                $request->user()?->id,
                'qty',
                'sales-shipment'
            );
            $this->syncSalesOrderStatus($salesOrder);

            return $shipment;
        }, 3);
        $shipment->load(['salesOrder.customer', 'warehouse']);

        $this->notifyAll(
            'info',
            'Shipment created',
            "{$shipment->shipment_number} ready for carrier",
            '/shipping'
        );

        return response()->json($shipment, 201);
    }

    public function deliver(Request $request, string $id)
    {
        [$shipment, $wasDelivered] = DB::transaction(function () use ($request, $id) {
            $shipment = Shipment::lockForUpdate()->findOrFail($id);
            $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'update');
            if ($shipment->status === 'completed') {
                return [$shipment, true];
            }

            $shipment->update(['status' => 'completed']);
            $salesOrder = SalesOrder::query()
                ->lockForUpdate()
                ->findOrFail($shipment->sales_order_id);
            $this->syncSalesOrderStatus($salesOrder);

            return [$shipment->fresh(), false];
        }, 3);
        $shipment->load(['salesOrder.customer', 'warehouse']);

        if (! $wasDelivered) {
            $this->notifyAll(
                'success',
                'Shipment delivered',
                "{$shipment->shipment_number} marked completed",
                '/shipping'
            );
        }

        return response()->json([
            'message' => $wasDelivered ? 'Shipment already delivered' : 'Shipment delivered',
            'data' => $shipment,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $shipment = Shipment::findOrFail($id);
        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'update');

        if ($request->exists('status')) {
            abort(422, 'Use the delivery action to complete a shipment.');
        }

        $data = $request->validate([
            'carrier' => ['sometimes', 'string', 'max:100'],
            'tracking' => ['nullable', 'string', 'max:100'],
            'packages' => ['sometimes', 'integer', 'min:1'],
            'date' => ['sometimes', 'date'],
        ]);

        $shipment->update($data);
        $shipment = $shipment->fresh()->load(['salesOrder.customer', 'warehouse']);

        return response()->json($shipment);
    }

    public function destroy(Request $request, string $id)
    {
        $shipment = Shipment::findOrFail($id);
        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'delete');
        abort(409, 'A shipment with a posted stock issue cannot be deleted.');
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

    private function assertCanAccessSalesOrderWarehouse(Request $request, SalesOrder $salesOrder): void
    {
        $this->assertWarehouseAllowed($request, $salesOrder->warehouse_id, 'ship this sales order');
    }

    private function syncSalesOrderStatus(SalesOrder $salesOrder): void
    {
        $ordered = [];
        foreach ($salesOrder->lines ?? [] as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            if ($productId !== '') {
                $ordered[$productId] = ($ordered[$productId] ?? 0) + (float) ($line['qty'] ?? 0);
            }
        }

        $shipments = Shipment::query()
            ->where('sales_order_id', $salesOrder->id)
            ->get(['status', 'lines']);
        $shipped = [];
        foreach ($shipments as $shipment) {
            foreach ($shipment->lines ?? [] as $line) {
                $productId = (string) ($line['product_id'] ?? '');
                if ($productId !== '') {
                    $shipped[$productId] = ($shipped[$productId] ?? 0) + (float) ($line['qty'] ?? 0);
                }
            }
        }

        $fullyShipped = $ordered !== [];
        foreach ($ordered as $productId => $quantity) {
            if (($shipped[$productId] ?? 0) < $quantity) {
                $fullyShipped = false;
                break;
            }
        }

        $status = ! $fullyShipped
            ? 'processing'
            : ($shipments->every(fn (Shipment $shipment) => $shipment->status === 'completed') ? 'completed' : 'shipped');
        $salesOrder->update(['status' => $status]);
    }

    private function assertWithinSalesOrderLines(SalesOrder $salesOrder, array $shipmentLines): void
    {
        $ordered = [];
        foreach ($salesOrder->lines ?? [] as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            if ($productId !== '') {
                $ordered[$productId] = ($ordered[$productId] ?? 0) + (float) ($line['qty'] ?? 0);
            }
        }

        $alreadyShipped = [];
        Shipment::query()
            ->where('sales_order_id', $salesOrder->id)
            ->where('status', '!=', 'cancelled')
            ->get(['lines'])
            ->each(function (Shipment $shipment) use (&$alreadyShipped) {
                foreach ($shipment->lines ?? [] as $line) {
                    $productId = (string) ($line['product_id'] ?? '');
                    if ($productId !== '') {
                        $alreadyShipped[$productId] = ($alreadyShipped[$productId] ?? 0) + (float) ($line['qty'] ?? 0);
                    }
                }
            });

        $requested = [];
        foreach ($shipmentLines as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            $requested[$productId] = ($requested[$productId] ?? 0) + (float) ($line['qty'] ?? 0);
        }

        if ($ordered === []) {
            throw ValidationException::withMessages([
                'sales_order_id' => ['This sales order has no persisted product lines and cannot be shipped.'],
            ]);
        }
        foreach ($requested as $productId => $quantity) {
            if (! array_key_exists($productId, $ordered)
                || $quantity + ($alreadyShipped[$productId] ?? 0) > $ordered[$productId]) {
                throw ValidationException::withMessages([
                    'lines' => ['Shipment quantities cannot exceed the remaining sales order lines.'],
                ]);
            }
        }
    }
}
