<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CycleCount;
use App\Models\Inventory;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CycleCountController extends Controller
{
    public function index(Request $request)
    {
        $query = CycleCount::with('warehouse')
            ->orderByDesc('scheduled_date')
            ->orderByDesc('created_at');
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            $query->whereIn('warehouse_id', $allowed);
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($search = $request->query('search')) {
            $q = '%'.strtolower($search).'%';
            $query->where(function ($builder) use ($q) {
                $builder->whereRaw('LOWER(code) LIKE ?', [$q])
                    ->orWhereRaw('LOWER(zone) LIKE ?', [$q])
                    ->orWhereRaw('LOWER(counter) LIKE ?', [$q])
                    ->orWhereHas('warehouse', function ($w) use ($q) {
                        $w->whereRaw('LOWER(code) LIKE ?', [$q])
                            ->orWhereRaw('LOWER(name) LIKE ?', [$q]);
                    });
            });
        }

        return response()->json($query->get());
    }

    public function stats(Request $request)
    {
        $base = CycleCount::query();
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            $base->whereIn('warehouse_id', $allowed);
        }
        $all = (clone $base)->count();
        $pending = (clone $base)->whereIn('status', ['pending', 'draft'])->count();
        $completed = (clone $base)->where('status', 'completed');
        $averageAccuracy = (clone $completed)->whereNotNull('accuracy')->avg('accuracy');
        $avgAcc = $averageAccuracy !== null ? round((float) $averageAccuracy, 1) : null;
        $openVar = (clone $completed)
            ->whereNotNull('variance')
            ->where('variance', '!=', 0)
            ->count();

        return response()->json([
            'all' => $all,
            'pending' => $pending,
            'avgAcc' => $avgAcc,
            'openVar' => $openVar,
        ]);
    }

    public function show(Request $request, $id)
    {
        $count = CycleCount::with('warehouse')->findOrFail($id);
        $this->assertWarehouseAllowed($request, (string) $count->warehouse_id);

        return response()->json($count);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'warehouse_id' => 'required|uuid|exists:warehouses,id',
            'zone' => 'required|string|max:100',
            'scheduled_date' => 'required|date',
            'counter' => 'nullable|string|max:150',
            'status' => 'nullable|string|in:draft,pending',
        ]);
        $this->assertWarehouseAllowed($request, (string) $data['warehouse_id']);
        $data['system_qty'] = (float) Inventory::query()
            ->where('warehouse_id', $data['warehouse_id'])
            ->sum('qty');

        $count = CycleCount::create([
            'warehouse_id' => $data['warehouse_id'],
            'zone' => $data['zone'],
            'scheduled_date' => $data['scheduled_date'],
            'counter' => $data['counter'] ?? 'Unassigned',
            'status' => $data['status'] ?? 'pending',
            'system_qty' => $data['system_qty'] ?? 0,
            'counted' => 0,
            'variance' => null,
            'accuracy' => null,
            'started_at' => null,
            'ended_at' => null,
        ]);

        $count->load('warehouse');

        $this->notifyWarehouseUsers(
            (string) $count->warehouse_id,
            'info',
            'Cycle count scheduled',
            ($count->code ?? 'Count')." for zone {$count->zone}",
            '/cycle-count'
        );

        return response()->json($count, 201);
    }

    public function update(Request $request, $id)
    {
        $count = CycleCount::findOrFail($id);
        $this->assertWarehouseAllowed($request, (string) $count->warehouse_id);
        $oldStatus = $count->status;

        $data = $request->validate([
            'zone' => 'sometimes|string|max:100',
            'scheduled_date' => 'sometimes|date',
            'started_at' => 'nullable|string|max:20',
            'ended_at' => 'nullable|string|max:20',
            'counted' => 'nullable|numeric|min:0',
            'variance' => 'nullable|string|max:20',
            'accuracy' => 'nullable|numeric|min:0|max:100',
            'counter' => 'nullable|string|max:150',
            'status' => 'nullable|string|in:draft,pending,completed',
        ]);

        if ($request->hasAny(['system_qty', 'variance', 'accuracy'])) {
            abort(422, 'System quantity, variance, and accuracy are calculated by the server.');
        }

        foreach (['started_at', 'ended_at'] as $timeField) {
            if (! array_key_exists($timeField, $data) || $data[$timeField] === null) {
                continue;
            }

            if (preg_match('/^\d{2}:\d{2}(?::\d{2})?$/', $data[$timeField])) {
                $data[$timeField] = Carbon::today()->setTimeFromTimeString($data[$timeField]);
            }
        }

        if (array_key_exists('counted', $data)) {
            $counted = $data['counted'] ?? $count->counted;
            $system = $count->system_qty;

            if ($system > 0 || $counted > 0) {
                $diff = $counted - $system;
                $data['variance'] = $diff > 0 ? "+{$diff}" : (string) $diff;
                $data['accuracy'] = $system > 0
                    ? round((1 - abs($diff) / $system) * 100, 1)
                    : ($counted == 0 ? 100 : null);
            }
        }

        $count->update($data);
        $count = $count->fresh()->load('warehouse');

        $newStatus = $count->status;
        if ($newStatus === 'completed' && $oldStatus !== 'completed') {
            $variance = $count->variance;
            if ($variance !== null && $variance !== '0' && $variance !== '—') {
                $this->notifyWarehouseUsers(
                    (string) $count->warehouse_id,
                    'warning',
                    'Cycle count variance',
                    ($count->code ?? 'Count')." ({$count->zone}) variance {$variance}",
                    '/cycle-count'
                );
            } else {
                $this->notifyWarehouseUsers(
                    (string) $count->warehouse_id,
                    'success',
                    'Cycle count completed',
                    ($count->code ?? 'Count')." ({$count->zone}) completed with no variance",
                    '/cycle-count'
                );
            }
        } elseif (isset($data['status']) && $data['status'] !== $oldStatus) {
            $this->notifyWarehouseUsers(
                (string) $count->warehouse_id,
                'info',
                'Cycle count updated',
                ($count->code ?? 'Count')." is now {$data['status']}",
                '/cycle-count'
            );
        }

        return response()->json($count);
    }

    public function destroy(Request $request, $id)
    {
        $count = CycleCount::findOrFail($id);
        $this->assertWarehouseAllowed($request, (string) $count->warehouse_id);
        $count->delete();

        return response()->json([
            'message' => 'Cycle count deleted successfully',
        ]);
    }

    private function allowedWarehouseIds(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) {
            return [];
        }
        if ($user->canAccessAllWarehouses()) {
            return null;
        }

        $ids = $user->warehouses()->pluck('warehouses.id')->map(fn ($id) => (string) $id)->all();
        if ($user->warehouse_id) {
            $ids[] = (string) $user->warehouse_id;
        }

        return array_values(array_unique($ids));
    }

    private function assertWarehouseAllowed(Request $request, string $warehouseId): void
    {
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed) && ! in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
    }

    private function notifyWarehouseUsers(
        string $warehouseId,
        string $type,
        string $title,
        string $message,
        string $page
    ): void {
        User::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->where(function ($query) use ($warehouseId) {
                $query->where('access_all_warehouses', true)
                    ->orWhere('warehouse_id', $warehouseId)
                    ->orWhereHas('warehouses', fn ($warehouses) => $warehouses->where('warehouses.id', $warehouseId))
                    ->orWhereHas('role', fn ($role) => $role->whereRaw('LOWER(name) = ?', ['admin']));
            })
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
