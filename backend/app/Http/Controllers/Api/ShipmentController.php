<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ShipmentController extends Controller
{
    /**
     * null  = access all warehouses
     * array = restricted to these warehouse ids (may be empty)
     */
    private function allowedWarehouseIds(Request $request): ?array
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if (!$user) {
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
        if ($ids instanceof \Illuminate\Support\Collection) {
            $list = $ids->map(fn ($id) => (string) $id)->filter()->values()->all();
        } elseif (is_array($ids)) {
            $list = array_values(array_unique(array_map('strval', $ids)));
        } else {
            $list = [];
        }

        // Include primary warehouse_id if set
        if (!empty($user->warehouse_id)) {
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

        if (!in_array((string) $warehouseId, $allowed, true)) {
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
            if (is_array($allowed) && !in_array($wid, $allowed, true)) {
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
            'all'       => (clone $base)->count(),
            'open'      => (clone $base)->whereIn('status', ['shipped', 'processing'])->count(),
            'delivered' => (clone $base)->where('status', 'completed')->count(),
            'packages'  => (int) (clone $base)->sum('packages'),
        ]);
    }

    public function show(Request $request, string $id)
    {
        $shipment = Shipment::with(['salesOrder.customer', 'warehouse'])
            ->findOrFail($id);

        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'view');

        return response()->json($shipment);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sales_order_id' => ['required', 'uuid', 'exists:sales_orders,id'],
            'carrier'        => ['required', 'string', 'max:100'],
            'tracking'       => ['nullable', 'string', 'max:100'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'packages'       => ['required', 'integer', 'min:1'],
            'date'           => ['required', 'date'],
            'status'         => ['nullable', Rule::in(['shipped', 'processing', 'completed'])],
        ]);

        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            if (empty($data['warehouse_id'])) {
                abort(403, 'A warehouse is required to create a shipment.');
            }
            $this->assertWarehouseAllowed($request, (string) $data['warehouse_id'], 'create');
        }

        $last = Shipment::withTrashed()->orderByDesc('created_at')->first();
        $seq  = $last ? ((int) Str::after($last->shipment_number, 'SH-')) + 1 : 100;
        $data['shipment_number'] = 'SH-' . $seq;
        $data['status'] = $data['status'] ?? 'processing';

        $shipment = Shipment::create($data);
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
        $shipment = Shipment::findOrFail($id);
        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'update');

        if ($shipment->status === 'completed') {
            return response()->json(['message' => 'Shipment already delivered'], 422);
        }

        $shipment->update(['status' => 'completed']);
        $shipment = $shipment->fresh()->load(['salesOrder.customer', 'warehouse']);

        $this->notifyAll(
            'success',
            'Shipment delivered',
            "{$shipment->shipment_number} marked completed",
            '/shipping'
        );

        return response()->json($shipment);
    }

    public function update(Request $request, string $id)
    {
        $shipment = Shipment::findOrFail($id);
        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'update');

        $oldStatus = $shipment->status;

        $data = $request->validate([
            'sales_order_id' => ['sometimes', 'uuid', 'exists:sales_orders,id'],
            'carrier'        => ['sometimes', 'string', 'max:100'],
            'tracking'       => ['nullable', 'string', 'max:100'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'packages'       => ['sometimes', 'integer', 'min:1'],
            'date'           => ['sometimes', 'date'],
            'status'         => ['sometimes', Rule::in(['shipped', 'processing', 'completed'])],
        ]);

        if (array_key_exists('warehouse_id', $data) && $data['warehouse_id']) {
            $this->assertWarehouseAllowed($request, (string) $data['warehouse_id'], 'update');
        }

        $shipment->update($data);
        $shipment = $shipment->fresh()->load(['salesOrder.customer', 'warehouse']);

        if (isset($data['status']) && $data['status'] !== $oldStatus) {
            $type = $data['status'] === 'completed' ? 'success' : 'info';
            $this->notifyAll(
                $type,
                'Shipment updated',
                "{$shipment->shipment_number} is now {$data['status']}",
                '/shipping'
            );
        }

        return response()->json($shipment);
    }

    public function destroy(Request $request, string $id)
    {
        $shipment = Shipment::findOrFail($id);
        $this->assertWarehouseAllowed($request, $shipment->warehouse_id ? (string) $shipment->warehouse_id : null, 'delete');
        $shipment->delete();

        return response()->json(null, 204);
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