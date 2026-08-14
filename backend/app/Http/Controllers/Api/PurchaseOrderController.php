<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier:id,name', 'warehouse:id,code,name'])
            ->whereNull('deleted_at');

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

    public function stats()
    {
        $base = PurchaseOrder::whereNull('deleted_at');

        return response()->json([
            'all'         => (clone $base)->count(),
            'pending'     => (clone $base)->whereIn('status', ['pending', 'processing'])->count(),
            'total_value' => (float) (clone $base)->selectRaw('COALESCE(SUM(total), 0) as t')->value('t'),
            'done'        => (clone $base)->whereIn('status', ['completed', 'received', 'shipped'])->count(),
        ]);
    }

    public function show(string $id)
    {
        $po = PurchaseOrder::with(['supplier', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return response()->json($po);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'po_number'    => 'nullable|string|max:50|unique:purchase_orders,po_number',
            'supplier_id'  => 'required|uuid|exists:suppliers,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'order_date'   => 'nullable|date',
            'items'        => 'nullable|integer|min:1',
            'total'        => 'nullable|numeric|min:0',
            'status'       => ['nullable', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        $po = PurchaseOrder::create([
            'po_number'    => $validated['po_number'] ?? null,
            'supplier_id'  => $validated['supplier_id'],
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'order_date'   => $validated['order_date'] ?? now()->toDateString(),
            'items'        => $validated['items'] ?? 1,
            'total'        => $validated['total'] ?? 0,
            'status'       => $validated['status'] ?? 'pending',
        ]);

        $po->load(['supplier:id,name', 'warehouse:id,code,name']);

        $this->notifyAll(
            'info',
            'Purchase order created',
            ($po->po_number ?? 'PO') . ' was created',
            '/purchase-orders'
        );

        return response()->json([
            'message' => 'Purchase order created',
            'data'    => $po,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $po = PurchaseOrder::whereNull('deleted_at')->findOrFail($id);
        $oldStatus = $po->status;

        $validated = $request->validate([
            'supplier_id'  => 'sometimes|uuid|exists:suppliers,id',
            'warehouse_id' => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date'   => 'sometimes|date',
            'items'        => 'sometimes|integer|min:1',
            'total'        => 'sometimes|numeric|min:0',
            'status'       => ['sometimes', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        $po->update($validated);
        $po->load(['supplier:id,name', 'warehouse:id,code,name']);

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'received'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            $this->notifyAll(
                $type,
                'Purchase order updated',
                ($po->po_number ?? 'PO') . " is now {$validated['status']}",
                '/purchase-orders'
            );
        }

        return response()->json([
            'message' => 'Purchase order updated',
            'data'    => $po,
        ]);
    }

    public function destroy(string $id)
    {
        $po = PurchaseOrder::whereNull('deleted_at')->findOrFail($id);
        $po->delete();

        return response()->json(['message' => 'Purchase order deleted']);
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