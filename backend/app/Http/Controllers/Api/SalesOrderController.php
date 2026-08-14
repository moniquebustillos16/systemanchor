<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = SalesOrder::with(['customer:id,name', 'warehouse:id,code,name'])
            ->whereNull('deleted_at');

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
        $dir  = $request->query('dir', 'desc') === 'asc' ? 'asc' : 'desc';
        if (in_array($sort, ['so_number', 'order_date', 'total', 'status', 'created_at'], true)) {
            $query->orderBy($sort, $dir);
        } else {
            $query->orderByDesc('order_date');
        }

        $perPage = min((int) $request->query('per_page', 15), 100);

        return response()->json($query->paginate($perPage));
    }

    public function stats()
    {
        $base = SalesOrder::whereNull('deleted_at');

        return response()->json([
            'all'         => (clone $base)->count(),
            'pending'     => (clone $base)->whereIn('status', ['pending', 'processing'])->count(),
            'total_value' => (float) (clone $base)->selectRaw('COALESCE(SUM(total), 0) as t')->value('t'),
            'done'        => (clone $base)->whereIn('status', ['completed', 'shipped'])->count(),
        ]);
    }

    public function show(string $id)
    {
        $so = SalesOrder::with(['customer', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return response()->json($so);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'so_number'    => 'nullable|string|max:50|unique:sales_orders,so_number',
            'customer_id'  => 'required|uuid|exists:customers,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'order_date'   => 'nullable|date',
            'items'        => 'nullable|integer|min:1',
            'total'        => 'nullable|numeric|min:0',
            'status'       => ['nullable', Rule::in([
                'pending', 'processing', 'completed', 'shipped', 'cancelled',
            ])],
        ]);

        $so = SalesOrder::create([
            'so_number'    => $validated['so_number'] ?? null,
            'customer_id'  => $validated['customer_id'],
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'order_date'   => $validated['order_date'] ?? now()->toDateString(),
            'items'        => $validated['items'] ?? 1,
            'total'        => $validated['total'] ?? 0,
            'status'       => $validated['status'] ?? 'pending',
        ]);

        $so->load(['customer:id,name', 'warehouse:id,code,name']);

        $this->notifyAll(
            'info',
            'Sales order created',
            ($so->so_number ?? 'SO') . ' was created',
            '/sales-orders'
        );

        return response()->json([
            'message' => 'Sales order created',
            'data'    => $so,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $so = SalesOrder::whereNull('deleted_at')->findOrFail($id);
        $oldStatus = $so->status;

        $validated = $request->validate([
            'customer_id'  => 'sometimes|uuid|exists:customers,id',
            'warehouse_id' => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date'   => 'sometimes|date',
            'items'        => 'sometimes|integer|min:1',
            'total'        => 'sometimes|numeric|min:0',
            'status'       => ['sometimes', Rule::in([
                'pending', 'processing', 'completed', 'shipped', 'cancelled',
            ])],
        ]);

        $so->update($validated);
        $so->load(['customer:id,name', 'warehouse:id,code,name']);

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'shipped'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            $this->notifyAll(
                $type,
                'Sales order updated',
                ($so->so_number ?? 'SO') . " is now {$validated['status']}",
                '/sales-orders'
            );
        }

        return response()->json([
            'message' => 'Sales order updated',
            'data'    => $so,
        ]);
    }

    public function destroy(string $id)
    {
        $so = SalesOrder::whereNull('deleted_at')->findOrFail($id);
        $so->delete();

        return response()->json(['message' => 'Sales order deleted']);
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