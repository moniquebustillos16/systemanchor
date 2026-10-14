<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceipt;
use App\Models\Notification;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GoodsReceiptController extends Controller
{
    public function index(Request $request)
    {
        $query = GoodsReceipt::with(['purchaseOrder', 'supplier', 'warehouse', 'receiver'])
            ->whereNull('deleted_at');
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            $query->whereIn('warehouse_id', $allowed);
        }

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
            $this->assertWarehouseAllowed($request, (string) $warehouseId);
            $query->where('warehouse_id', $warehouseId);
        }

        $sort = $request->query('sort', 'date');
        $dir = $request->query('dir', 'desc') === 'asc' ? 'asc' : 'desc';
        $allowed = ['date', 'receipt_number', 'status', 'expected', 'received', 'created_at'];
        if (! in_array($sort, $allowed)) {
            $sort = 'date';
        }
        $query->orderBy($sort, $dir);

        $perPage = min(max((int) $request->query('per_page', 15), 1), 200);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    public function stats(Request $request)
    {
        $base = GoodsReceipt::whereNull('deleted_at');
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)) {
            $base->whereIn('warehouse_id', $allowed);
        }

        return response()->json([
            'all' => (clone $base)->count(),
            'open' => (clone $base)->whereIn('status', ['pending', 'processing', 'partial'])->count(),
            'done' => (clone $base)->whereIn('status', ['completed', 'received'])->count(),
            'lines' => (clone $base)->sum('received'),
        ]);
    }

    public function show(string $id)
    {
        $receipt = GoodsReceipt::with(['purchaseOrder', 'supplier', 'warehouse', 'receiver'])
            ->findOrFail($id);
        $this->assertWarehouseAllowed(request(), (string) $receipt->warehouse_id);

        return response()->json(['data' => $receipt]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'purchase_order_id' => 'required|uuid|exists:purchase_orders,id',
            'supplier_id' => 'required|uuid|exists:suppliers,id',
            'warehouse_id' => 'required|uuid|exists:warehouses,id',
            'receiver_id' => 'nullable|uuid|exists:users,id',
            'date' => 'required|date',
            'expected' => 'nullable|numeric|min:0',
            'received' => 'nullable|numeric|min:0',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'required|uuid|exists:products,id',
            'lines.*.expected' => 'nullable|numeric|min:0',
            'lines.*.received' => 'required|numeric|min:0',
            'lines.*.unit_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:pending,processing,partial,cancelled',
        ]);
        $this->assertWarehouseAllowed($request, $validated['warehouse_id']);
        $purchaseOrder = PurchaseOrder::findOrFail($validated['purchase_order_id']);
        $this->assertPurchaseOrderWarehouse($request, $purchaseOrder, $validated['warehouse_id']);
        $validated['expected'] = array_sum(array_map(
            fn ($line) => (float) ($line['expected'] ?? 0),
            $validated['lines']
        ));
        $validated['received'] = array_sum(array_map(
            fn ($line) => (float) $line['received'],
            $validated['lines']
        ));

        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $validated['purchase_order_id'],
            'supplier_id' => $validated['supplier_id'],
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'receiver_id' => $validated['receiver_id'] ?? null,
            'date' => $validated['date'],
            'expected' => $validated['expected'] ?? 0,
            'received' => $validated['received'] ?? 0,
            'lines' => $validated['lines'],
            'status' => $validated['status'] ?? 'pending',
        ]);

        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        return response()->json([
            'message' => 'Goods receipt created successfully',
            'data' => $receipt,
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $receipt = GoodsReceipt::findOrFail($id);
        $this->assertWarehouseAllowed($request, (string) $receipt->warehouse_id);

        if (($request->exists('expected') || $request->exists('received')) && ! $request->exists('lines')) {
            return response()->json([
                'message' => 'Receipt quantities must be changed through the product lines.',
            ], 422);
        }

        $validated = $request->validate([
            'purchase_order_id' => 'sometimes|required|uuid|exists:purchase_orders,id',
            'supplier_id' => 'sometimes|required|uuid|exists:suppliers,id',
            'warehouse_id' => 'sometimes|required|uuid|exists:warehouses,id',
            'receiver_id' => 'nullable|uuid|exists:users,id',
            'date' => 'sometimes|required|date',
            'expected' => 'nullable|numeric|min:0',
            'received' => 'nullable|numeric|min:0',
            'lines' => 'sometimes|array|min:1',
            'lines.*.product_id' => 'required_with:lines|uuid|exists:products,id',
            'lines.*.expected' => 'nullable|numeric|min:0',
            'lines.*.received' => 'required_with:lines|numeric|min:0',
            'lines.*.unit_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:pending,processing,partial,cancelled',
        ]);
        $this->assertWarehouseAllowed(
            $request,
            (string) ($validated['warehouse_id'] ?? $receipt->warehouse_id)
        );
        $purchaseOrder = PurchaseOrder::findOrFail(
            $validated['purchase_order_id'] ?? $receipt->purchase_order_id
        );
        $this->assertPurchaseOrderWarehouse(
            $request,
            $purchaseOrder,
            (string) ($validated['warehouse_id'] ?? $receipt->warehouse_id)
        );
        if (isset($validated['lines'])) {
            $validated['expected'] = array_sum(array_map(
                fn ($line) => (float) ($line['expected'] ?? 0),
                $validated['lines']
            ));
            $validated['received'] = array_sum(array_map(
                fn ($line) => (float) $line['received'],
                $validated['lines']
            ));
        }

        if ($receipt->status === 'completed') {
            abort(409, 'A completed receipt cannot be changed.');
        }

        $receipt->update($validated);
        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        return response()->json([
            'message' => 'Goods receipt updated successfully',
            'data' => $receipt,
        ]);
    }

    public function complete(Request $request, string $id, InventoryService $inventoryService)
    {
        [$receipt, $wasCompleted] = DB::transaction(function () use ($id, $request, $inventoryService) {
            $receipt = GoodsReceipt::with('purchaseOrder')
                ->lockForUpdate()
                ->findOrFail($id);
            $this->assertWarehouseAllowed($request, (string) $receipt->warehouse_id);
            if ($receipt->status === 'completed') {
                return [$receipt, true];
            }
            if ($receipt->status === 'cancelled') {
                abort(422, 'A cancelled receipt cannot be completed.');
            }

            $purchaseOrder = PurchaseOrder::query()
                ->lockForUpdate()
                ->findOrFail($receipt->purchase_order_id);
            $this->assertPurchaseOrderWarehouse($request, $purchaseOrder, (string) $receipt->warehouse_id);
            $receiptLines = $this->receiptLinesForCompletion($purchaseOrder, $receipt);
            $receipt->lines = $receiptLines;
            $this->assertWithinPurchaseOrderLines($purchaseOrder, $receipt);

            $inventoryService->postDocumentLines(
                'IN',
                $receipt->id,
                $receipt->receipt_number,
                $receipt->warehouse_id,
                $receiptLines,
                $request->user()?->id,
                'received',
                'goods-receipt'
            );

            $postedQuantity = array_sum(array_map(
                fn ($line) => (float) $line['received'],
                $receiptLines
            ));
            $receipt->update([
                'status' => 'completed',
                'received' => $postedQuantity,
                'lines' => $receiptLines,
            ]);

            return [$receipt->fresh()->load('purchaseOrder'), false];
        }, 3);

        $receipt->load(['purchaseOrder', 'supplier', 'warehouse', 'receiver']);

        if (! $wasCompleted) {
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
        }

        return response()->json([
            'message' => $wasCompleted ? 'Goods receipt already completed' : 'Goods receipt completed',
            'data' => $receipt,
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $receipt = GoodsReceipt::findOrFail($id);
        $this->assertWarehouseAllowed($request, (string) $receipt->warehouse_id);
        if ($receipt->status === 'completed') {
            abort(409, 'A completed receipt cannot be deleted because its stock movement is permanent.');
        }
        $receipt->delete();

        return response()->json(['message' => 'Goods receipt deleted successfully']);
    }

    private function receiptLinesForCompletion(PurchaseOrder $purchaseOrder, GoodsReceipt $receipt): array
    {
        if (! empty($receipt->lines)) {
            return $receipt->lines;
        }

        $purchaseOrderLines = collect($purchaseOrder->lines ?? [])
            ->filter(fn ($line) => ! empty($line['product_id']) && (float) ($line['qty'] ?? 0) > 0)
            ->values();
        if ($purchaseOrderLines->isEmpty()) {
            throw ValidationException::withMessages([
                'lines' => ['This receipt has no product lines and its purchase order has no usable product lines.'],
            ]);
        }

        $orderedTotal = (float) $purchaseOrderLines->sum(fn ($line) => (float) $line['qty']);
        $receivedTotal = (float) $receipt->received;
        if ($receivedTotal <= 0) {
            $receivedTotal = (float) $receipt->expected;
        }

        if ($receivedTotal <= 0) {
            throw ValidationException::withMessages([
                'lines' => ['Enter a received quantity before completing this receipt.'],
            ]);
        }

        if ($purchaseOrderLines->count() > 1
            && abs($receivedTotal - $orderedTotal) > 0.0001) {
            throw ValidationException::withMessages([
                'lines' => ['This legacy multi-product receipt has no product-level quantities. Add receipt lines before completing it.'],
            ]);
        }

        return $purchaseOrderLines
            ->map(function (array $line) use ($purchaseOrderLines, $receivedTotal) {
                $orderedQuantity = (float) $line['qty'];

                return [
                    'product_id' => (string) $line['product_id'],
                    'product_name' => $line['product_name'] ?? $line['name'] ?? null,
                    'expected' => $orderedQuantity,
                    'received' => $purchaseOrderLines->count() === 1
                        ? $receivedTotal
                        : $orderedQuantity,
                    'unit_price' => $line['unit_price'] ?? 0,
                ];
            })
            ->all();
    }

    private function assertWithinPurchaseOrderLines(PurchaseOrder $purchaseOrder, GoodsReceipt $receipt): void
    {
        $ordered = [];
        foreach ($purchaseOrder->lines ?? [] as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            if ($productId !== '') {
                $identity = $this->receiptProductIdentity($productId);
                $ordered[$identity] = ($ordered[$identity] ?? 0) + (float) ($line['qty'] ?? 0);
            }
        }
        if ($ordered === []) {
            throw ValidationException::withMessages([
                'purchase_order_id' => ['This purchase order has no persisted product lines and cannot be received.'],
            ]);
        }

        $received = [];
        GoodsReceipt::query()
            ->where('purchase_order_id', $purchaseOrder->id)
            ->where('status', 'completed')
            ->where('id', '!=', $receipt->id)
            ->get(['lines'])
            ->each(function (GoodsReceipt $completedReceipt) use (&$received) {
                foreach ($completedReceipt->lines ?? [] as $line) {
                    $productId = (string) ($line['product_id'] ?? '');
                    if ($productId !== '') {
                        $identity = $this->receiptProductIdentity($productId);
                        $received[$identity] = ($received[$identity] ?? 0) + (float) ($line['received'] ?? 0);
                    }
                }
            });

        $currentReceipt = [];
        foreach ($receipt->lines ?? [] as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            if ($productId !== '') {
                $identity = $this->receiptProductIdentity($productId);
                $currentReceipt[$identity] = ($currentReceipt[$identity] ?? 0) + (float) ($line['received'] ?? 0);
            }
        }
        foreach ($currentReceipt as $identity => $quantity) {
            if (! array_key_exists($identity, $ordered)
                || $quantity + ($received[$identity] ?? 0) > $ordered[$identity]) {
                throw ValidationException::withMessages([
                    'lines' => ['Receipt quantities cannot exceed the remaining purchase order lines.'],
                ]);
            }
        }
    }

    private function receiptProductIdentity(string $productId): string
    {
        $sku = Product::withTrashed()->whereKey($productId)->value('sku');

        return $sku === null ? 'id:'.$productId : 'sku:'.$sku;
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

    private function assertWarehouseAllowed(Request $request, string $warehouseId): void
    {
        $user = $request->user();
        if (! $user || $user->canAccessAllWarehouses()) {
            return;
        }

        $allowed = $user->warehouses()->pluck('warehouses.id')->map(fn ($id) => (string) $id)->all();
        if (! empty($user->warehouse_id)) {
            $allowed[] = (string) $user->warehouse_id;
        }
        if (! in_array($warehouseId, $allowed, true)) {
            abort(403, 'You do not have access to this warehouse.');
        }
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

    private function assertPurchaseOrderWarehouse(
        Request $request,
        PurchaseOrder $purchaseOrder,
        string $receiptWarehouseId
    ): void {
        if ($purchaseOrder->warehouse_id
            && (string) $purchaseOrder->warehouse_id !== $receiptWarehouseId) {
            abort(422, 'The receipt warehouse must match the purchase order warehouse.');
        }
        if ($purchaseOrder->warehouse_id) {
            $this->assertWarehouseAllowed($request, (string) $purchaseOrder->warehouse_id);
        }
    }
}
