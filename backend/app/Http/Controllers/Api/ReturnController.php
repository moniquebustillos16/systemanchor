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
    public function index(Request $request)
    {
        $query = ReturnModel::with(['salesOrder.customer', 'warehouse'])
            ->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('return_number', 'ilike', "%{$search}%")
                  ->orWhere('reason', 'ilike', "%{$search}%")
                  ->orWhere('disposition', 'ilike', "%{$search}%")
                  ->orWhereHas('salesOrder', function ($so) use ($search) {
                      $so->where('so_number', 'ilike', "%{$search}%");
                  })
                  ->orWhereHas('salesOrder.customer', function ($c) use ($search) {
                      $c->where('name', 'ilike', "%{$search}%");
                  });
            });
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        return response()->json($query->paginate(20));
    }

    public function stats()
    {
        return response()->json([
            'all'    => ReturnModel::count(),
            'open'   => ReturnModel::whereIn('status', ['pending', 'processing'])->count(),
            'closed' => ReturnModel::where('status', 'completed')->count(),
            'items'  => (int) ReturnModel::sum('items'),
        ]);
    }

    public function show(string $id)
    {
        $return = ReturnModel::with(['salesOrder.customer', 'warehouse'])
            ->findOrFail($id);

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

    public function complete(string $id)
    {
        $return = ReturnModel::findOrFail($id);

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

    public function destroy(string $id)
    {
        $return = ReturnModel::findOrFail($id);
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