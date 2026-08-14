<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CycleCount;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class CycleCountController extends Controller
{
    public function index(Request $request)
    {
        $query = CycleCount::with('warehouse')
            ->orderByDesc('scheduled_date')
            ->orderByDesc('created_at');

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($search = $request->query('search')) {
            $q = '%' . strtolower($search) . '%';
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

    public function stats()
    {
        $all = CycleCount::count();
        $pending = CycleCount::whereIn('status', ['pending', 'draft'])->count();
        $completed = CycleCount::where('status', 'completed')->get();
        $avgAcc = $completed->count()
            ? round($completed->avg('accuracy'), 1)
            : null;
        $openVar = $completed->filter(
            fn ($c) => $c->variance !== null && $c->variance !== '0' && $c->variance !== '—'
        )->count();

        return response()->json([
            'all'     => $all,
            'pending' => $pending,
            'avgAcc'  => $avgAcc,
            'openVar' => $openVar,
        ]);
    }

    public function show($id)
    {
        $count = CycleCount::with('warehouse')->findOrFail($id);
        return response()->json($count);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'warehouse_id'   => 'required|uuid|exists:warehouses,id',
            'zone'           => 'required|string|max:100',
            'scheduled_date' => 'required|date',
            'counter'        => 'nullable|string|max:150',
            'status'         => 'nullable|string|in:draft,pending,completed',
            'system_qty'     => 'nullable|numeric|min:0',
        ]);

        $count = CycleCount::create([
            'warehouse_id'   => $data['warehouse_id'],
            'zone'           => $data['zone'],
            'scheduled_date' => $data['scheduled_date'],
            'counter'        => $data['counter'] ?? 'Unassigned',
            'status'         => $data['status'] ?? 'pending',
            'system_qty'     => $data['system_qty'] ?? 0,
            'counted'        => 0,
            'variance'       => '—',
            'accuracy'       => null,
            'started_at'     => null,
            'ended_at'       => null,
        ]);

        $count->load('warehouse');

        $this->notifyAll(
            'info',
            'Cycle count scheduled',
            ($count->code ?? 'Count') . " for zone {$count->zone}",
            '/cycle-count'
        );

        return response()->json($count, 201);
    }

    public function update(Request $request, $id)
    {
        $count = CycleCount::findOrFail($id);
        $oldStatus = $count->status;

        $data = $request->validate([
            'warehouse_id'   => 'sometimes|uuid|exists:warehouses,id',
            'zone'           => 'sometimes|string|max:100',
            'scheduled_date' => 'sometimes|date',
            'started_at'     => 'nullable|string|max:20',
            'ended_at'       => 'nullable|string|max:20',
            'counted'        => 'nullable|numeric|min:0',
            'system_qty'     => 'nullable|numeric|min:0',
            'variance'       => 'nullable|string|max:20',
            'accuracy'       => 'nullable|numeric|min:0|max:100',
            'counter'        => 'nullable|string|max:150',
            'status'         => 'nullable|string|in:draft,pending,completed',
        ]);

        if (array_key_exists('counted', $data) || array_key_exists('system_qty', $data)) {
            $counted = $data['counted'] ?? $count->counted;
            $system  = $data['system_qty'] ?? $count->system_qty;

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
                $this->notifyAll(
                    'warning',
                    'Cycle count variance',
                    ($count->code ?? 'Count') . " ({$count->zone}) variance {$variance}",
                    '/cycle-count'
                );
            } else {
                $this->notifyAll(
                    'success',
                    'Cycle count completed',
                    ($count->code ?? 'Count') . " ({$count->zone}) completed with no variance",
                    '/cycle-count'
                );
            }
        } elseif (isset($data['status']) && $data['status'] !== $oldStatus) {
            $this->notifyAll(
                'info',
                'Cycle count updated',
                ($count->code ?? 'Count') . " is now {$data['status']}",
                '/cycle-count'
            );
        }

        return response()->json($count);
    }

    public function destroy($id)
    {
        $count = CycleCount::findOrFail($id);
        $count->delete();

        return response()->json([
            'message' => 'Cycle count deleted successfully',
        ]);
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