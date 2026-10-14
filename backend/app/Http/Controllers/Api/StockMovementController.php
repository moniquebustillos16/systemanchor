<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        $query = StockMovement::with([
            'product:id,sku,name',
            'fromWarehouse:id,code,name',
            'toWarehouse:id,code,name',
        ])->orderByDesc('movement_date');
        $this->applyWarehouseScope($query, $this->allowedWarehouseIds($request));

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('movement_number', 'ilike', "%{$search}%")
                    ->orWhere('reference', 'ilike', "%{$search}%")
                    ->orWhere('notes', 'ilike', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('sku', 'ilike', "%{$search}%")
                            ->orWhere('name', 'ilike', "%{$search}%");
                    });
            });
        }

        if ($type = $request->query('type')) {
            $map = [
                'in' => 'IN',
                'out' => 'OUT',
                'transfer' => 'TRANSFER',
                'adjust' => 'ADJUSTMENT',
            ];
            $query->where('type', $map[strtolower($type)] ?? strtoupper($type));
        }

        $perPage = min((int) $request->query('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    public function stats(Request $request)
    {
        $query = StockMovement::query();
        $this->applyWarehouseScope($query, $this->allowedWarehouseIds($request));

        $today = now()->startOfDay();

        return response()->json([
            'today' => (int) $query
                ->where('movement_date', '>=', $today)
                ->where('movement_date', '<', $today->copy()->addDay())
                ->count(),
        ]);
    }

    private function applyWarehouseScope($query, ?array $allowed): void
    {
        if (is_array($allowed)) {
            $query->whereIn('warehouse_id', $allowed)
                ->where(function ($movements) use ($allowed) {
                    $movements->where('type', '!=', 'TRANSFER')
                        ->orWhere(function ($transfers) use ($allowed) {
                            $transfers->whereIn('from_warehouse_id', $allowed)
                                ->whereIn('to_warehouse_id', $allowed);
                        });
                });
        }
    }

    public function store(Request $request, InventoryService $inventoryService)
    {
        $request->merge([
            'idempotency_key' => $request->header('Idempotency-Key')
                ?? $request->input('idempotency_key'),
        ]);
        $validated = $request->validate([
            'product_id' => 'required|uuid|exists:products,id',
            'type' => 'required|in:IN,OUT,TRANSFER,ADJUSTMENT,in,out,transfer,adjust',
            'qty' => 'required|numeric|min:0',
            'from_warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'to_warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'reason' => 'nullable|string|max:50',
            'idempotency_key' => 'required|string|max:100',
        ]);

        $type = match (strtolower($validated['type'])) {
            'in' => 'IN',
            'out' => 'OUT',
            'transfer' => 'TRANSFER',
            'adjust' => 'ADJUSTMENT',
            default => strtoupper($validated['type']),
        };
        $qty = round((float) $validated['qty'], 4);
        if ($type !== 'ADJUSTMENT' && $qty <= 0) {
            return response()->json(['message' => 'Quantity must be greater than zero.'], 422);
        }

        $fromId = $validated['from_warehouse_id'] ?? null;
        $toId = $validated['to_warehouse_id'] ?? null;
        $whId = $validated['warehouse_id'] ?? null;

        if ($type === 'IN') {
            $toId = $toId ?? $whId;
        } elseif ($type === 'OUT' || $type === 'ADJUSTMENT') {
            $fromId = $fromId ?? $whId;
        }

        if ($type === 'TRANSFER' && (! $fromId || ! $toId || $fromId === $toId)) {
            return response()->json([
                'message' => 'Transfer requires different from and to warehouses',
            ], 422);
        }
        if (($type === 'IN' && ! $toId) || ($type === 'OUT' && ! $fromId) || ($type === 'ADJUSTMENT' && ! $fromId)) {
            return response()->json(['message' => 'A warehouse is required for this movement.'], 422);
        }

        foreach (array_filter([$fromId, $toId]) as $warehouseIdToCheck) {
            $this->assertWarehouseAllowed($request, (string) $warehouseIdToCheck);
        }

        $warehouseId = $type === 'IN' ? $toId : $fromId;
        $result = $inventoryService->post([
            'type' => $type,
            'product_id' => $validated['product_id'],
            'qty' => $qty,
            'from_warehouse_id' => $fromId,
            'to_warehouse_id' => $toId,
            'warehouse_id' => $warehouseId,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'reason' => $validated['reason'] ?? null,
            'idempotency_key' => $validated['idempotency_key'],
        ], $request->user()?->id);

        $movement = $result['movement'];
        $product = Product::findOrFail($movement->product_id);
        $movement->load([
            'product:id,sku,name',
            'fromWarehouse:id,code,name',
            'toWarehouse:id,code,name',
        ]);

        if (! $result['duplicate']) {
            $this->notifyAll(
                'info',
                'Stock movement posted',
                ($movement->movement_number ?? 'Movement')." ({$type}) for {$product->sku}",
                '/stock-movements'
            );

            $balance = $warehouseId
                ? (float) ($product->inventoryBalances()->where('warehouse_id', $warehouseId)->value('qty') ?? 0)
                : (float) $product->qty;
            $min = (float) $product->min_stock;
            if ($balance <= 0) {
                $this->notifyWarehouseUsers(
                    (string) $warehouseId,
                    'danger',
                    'Out of stock',
                    "{$product->sku} {$product->name} has reached zero quantity at the selected warehouse",
                    '/products'
                );
            } elseif ($min > 0 && $balance < $min) {
                $this->notifyWarehouseUsers(
                    (string) $warehouseId,
                    'warning',
                    'Low stock alert',
                    "{$product->sku} {$product->name} is below minimum ({$balance} / {$min})",
                    '/products'
                );
            }
        }

        return response()->json([
            'message' => $result['duplicate'] ? 'Stock movement already posted' : 'Stock movement completed successfully',
            'movement' => $movement,
            'current_stock' => $warehouseId
                ? (float) ($product->inventoryBalances()->where('warehouse_id', $warehouseId)->value('qty') ?? 0)
                : (float) $product->qty,
            'duplicate' => $result['duplicate'],
        ], $result['duplicate'] ? 200 : 201);
    }

    public function show(Request $request, string $id)
    {
        $movement = StockMovement::with([
            'product:id,sku,name',
            'fromWarehouse:id,code,name',
            'toWarehouse:id,code,name',
        ])->findOrFail($id);
        $allowed = $this->allowedWarehouseIds($request);
        if (is_array($allowed)
            && (! in_array((string) $movement->warehouse_id, $allowed, true)
                || ($movement->type === 'TRANSFER'
                    && (! in_array((string) $movement->from_warehouse_id, $allowed, true)
                        || ! in_array((string) $movement->to_warehouse_id, $allowed, true))))) {
            abort(404, 'Stock movement not found.');
        }

        return response()->json($movement);
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
        $user = $request->user();
        if (! $user || (method_exists($user, 'canAccessAllWarehouses') && $user->canAccessAllWarehouses())) {
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
                    ->orWhereHas('warehouses', fn ($warehouses) => $warehouses
                        ->where('warehouses.id', $warehouseId))
                    ->orWhereHas('role', fn ($role) => $role->where('name', 'Admin'));
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
