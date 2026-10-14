<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function postDocumentLines(
        string $type,
        string $documentId,
        string $reference,
        ?string $warehouseId,
        array $lines,
        ?string $performedBy = null,
        string $quantityField = 'qty',
        ?string $reason = null,
    ): array {
        $quantities = [];
        foreach ($lines as $line) {
            $productId = $line['product_id'] ?? null;
            $quantity = round((float) ($line[$quantityField] ?? 0), 4);
            if (! $productId || $quantity <= 0) {
                throw ValidationException::withMessages([
                    'lines' => ['Every posted line must have a product and a quantity greater than zero.'],
                ]);
            }
            $quantities[$productId] = round(($quantities[$productId] ?? 0) + $quantity, 4);
        }

        if ($quantities === []) {
            throw ValidationException::withMessages([
                'lines' => ['At least one product line is required to post stock.'],
            ]);
        }

        $movements = [];
        foreach ($quantities as $productId => $quantity) {
            $movements[] = [
                'type' => $type,
                'product_id' => $productId,
                'qty' => $quantity,
                'from_warehouse_id' => $type === 'OUT' ? $warehouseId : null,
                'to_warehouse_id' => $type === 'IN' ? $warehouseId : null,
                'warehouse_id' => $warehouseId,
                'reference' => $reference,
                'reason' => $reason,
                'idempotency_key' => "document:{$type}:{$documentId}:{$productId}",
            ];
        }

        return $this->postMany($movements, $performedBy);
    }

    public function post(array $movement, ?string $performedBy = null): array
    {
        try {
            return DB::transaction(
                fn () => $this->postWithinTransaction($movement, $performedBy),
                3
            );
        } catch (QueryException $exception) {
            $existing = StockMovement::query()
                ->where('idempotency_key', $movement['idempotency_key'] ?? null)
                ->first();
            if (! $existing) {
                throw $exception;
            }
            $type = strtoupper($movement['type']);
            $fromId = $movement['from_warehouse_id'] ?? null;
            $toId = $movement['to_warehouse_id'] ?? null;
            if ($type === 'ADJUSTMENT') {
                $fromId = $movement['warehouse_id'] ?? $fromId;
                $toId = $fromId;
            }
            $hash = $this->requestHash($movement, $type, $fromId, $toId);
            if ($existing->request_hash !== $hash) {
                abort(409, 'The idempotency key was already used for a different stock movement.');
            }

            return ['movement' => $existing, 'duplicate' => true];
        }
    }

    public function postMany(array $movements, ?string $performedBy = null): array
    {
        return DB::transaction(function () use ($movements, $performedBy) {
            $posted = [];
            foreach ($movements as $movement) {
                $posted[] = $this->postWithinTransaction($movement, $performedBy);
            }

            return $posted;
        }, 3);
    }

    /**
     * @return array{movement: StockMovement, duplicate: bool}
     */
    private function postWithinTransaction(array $input, ?string $performedBy): array
    {
        $type = strtoupper($input['type']);
        $quantity = round((float) $input['qty'], 4);
        $product = Product::query()
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->findOrFail($input['product_id']);

        $fromId = $input['from_warehouse_id'] ?? null;
        $toId = $input['to_warehouse_id'] ?? null;
        $warehouseId = $input['warehouse_id'] ?? ($fromId ?? $toId);
        $reason = $input['reason'] ?? null;

        if ($type === 'ADJUSTMENT') {
            $warehouseId = $warehouseId ?? $fromId ?? $toId;
            $fromId = $warehouseId;
            $toId = $warehouseId;
        }

        $idempotencyKey = $input['idempotency_key'];
        $requestHash = $this->requestHash($input, $type, $fromId, $toId);

        $existing = StockMovement::query()
            ->where('idempotency_key', $idempotencyKey)
            ->first();
        if ($existing) {
            if ($existing->request_hash !== $requestHash) {
                abort(409, 'The idempotency key was already used for a different stock movement.');
            }

            return ['movement' => $existing, 'duplicate' => true];
        }

        $before = 0.0;
        $after = 0.0;
        $sourceBefore = null;
        $sourceAfter = null;
        $destinationBefore = null;
        $destinationAfter = null;
        $delta = 0.0;

        if ($type === 'IN') {
            $destination = $this->lockOrCreateBalance($product, $toId);
            $destinationBefore = (float) $destination->qty;
            $destinationAfter = round($destinationBefore + $quantity, 4);
            $destination->qty = $destinationAfter;
            $destination->save();
            $delta = $quantity;
        } elseif ($type === 'OUT' || $type === 'TRANSFER') {
            $source = $this->lockBalance($product->id, $fromId);
            $sourceBefore = (float) ($source?->qty ?? 0);
            if ($sourceBefore < $quantity) {
                throw ValidationException::withMessages([
                    'qty' => ['Insufficient stock in the source warehouse.'],
                ]);
            }

            $sourceAfter = round($sourceBefore - $quantity, 4);
            $updated = Inventory::query()
                ->whereKey($source->id)
                ->where('qty', '>=', $quantity)
                ->update(['qty' => DB::raw('qty - '.$this->sqlDecimal($quantity)), 'updated_at' => now()]);
            if ($updated !== 1) {
                throw ValidationException::withMessages([
                    'qty' => ['Insufficient stock in the source warehouse.'],
                ]);
            }

            if ($type === 'OUT') {
                $delta = -$quantity;
            } else {
                $destination = $this->lockOrCreateBalance($product, $toId);
                $destinationBefore = (float) $destination->qty;
                $destinationAfter = round($destinationBefore + $quantity, 4);
                $destination->qty = $destinationAfter;
                $destination->save();
            }
        } elseif ($type === 'ADJUSTMENT') {
            $balance = $this->lockOrCreateBalance($product, $warehouseId);
            $before = (float) $balance->qty;
            if (in_array($reason, ['damage', 'shrinkage'], true)) {
                if ($before < $quantity) {
                    throw ValidationException::withMessages([
                        'qty' => ['Insufficient stock in the adjustment warehouse.'],
                    ]);
                }
                $after = round($before - $quantity, 4);
            } elseif ($reason === 'found') {
                $after = round($before + $quantity, 4);
            } else {
                $after = $quantity;
            }

            $delta = round($after - $before, 4);
            $sourceBefore = $before;
            $sourceAfter = $after;
            $quantity = abs($delta);
            $balance->qty = $after;
            $balance->save();
        } else {
            throw ValidationException::withMessages([
                'type' => ['Unsupported stock movement type.'],
            ]);
        }

        if ($delta !== 0.0) {
            if ($delta < 0) {
                $updated = DB::table('products')
                    ->where('id', $product->id)
                    ->where('qty', '>=', abs($delta))
                    ->update([
                        'qty' => DB::raw('qty - '.$this->sqlDecimal(abs($delta))),
                        'updated_at' => now(),
                    ]);
                if ($updated !== 1) {
                    throw ValidationException::withMessages([
                        'qty' => ['The product aggregate balance is insufficient for this movement.'],
                    ]);
                }
            } else {
                DB::table('products')
                    ->where('id', $product->id)
                    ->increment('qty', $delta, ['updated_at' => now()]);
            }
        }

        $movement = StockMovement::create([
            'type' => $type,
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'qty' => $type === 'ADJUSTMENT' ? $delta : $quantity,
            'quantity' => (int) round(abs($type === 'ADJUSTMENT' ? $delta : $quantity)),
            'from_warehouse_id' => $type === 'ADJUSTMENT' ? null : $fromId,
            'to_warehouse_id' => $type === 'ADJUSTMENT' ? null : $toId,
            'reason' => $reason,
            'reference' => $input['reference'] ?? null,
            'notes' => $input['notes'] ?? null,
            'performed_by' => $performedBy,
            'movement_date' => now(),
            'status' => 'COMPLETED',
            'idempotency_key' => $idempotencyKey,
            'request_hash' => $requestHash,
            'source_balance_before' => $sourceBefore,
            'source_balance_after' => $sourceAfter,
            'destination_balance_before' => $destinationBefore,
            'destination_balance_after' => $destinationAfter,
        ]);

        $userId = $performedBy;
        DB::afterCommit(function () use ($userId) {
            Cache::forget('inventory:stats');
            if ($userId) {
                Cache::forget('inventory:stats:user:'.$userId);
                foreach (['3m', '7m', '10m', '1y'] as $range) {
                    Cache::forget("dashboard:overview:user:{$userId}:{$range}");
                }
            }
        });

        return ['movement' => $movement, 'duplicate' => false];
    }

    private function requestHash(array $input, string $type, ?string $fromId, ?string $toId): string
    {
        return hash('sha256', json_encode([
            'type' => $type,
            'product_id' => $input['product_id'],
            'qty' => round((float) $input['qty'], 4),
            'from_warehouse_id' => $fromId,
            'to_warehouse_id' => $toId,
            'reason' => $input['reason'] ?? null,
            'reference' => $input['reference'] ?? null,
        ], JSON_THROW_ON_ERROR));
    }

    private function lockBalance(string $productId, ?string $warehouseId): ?Inventory
    {
        if (! $warehouseId) {
            throw ValidationException::withMessages([
                'warehouse_id' => ['A warehouse is required for stock movements.'],
            ]);
        }

        return Inventory::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->lockForUpdate()
            ->first();
    }

    private function lockOrCreateBalance(Product $product, ?string $warehouseId): Inventory
    {
        if (! $warehouseId) {
            throw ValidationException::withMessages([
                'warehouse_id' => ['A warehouse is required for stock movements.'],
            ]);
        }

        $balance = Inventory::withTrashed()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $warehouseId)
            ->lockForUpdate()
            ->first();
        if ($balance) {
            if ($balance->trashed()) {
                $balance->restore();
            }

            return $balance;
        }

        return Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'qty' => 0,
            'min_stock' => $product->min_stock,
            'max_stock' => $product->max_stock,
            'reserved_qty' => 0,
            'status' => 'active',
        ]);
    }

    private function sqlDecimal(float $value): string
    {
        return number_format($value, 4, '.', '');
    }
}
