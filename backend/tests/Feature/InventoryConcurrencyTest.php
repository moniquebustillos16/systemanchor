<?php

namespace Tests\Feature;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class InventoryConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    protected $connectionsToTransact = [];

    public function test_simultaneous_withdrawals_cannot_overdraw_a_postgres_balance(): void
    {
        $this->assertSame('pgsql', DB::connection()->getDriverName());

        $warehouse = new Warehouse(['name' => 'Concurrency Warehouse', 'code' => 'CONC-'.Str::random(8)]);
        $warehouse->id = (string) Str::uuid();
        $warehouse->save();
        $product = Product::create([
            'sku' => 'CONC-'.Str::upper(Str::random(10)),
            'name' => 'Concurrent withdrawal test product',
            'warehouse_id' => $warehouse->id,
            'qty' => 5,
        ]);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'qty' => 5,
        ]);

        $barrier = sys_get_temp_dir().DIRECTORY_SEPARATOR.'systemanchor-concurrency-'.Str::uuid();
        $this->assertTrue(mkdir($barrier));
        $keys = ['concurrency-a:'.Str::uuid(), 'concurrency-b:'.Str::uuid()];
        $processes = [];
        $results = [];
        $finalState = null;
        $failure = null;

        try {
            $worker = base_path('tests/Support/inventory-withdrawal-worker.php');
            $connection = config('database.connections.pgsql');
            $environment = [
                'APP_ENV' => 'testing',
                'DB_CONNECTION' => 'pgsql',
                'DB_DATABASE' => 'systemanchor_test',
                'DB_URL' => '',
                'DB_HOST' => (string) $connection['host'],
                'DB_PORT' => (string) $connection['port'],
                'DB_USERNAME' => (string) $connection['username'],
                'DB_PASSWORD' => (string) $connection['password'],
            ];

            foreach ($keys as $index => $key) {
                $id = (string) $index;
                $processes[$id] = new Process([
                    PHP_BINARY,
                    $worker,
                    $product->id,
                    $warehouse->id,
                    $key,
                    $barrier,
                    $id,
                ], base_path(), $environment);
                $processes[$id]->setTimeout(30);
                $processes[$id]->start();
            }

            $readyDeadline = microtime(true) + 15;
            while (! is_file($barrier.DIRECTORY_SEPARATOR.'ready-0')
                || ! is_file($barrier.DIRECTORY_SEPARATOR.'ready-1')) {
                foreach ($processes as $process) {
                    if (! $process->isRunning()) {
                        throw new \RuntimeException('A concurrent withdrawal worker exited before reaching the start barrier: '.$process->getErrorOutput().$process->getOutput());
                    }
                }
                if (microtime(true) >= $readyDeadline) {
                    throw new \RuntimeException('Concurrent withdrawal workers did not reach the start barrier in time.');
                }
                usleep(10_000);
            }

            file_put_contents($barrier.DIRECTORY_SEPARATOR.'start', 'go');
            foreach ($processes as $process) {
                $process->wait();
                if (! $process->isSuccessful()) {
                    throw new \RuntimeException('Concurrent withdrawal worker failed: '.$process->getErrorOutput().$process->getOutput());
                }
            }

            foreach (array_keys($keys) as $index) {
                $resultPath = $barrier.DIRECTORY_SEPARATOR.'result-'.$index.'.json';
                $decoded = json_decode((string) file_get_contents($resultPath), true, flags: JSON_THROW_ON_ERROR);
                $results[] = $decoded;
            }
            $finalState = [
                'warehouse_qty' => (float) Inventory::query()
                    ->where('product_id', $product->id)
                    ->where('warehouse_id', $warehouse->id)
                    ->value('qty'),
                'product_qty' => (float) Product::findOrFail($product->id)->qty,
                'movement_count' => StockMovement::query()->whereIn('idempotency_key', $keys)->count(),
            ];
        } catch (\Throwable $exception) {
            $failure = $exception;
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop(2);
                }
            }

            foreach (['ready-0', 'ready-1', 'start', 'result-0.json', 'result-1.json'] as $file) {
                $path = $barrier.DIRECTORY_SEPARATOR.$file;
                if (is_file($path)) {
                    unlink($path);
                }
            }
            rmdir($barrier);

            StockMovement::query()->whereIn('idempotency_key', $keys)->delete();
            Inventory::query()->where('product_id', $product->id)->forceDelete();
            $product->forceDelete();
            $warehouse->forceDelete();
        }

        if ($failure) {
            throw $failure;
        }

        $this->assertCount(2, $results);
        $this->assertSame(
            ['insufficient_stock', 'posted'],
            collect($results)->pluck('result')->sort()->values()->all()
        );
        $this->assertSame(1.0, $finalState['warehouse_qty']);
        $this->assertSame(1.0, $finalState['product_qty']);
        $this->assertSame(1, $finalState['movement_count']);
    }
}
