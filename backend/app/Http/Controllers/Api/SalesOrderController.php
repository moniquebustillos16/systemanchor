<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SalesOrderController extends Controller
{
    private const STATS_CACHE_TTL = 20; // seconds

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

    /**
     * One aggregated query + short cache (same pattern as InventoryController::stats).
     */
    public function stats()
    {
        $payload = Cache::remember('sales_orders:stats', self::STATS_CACHE_TTL, function () {
            $row = SalesOrder::query()
                ->whereNull('deleted_at')
                ->selectRaw("
                    COUNT(*) as all_count,
                    COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status IN ('completed','shipped') THEN 1 ELSE 0 END), 0) as done,
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
        $so = SalesOrder::with(['customer', 'warehouse'])
            ->whereNull('deleted_at')
            ->findOrFail($id);

        return response()->json($so);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'so_number'      => 'nullable|string|max:50|unique:sales_orders,so_number',
            'customer_id'    => 'required|uuid|exists:customers,id',
            'warehouse_id'   => 'nullable|uuid|exists:warehouses,id',
            'order_date'     => 'nullable|date',
            'expected_date'  => 'nullable|date',
            'reference'      => 'nullable|string|max:255',
            'notes'          => 'nullable|string|max:2000',
            'items'          => 'nullable|numeric|min:0',
            'total'          => 'nullable|numeric|min:0',
            'status'         => ['nullable', Rule::in([
                'pending', 'processing', 'completed', 'shipped', 'cancelled',
            ])],
        ]);

        $soNumber = $validated['so_number'] ?? null;
        if (empty($soNumber)) {
            $soNumber = $this->generateSoNumber();
        }

        $so = SalesOrder::create([
            'so_number'     => $soNumber,
            'customer_id'   => $validated['customer_id'],
            'warehouse_id'  => $validated['warehouse_id'] ?? null,
            'order_date'    => $validated['order_date'] ?? now()->toDateString(),
            'expected_date' => $validated['expected_date'] ?? null,
            'reference'     => $validated['reference'] ?? null,
            'notes'         => $validated['notes'] ?? null,
            'items'         => (int) max(1, round((float) ($validated['items'] ?? 1))),
            'total'         => (float) ($validated['total'] ?? 0),
            'status'        => $validated['status'] ?? 'pending',
        ]);

        $so->load(['customer:id,name', 'warehouse:id,code,name']);
        Cache::forget('sales_orders:stats');

        try {
            $this->notifyAll(
                'info',
                'Sales order created',
                ($so->so_number ?? 'SO') . ' was created',
                '/sales-orders'
            );
        } catch (\Throwable $e) {
            Log::warning('SO notifyAll failed: ' . $e->getMessage());
        }

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
            'customer_id'    => 'sometimes|uuid|exists:customers,id',
            'warehouse_id'   => 'sometimes|nullable|uuid|exists:warehouses,id',
            'order_date'     => 'sometimes|date',
            'expected_date'  => 'sometimes|nullable|date',
            'reference'      => 'sometimes|nullable|string|max:255',
            'notes'          => 'sometimes|nullable|string|max:2000',
            'items'          => 'sometimes|numeric|min:0',
            'total'          => 'sometimes|numeric|min:0',
            'status'         => ['sometimes', Rule::in([
                'pending', 'processing', 'completed', 'shipped', 'cancelled',
            ])],
        ]);

        if (array_key_exists('items', $validated)) {
            $validated['items'] = (int) max(1, round((float) $validated['items']));
        }
        if (array_key_exists('total', $validated)) {
            $validated['total'] = (float) $validated['total'];
        }

        $so->update($validated);
        $so->load(['customer:id,name', 'warehouse:id,code,name']);
        Cache::forget('sales_orders:stats');

        if (isset($validated['status']) && $validated['status'] !== $oldStatus) {
            $type = in_array($validated['status'], ['completed', 'shipped'], true)
                ? 'success'
                : ($validated['status'] === 'cancelled' ? 'warning' : 'info');

            try {
                $this->notifyAll(
                    $type,
                    'Sales order updated',
                    ($so->so_number ?? 'SO') . " is now {$validated['status']}",
                    '/sales-orders'
                );
            } catch (\Throwable $e) {
                Log::warning('SO notifyAll failed: ' . $e->getMessage());
            }
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
        Cache::forget('sales_orders:stats');

        return response()->json(['message' => 'Sales order deleted']);
    }

    private function generateSoNumber(): string
    {
        $prefix = 'SO-' . now()->format('Ymd') . '-';
        for ($i = 0; $i < 8; $i++) {
            $candidate = $prefix . strtoupper(Str::random(4));
            if (!SalesOrder::where('so_number', $candidate)->exists()) {
                return $candidate;
            }
        }
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