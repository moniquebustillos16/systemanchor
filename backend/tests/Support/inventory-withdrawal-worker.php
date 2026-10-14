<?php

use App\Services\InventoryService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Validation\ValidationException;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[$script, $productId, $warehouseId, $idempotencyKey, $barrier, $workerId] = $argv;
$resultPath = $barrier.DIRECTORY_SEPARATOR.'result-'.$workerId.'.json';

try {
    file_put_contents($barrier.DIRECTORY_SEPARATOR.'ready-'.$workerId, 'ready');
    $startPath = $barrier.DIRECTORY_SEPARATOR.'start';
    $deadline = microtime(true) + 15;
    while (! is_file($startPath)) {
        if (microtime(true) >= $deadline) {
            throw new RuntimeException('Timed out waiting for the concurrent test start barrier.');
        }
        usleep(10_000);
    }

    app(InventoryService::class)->post([
        'type' => 'OUT',
        'product_id' => $productId,
        'qty' => 4,
        'from_warehouse_id' => $warehouseId,
        'warehouse_id' => $warehouseId,
        'idempotency_key' => $idempotencyKey,
    ]);

    file_put_contents($resultPath, json_encode(['result' => 'posted'], JSON_THROW_ON_ERROR));
} catch (ValidationException $exception) {
    file_put_contents($resultPath, json_encode([
        'result' => 'insufficient_stock',
        'errors' => $exception->errors(),
    ], JSON_THROW_ON_ERROR));
} catch (Throwable $exception) {
    file_put_contents($resultPath, json_encode([
        'result' => 'error',
        'message' => $exception->getMessage(),
    ], JSON_THROW_ON_ERROR));
    fwrite(STDERR, (string) $exception);
    exit(1);
}
