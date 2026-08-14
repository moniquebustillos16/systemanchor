<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class GoodsReceiptController extends Controller
{
    public function index(Request $request)
    {
        $query = GoodsReceipt::with(['purchaseOrder', 'supplier', 'warehouse', 'receiver'])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('receipt_number', 'like', "%{$search}%")
                  ->orWhereHas('purchaseOrder', fn ($q) => $q->where('po_number', 'like', "%{$search}%"))
                  ->orWhereHas('supplier', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $sort = $request->query('sort', 'date');
        $dir  = $request->query('dir', 'desc') === 'asc' ? 'asc' : 'desc';
        $allowed = ['date', 'receipt_number', 'status', 'expected', 'received', 'created_at'];
        if (!in_array($sort, $allowed)) {
            $sort = 'date';
        }
        $query->orderBy($sort, $dir);

        $perPage = min(max((int) $request->query('per_page', 15), 1), 200);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
        ]);
    }

    public function stats()
    {
        $base = GoodsReceipt::whereNull('deleted_at');

        return response()->json([
            'all'   => (clone $base)->count(),
            'open'  => (clone $base)->whereIn('status', ['pending', 'processing', 'partial'])->count(),
            'done'  => (clone $base)->whereIn('status', ['completed', 'received'])->count(),
            'lines' => (clone $base)->sum('received'),
        ]);
    }

    public function show(string $id)
    {
        $receipt = GoodsReceipt::with(['purchaseOrder', 'supplier', 'warehouse', 'receiver'])
            ->findOrFail($id);

        return response()->json(['data' => $receipt]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'purchase_order_id' => 'required|uuid|exists:purchase_orders,id',
            'supplier_id'       => 'required|uuid|exists:suppliers,id',
            'warehouse_id'      => 'nullable|uuid|exists:warehouses,id',
            'receiver_id'       => 'nullable|uuid|exists:users,id',
            'date'              => 'required|date',
            'expected'          => 'nullable|numeric|min:0',
            'received'          => 'nullable|numeric|min:0',
            'status'            => 'nullable|string|in:pending,processing,partial,received,completed,cancelled',
        ]);

        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $validated['purchase_order_id'],
            'supplier_id'       => $validated['supplier_id'],
            'warehouse_id'      => $validated['warehouse_id'] ?? null,
            'receiver_id'       => $validated['receiver_id'] ?? null,
            'date'              => $validated['date'],
            'expected'          => $validated['expected'] ?? 0,
            'received'          => $validated['received'] ?? 0,
            'status'            => $validated['status'] ?? 'pending',
        ]);

        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        return response()->json([
            'message' => 'Goods receipt created successfully',
            'data'    => $receipt,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $receipt = GoodsReceipt::findOrFail($id);

        $validated = $request->validate([
            'purchase_order_id' => 'sometimes|required|uuid|exists:purchase_orders,id',
            'supplier_id'       => 'sometimes|required|uuid|exists:suppliers,id',
            'warehouse_id'      => 'nullable|uuid|exists:warehouses,id',
            'receiver_id'       => 'nullable|uuid|exists:users,id',
            'date'              => 'sometimes|required|date',
            'expected'          => 'nullable|numeric|min:0',
            'received'          => 'nullable|numeric|min:0',
            'status'            => 'nullable|string|in:pending,processing,partial,received,completed,cancelled',
        ]);

        $receipt->update($validated);
        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        return response()->json([
            'message' => 'Goods receipt updated successfully',
            'data'    => $receipt,
        ]);
    }

    public function complete(string $id)
    {
        $receipt = GoodsReceipt::with('purchaseOrder')->findOrFail($id);

        $receipt->update([
            'status'   => 'completed',
            'received' => $receipt->received > 0 ? $receipt->received : $receipt->expected,
        ]);

        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        $poNumber = $receipt->purchaseOrder?->po_number ?? 'PO';
        $this->notifyAll(
            'info',
            'PO received',
            "{$receipt->receipt_number} for {$poNumber} marked completed",
            '/goods-receiving'
        );

        $expected = (float) $receipt->expected;
        $received = (float) $receipt->received;
        if ($expected > 0 && abs($received - $expected) > 0.0001) {
            $this->notifyAll(
                'danger',
                'Failed receipt',
                "{$receipt->receipt_number} quantity mismatch (expected {$expected}, received {$received})",
                '/goods-receiving'
            );
        }

        return response()->json([
            'message' => 'Goods receipt completed',
            'data'    => $receipt,
        ]);
    }

    public function destroy(string $id)
    {
        $receipt = GoodsReceipt::findOrFail($id);
        $receipt->delete();

        return response()->json(['message' => 'Goods receipt deleted successfully']);
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