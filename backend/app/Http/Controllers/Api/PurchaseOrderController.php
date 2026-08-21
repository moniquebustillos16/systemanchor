<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    private const STATS_CACHE_TTL = 20; // seconds

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

    /**
     * One aggregated query + short cache (same pattern as InventoryController::stats).
     */
    public function stats()
    {
        $payload = Cache::remember('purchase_orders:stats', self::STATS_CACHE_TTL, function () {
            $row = PurchaseOrder::query()
                ->whereNull('deleted_at')
                ->selectRaw("
                    COUNT(*) as all_count,
                    COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status IN ('completed','received','shipped') THEN 1 ELSE 0 END), 0) as done,
                    COALESCE(SUM(total), 0) as total_value
                ")
                ->first();

            return [
                'all'         => (int) ($row->all_count ?? 0),
                'pending'     => (int) ($row->pending ?? 0),
                'done'        => (int) ($row->done ?? 0),
                'total_value' => (float) ($row->total_value ?? 0),
            ];
        });

        return response()->json($payload);
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
            'po_number'      => 'nullable|string|max:50|unique:purchase_orders,po_number',
            'supplier_id'    => 'required|uuid|exists:suppliers,id',
            'warehouse_id'   => 'nullable|uuid|exists:warehouses,id',
            'order_date'     => 'nullable|date',
            'expected_date'  => 'nullable|date',
            'reference'      => 'nullable|string|max:255',
            'notes'          => 'nullable|string|max:2000',
            'product_name'   => 'nullable|string|max:255',
            'items'          => 'nullable|numeric|min:0',
            'total'          => 'nullable|numeric|min:0',
            'status'         => ['nullable', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        // Always generate a unique PO number when the client doesn't send one
        $poNumber = $validated['po_number'] ?? null;
        if (empty($poNumber)) {
            $poNumber = $this->generatePoNumber();
        }

        $po = PurchaseOrder::create([
            'po_number'     => $poNumber,
            'supplier_id'   => $validated['supplier_id'],
            'warehouse_id'  => $validated['warehouse_id'] ?? null,
            'order_date'    => $validated['order_date'] ?? now()->toDateString(),
            'expected_date' => $validated['expected_date'] ?? null,
            'reference'     => $validated['reference'] ?? null,
            'notes'         => $validated['notes'] ?? null,
            'product_name'  => $validated['product_name'] ?? 'Product offer',
            'items'         => (int) max(1, round((float) ($validated['items'] ?? 1))),
            'total'         => (float) ($validated['total'] ?? 0),
            'status'        => $validated['status'] ?? 'pending',
        ]);

        $po->load(['supplier:id,name', 'warehouse:id,code,name']);
        Cache::forget('purchase_orders:stats');

        // Never let notification failure turn a successful create into a 500
        try {
            $this->notifyAll(
                'info',
                'Purchase order created',
                ($po->po_number ?? 'PO') . ' was created',
                '/purchase-orders'
            );
        } catch (\Throwable $e) {
            Log::warning('PO notifyAll failed: ' . $e->getMessage());
        }

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
            'supplier_id'    => 'sometimes|uuid|exists:suppliers,id',
            'warehouse_id'   => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date'     => 'sometimes|date',
            'expected_date'  => 'sometimes|nullable|date',
            'reference'      => 'sometimes|nullable|string|max:255',
            'notes'          => 'sometimes|nullable|string|max:2000',
            'items'          => 'sometimes|numeric|min:0',
            'total'          => 'sometimes|numeric|min:0',
            'status'         => ['sometimes', Rule::in([
                'pending', 'processing', 'completed', 'received', 'shipped', 'cancelled',
            ])],
        ]);

        if (array_key_exists('items', $validated)) {
            $validated['items'] = (int) max(1, round((float) $validated['items']));
        }
        if (array_key_exists('total', $validated)) {
            $validated['total'] = (float) $validated['total'];
        }

        $po->update($validated);
        $po->load(['supplier:id,name', 'warehouse:id,code,name']);
        Cache::forget('purchase_orders:stats');

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'received'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            try {
                $this->notifyAll(
                    $type,
                    'Purchase order updated',
                    ($po->po_number ?? 'PO') . " is now {$validated['status']}",
                    '/purchase-orders'
                );
            } catch (\Throwable $e) {
                Log::warning('PO notifyAll failed: ' . $e->getMessage());
            }
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
        Cache::forget('purchase_orders:stats');

        return response()->json(['message' => 'Purchase order deleted']);
    }

    /** Generate a unique PO-YYYYMMDD-XXXX style number */
    private function generatePoNumber(): string
    {
        $prefix = 'PO-' . now()->format('Ymd') . '-';
        for ($i = 0; $i < 8; $i++) {
            $candidate = $prefix . strtoupper(Str::random(4));
            if (!PurchaseOrder::where('po_number', $candidate)->exists()) {
                return $candidate;
            }
        }
        // ultra-rare fallback
        return $prefix . strtoupper(Str::random(8));
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