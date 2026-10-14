<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class InventoryConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private InventoryService $inventoryService;

    private Product $product;

    private Warehouse $source;

    private Warehouse $destination;

    protected function setUp(): void
    {
        parent::setUp();

        $this->inventoryService = app(InventoryService::class);
        $this->source = new Warehouse(['name' => 'Source', 'code' => 'SRC']);
        $this->source->id = (string) Str::uuid();
        $this->source->save();
        $this->destination = new Warehouse(['name' => 'Destination', 'code' => 'DST']);
        $this->destination->id = (string) Str::uuid();
        $this->destination->save();
        $this->product = Product::create([
            'sku' => 'SKU-1',
            'name' => 'Test product',
            'warehouse_id' => $this->source->id,
            'qty' => 10,
        ]);

        Inventory::create([
            'product_id' => $this->product->id,
            'warehouse_id' => $this->source->id,
            'qty' => 10,
        ]);
    }

    public function test_insufficient_stock_does_not_create_a_movement_or_change_balances(): void
    {
        try {
            $this->inventoryService->post($this->movement('OUT', 11, 'insufficient', [
                'from_warehouse_id' => $this->source->id,
                'warehouse_id' => $this->source->id,
            ]));
            $this->fail('An insufficient withdrawal should be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('qty', $exception->errors());
        }

        $this->assertSame(10.0, (float) $this->balanceAt($this->source)->qty);
        $this->assertSame(10.0, (float) $this->product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_successful_transfer_updates_both_warehouse_balances_and_preserves_product_total(): void
    {
        $this->inventoryService->post($this->movement('TRANSFER', 4, 'transfer-1', [
            'from_warehouse_id' => $this->source->id,
            'to_warehouse_id' => $this->destination->id,
        ]));

        $this->assertSame(6.0, (float) $this->balanceAt($this->source)->qty);
        $this->assertSame(4.0, (float) $this->balanceAt($this->destination)->qty);
        $this->assertSame(10.0, (float) $this->product->fresh()->qty);

        $movement = StockMovement::query()->firstOrFail();
        $this->assertSame($this->source->id, $movement->from_warehouse_id);
        $this->assertSame($this->destination->id, $movement->to_warehouse_id);
        $this->assertSame(10.0, $movement->source_balance_before);
        $this->assertSame(6.0, $movement->source_balance_after);
        $this->assertSame(0.0, $movement->destination_balance_before);
        $this->assertSame(4.0, $movement->destination_balance_after);
    }

    public function test_failed_batch_rolls_back_prior_balance_changes_and_movements(): void
    {
        try {
            $this->inventoryService->postMany([
                $this->movement('IN', 2, 'batch-in', [
                    'to_warehouse_id' => $this->destination->id,
                    'warehouse_id' => $this->destination->id,
                ]),
                $this->movement('OUT', 11, 'batch-out', [
                    'from_warehouse_id' => $this->source->id,
                    'warehouse_id' => $this->source->id,
                ]),
            ]);
            $this->fail('The batch should fail when its second movement overdraws stock.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('qty', $exception->errors());
        }

        $this->assertSame(10.0, (float) $this->balanceAt($this->source)->qty);
        $this->assertNull($this->balanceAt($this->destination));
        $this->assertSame(10.0, (float) $this->product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_duplicate_request_does_not_apply_stock_twice(): void
    {
        $movement = $this->movement('OUT', 3, 'retry-1', [
            'from_warehouse_id' => $this->source->id,
            'warehouse_id' => $this->source->id,
        ]);

        $first = $this->inventoryService->post($movement);
        $second = $this->inventoryService->post($movement);

        $this->assertFalse($first['duplicate']);
        $this->assertTrue($second['duplicate']);
        $this->assertSame(7.0, (float) $this->balanceAt($this->source)->qty);
        $this->assertSame(7.0, (float) $this->product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_reusing_an_idempotency_key_for_a_different_request_is_rejected(): void
    {
        $movement = $this->movement('OUT', 3, 'retry-conflict', [
            'from_warehouse_id' => $this->source->id,
            'warehouse_id' => $this->source->id,
        ]);
        $this->inventoryService->post($movement);

        $this->expectException(HttpException::class);
        $this->inventoryService->post(array_merge($movement, ['qty' => 2]));
    }

    public function test_balances_reconcile_with_the_movement_ledger_and_product_aggregate(): void
    {
        $this->inventoryService->post($this->movement('TRANSFER', 4, 'reconcile-transfer', [
            'from_warehouse_id' => $this->source->id,
            'to_warehouse_id' => $this->destination->id,
        ]));
        $this->inventoryService->post($this->movement('IN', 2, 'reconcile-receipt', [
            'to_warehouse_id' => $this->destination->id,
            'warehouse_id' => $this->destination->id,
        ]));
        $this->inventoryService->post($this->movement('OUT', 1, 'reconcile-issue', [
            'from_warehouse_id' => $this->source->id,
            'warehouse_id' => $this->source->id,
        ]));

        $ledgerBalances = [$this->source->id => 10.0];
        foreach (StockMovement::query()->get() as $movement) {
            if ($movement->type === 'TRANSFER') {
                $ledgerBalances[$movement->from_warehouse_id] -= abs($movement->qty);
                $ledgerBalances[$movement->to_warehouse_id] = ($ledgerBalances[$movement->to_warehouse_id] ?? 0) + abs($movement->qty);
            } elseif ($movement->type === 'IN') {
                $ledgerBalances[$movement->to_warehouse_id] = ($ledgerBalances[$movement->to_warehouse_id] ?? 0) + $movement->qty;
            } else {
                $ledgerBalances[$movement->from_warehouse_id] -= abs($movement->qty);
            }
        }

        foreach ($ledgerBalances as $warehouseId => $expectedQty) {
            $balance = Inventory::query()
                ->where('product_id', $this->product->id)
                ->where('warehouse_id', $warehouseId)
                ->firstOrFail();
            $this->assertSame($expectedQty, (float) $balance->qty);
        }

        $this->assertSame(
            (float) Inventory::query()->where('product_id', $this->product->id)->sum('qty'),
            (float) $this->product->fresh()->qty
        );
    }

    private function movement(string $type, float $qty, string $key, array $attributes = []): array
    {
        return array_merge([
            'type' => $type,
            'product_id' => $this->product->id,
            'qty' => $qty,
            'idempotency_key' => $key,
        ], $attributes);
    }

    private function balanceAt(Warehouse $warehouse): ?Inventory
    {
        return Inventory::query()
            ->where('product_id', $this->product->id)
            ->where('warehouse_id', $warehouse->id)
            ->first();
    }
}
