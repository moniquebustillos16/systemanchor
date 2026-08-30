<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\ReturnModel;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReturnController extends Controller
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
            abort(403, "A warehouse is required to {$action} this return.");
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
        $query = ReturnModel::with(['salesOrder.customer', 'warehouse'])
            ->orderByDesc('created_at');

        $query = $this->applyWarehouseScope($query, $request);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('return_number', 'ilike', "%{$search}%")
                  ->orWhere('reason', 'ilike', "%{$search}%")
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
        $base = $this->applyWarehouseScope(ReturnModel::query(), $request);

        return response()->json([
            'all'    => (clone $base)->count(),
            'open'   => (clone $base)->whereIn('status', ['pending', 'processing'])->count(),
            'closed' => (clone $base)->where('status', 'completed')->count(),
            'items'  => (int) (clone $base)->sum('items'),
        ]);
    }

    public function show(Request $request, string $id)
    {
        $return = ReturnModel::with(['salesOrder.customer', 'warehouse'])
            ->findOrFail($id);

        $this->assertWarehouseAllowed($request, $return->warehouse_id ? (string) $return->warehouse_id : null, 'view');

        return response()->json($return);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sales_order_id' => ['required', 'uuid', 'exists:sales_orders,id'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'reason'         => ['required', 'string', 'max:100'],
            'disposition'    => ['required', 'string', 'max:100'],
            'items'          => ['required', 'integer', 'min:1'],
            'date'           => ['required', 'date'],
            'status'         => ['nullable', Rule::in(['pending', 'processing', 'completed'])],
        ]);

        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            if (empty($data['warehouse_id'])) {
                abort(403, 'A warehouse is required to create a return.');
            }
            $this->assertWarehouseAllowed($request, (string) $data['warehouse_id'], 'create');
        }

        $last = ReturnModel::withTrashed()->orderByDesc('created_at')->first();
        $seq  = $last ? ((int) Str::after($last->return_number, 'RT-')) + 1 : 100;
        $data['return_number'] = 'RT-' . $seq;
        $data['status'] = $data['status'] ?? 'processing';

        $return = ReturnModel::create($data);
        $return->load(['salesOrder.customer', 'warehouse']);

        $this->notifyAll(
            'info',
            'Return created',
            "{$return->return_number} opened ({$return->reason})",
            '/returns'
        );

        return response()->json($return, 201);
    }

    public function update(Request $request, string $id)
    {
        $return = ReturnModel::findOrFail($id);
        $this->assertWarehouseAllowed($request, $return->warehouse_id ? (string) $return->warehouse_id : null, 'update');

        $oldStatus = $return->status;

        $data = $request->validate([
            'sales_order_id' => ['sometimes', 'uuid', 'exists:sales_orders,id'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'reason'         => ['sometimes', 'string', 'max:100'],
            'disposition'    => ['sometimes', 'string', 'max:100'],
            'items'          => ['sometimes', 'integer', 'min:1'],
            'date'           => ['sometimes', 'date'],
            'status'         => ['sometimes', Rule::in(['pending', 'processing', 'completed'])],
        ]);

        if (array_key_exists('warehouse_id', $data) && $data['warehouse_id']) {
            $this->assertWarehouseAllowed($request, (string) $data['warehouse_id'], 'update');
        }

        $return->update($data);
        $return = $return->fresh()->load(['salesOrder.customer', 'warehouse']);

        if (isset($data['status']) && $data['status'] !== $oldStatus) {
            $type = $data['status'] === 'completed' ? 'success' : 'info';
            $this->notifyAll(
                $type,
                'Return updated',
                "{$return->return_number} is now {$data['status']}",
                '/returns'
            );
        }

        return response()->json($return);
    }

    public function complete(Request $request, string $id)
    {
        $return = ReturnModel::findOrFail($id);
        $this->assertWarehouseAllowed($request, $return->warehouse_id ? (string) $return->warehouse_id : null, 'update');

        if ($return->status === 'completed') {
            return response()->json(['message' => 'RMA already closed'], 422);
        }

        $return->update(['status' => 'completed']);
        $return = $return->fresh()->load(['salesOrder.customer', 'warehouse']);

        $this->notifyAll(
            'success',
            'Return closed',
            "{$return->return_number} marked completed",
            '/returns'
        );

        return response()->json($return);
    }

    public function destroy(Request $request, string $id)
    {
        $return = ReturnModel::findOrFail($id);
        $this->assertWarehouseAllowed($request, $return->warehouse_id ? (string) $return->warehouse_id : null, 'delete');
        $return->delete();

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