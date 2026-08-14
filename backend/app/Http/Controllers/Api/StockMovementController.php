<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        $query = StockMovement::with([
            'product:id,sku,name',
            'fromWarehouse:id,code,name',
            'toWarehouse:id,code,name',
        ])->orderByDesc('movement_date');

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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'         => 'required|uuid|exists:products,id',
            'type'               => 'required|in:IN,OUT,TRANSFER,ADJUSTMENT,in,out,transfer,adjust',
            'qty'                => 'required|numeric|min:0.0001',
            'from_warehouse_id'  => 'nullable|uuid|exists:warehouses,id',
            'to_warehouse_id'    => 'nullable|uuid|exists:warehouses,id',
            'warehouse_id'       => 'nullable|uuid|exists:warehouses,id',
            'reference'          => 'nullable|string|max:100',
            'notes'              => 'nullable|string',
            'reason'             => 'nullable|string|max:50',
        ]);

        $typeMap = [
            'in' => 'IN',
            'out' => 'OUT',
            'transfer' => 'TRANSFER',
            'adjust' => 'ADJUSTMENT',
        ];
        $type = $typeMap[strtolower($validated['type'])] ?? strtoupper($validated['type']);
        $qty  = (float) $validated['qty'];

        $fromId = $validated['from_warehouse_id'] ?? null;
        $toId   = $validated['to_warehouse_id'] ?? null;
        $whId   = $validated['warehouse_id'] ?? null;

        if ($type === 'IN') {
            $toId = $toId ?? $whId;
        } elseif ($type === 'OUT' || $type === 'ADJUSTMENT') {
            $fromId = $fromId ?? $whId;
        }

        if ($type === 'TRANSFER' && (!$fromId || !$toId || $fromId === $toId)) {
            return response()->json([
                'message' => 'Transfer requires different from and to warehouses',
            ], 422);
        }

        return DB::transaction(function () use ($validated, $type, $qty, $fromId, $toId) {
            $product = Product::whereNull('deleted_at')
                ->lockForUpdate()
                ->findOrFail($validated['product_id']);

            $current = (float) $product->qty;

            if ($type === 'IN') {
                $product->qty = $current + $qty;
                if ($toId) {
                    $product->warehouse_id = $toId;
                }
            } elseif ($type === 'OUT') {
                if ($current < $qty) {
                    return response()->json(['message' => 'Insufficient stock'], 400);
                }
                $product->qty = $current - $qty;
            } elseif ($type === 'TRANSFER') {
                if ($current < $qty) {
                    return response()->json(['message' => 'Insufficient stock'], 400);
                }
                if ($toId) {
                    $product->warehouse_id = $toId;
                }
            } elseif ($type === 'ADJUSTMENT') {
                $reason = $validated['reason'] ?? 'cycle-count';
                if (in_array($reason, ['damage', 'shrinkage'], true)) {
                    if ($current < $qty) {
                        return response()->json(['message' => 'Insufficient stock'], 400);
                    }
                    $product->qty = $current - $qty;
                } elseif ($reason === 'found') {
                    $product->qty = $current + $qty;
                } else {
                    $product->qty = $qty;
                }
            }

            $product->save();

            $movement = StockMovement::create([
                'type'              => $type,
                'product_id'        => $product->id,
                'qty'               => $qty,
                'from_warehouse_id' => $fromId,
                'to_warehouse_id'   => $toId,
                'reference'         => $validated['reference'] ?? null,
                'notes'             => $validated['notes'] ?? null,
                'movement_date'     => now(),
                'status'            => 'posted',
            ]);

            $movement->load([
                'product:id,sku,name',
                'fromWarehouse:id,code,name',
                'toWarehouse:id,code,name',
            ]);

            // Notify: movement posted
            $this->notifyAll(
                'info',
                'Stock movement posted',
                ($movement->movement_number ?? 'Movement') . " ({$type}) for {$product->sku}",
                '/stock-movements'
            );

            // Notify: low / out of stock
            $newQty = (float) $product->qty;
            $min = (float) $product->min_stock;
            if ($newQty <= 0) {
                $this->notifyAll(
                    'danger',
                    'Out of stock',
                    "{$product->sku} {$product->name} has reached zero quantity",
                    '/products'
                );
            } elseif ($min > 0 && $newQty < $min) {
                $this->notifyAll(
                    'warning',
                    'Low stock alert',
                    "{$product->sku} {$product->name} is below minimum ({$newQty} / {$min})",
                    '/products'
                );
            }

            return response()->json([
                'message'       => 'Stock movement completed successfully',
                'movement'      => $movement,
                'current_stock' => $newQty,
            ], 201);
        });
    }

    public function show(string $id)
    {
        $movement = StockMovement::with([
            'product:id,sku,name',
            'fromWarehouse:id,code,name',
            'toWarehouse:id,code,name',
        ])->findOrFail($id);

        return response()->json($movement);
    }

    public function update(Request $request, string $id)
    {
        $movement = StockMovement::findOrFail($id);
        $validated = $request->validate([
            'reference' => 'sometimes|nullable|string|max:100',
            'notes'     => 'sometimes|nullable|string',
            'status'    => 'sometimes|string|max:30',
        ]);
        $movement->update($validated);

        return response()->json([
            'message' => 'Stock movement updated successfully',
            'data'    => $movement,
        ]);
    }

    public function destroy(string $id)
    {
        $movement = StockMovement::findOrFail($id);
        $movement->delete();

        return response()->json(['message' => 'Stock movement deleted successfully']);
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