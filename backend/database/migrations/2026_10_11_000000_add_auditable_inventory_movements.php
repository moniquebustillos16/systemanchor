<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'unallocated_qty')) {
            Schema::table('products', function (Blueprint $table) {
                $table->decimal('unallocated_qty', 18, 4)->default(0);
            });
        }

        Schema::table('stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_movements', 'reason')) {
                $table->string('reason', 50)->nullable();
            }
            if (! Schema::hasColumn('stock_movements', 'idempotency_key')) {
                $table->string('idempotency_key', 100)->nullable()->unique();
            }
            if (! Schema::hasColumn('stock_movements', 'request_hash')) {
                $table->string('request_hash', 64)->nullable();
            }
            if (! Schema::hasColumn('stock_movements', 'source_balance_before')) {
                $table->decimal('source_balance_before', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('stock_movements', 'source_balance_after')) {
                $table->decimal('source_balance_after', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('stock_movements', 'destination_balance_before')) {
                $table->decimal('destination_balance_before', 18, 4)->nullable();
            }
            if (! Schema::hasColumn('stock_movements', 'destination_balance_after')) {
                $table->decimal('destination_balance_after', 18, 4)->nullable();
            }
        });

        foreach (['purchase_orders', 'sales_orders', 'goods_receipts', 'shipments', 'returns'] as $tableName) {
            if (Schema::hasTable($tableName) && ! Schema::hasColumn($tableName, 'lines')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->json('lines')->nullable();
                });
            }
        }

        DB::table('products')
            ->whereNotNull('warehouse_id')
            ->orderBy('id')
            ->chunkById(100, function ($products) {
                foreach ($products as $product) {
                    $exists = DB::table('inventories')
                        ->where('product_id', $product->id)
                        ->whereNull('deleted_at')
                        ->exists();

                    if (! $exists) {
                        DB::table('inventories')->insert([
                            'id' => (string) Str::uuid(),
                            'product_id' => $product->id,
                            'warehouse_id' => $product->warehouse_id,
                            'qty' => $product->qty ?? 0,
                            'min_stock' => $product->min_stock ?? 0,
                            'max_stock' => $product->max_stock ?? 0,
                            'reserved_qty' => 0,
                            'status' => 'active',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });

        DB::table('products')
            ->orderBy('id')
            ->chunkById(100, function ($products) {
                foreach ($products as $product) {
                    $assigned = (float) DB::table('inventories')
                        ->where('product_id', $product->id)
                        ->whereNull('deleted_at')
                        ->sum('qty');
                    $legacyTotal = (float) ($product->qty ?? 0);
                    $unallocated = max(0, round($legacyTotal - $assigned, 4));
                    $aggregate = max($legacyTotal, $assigned);

                    DB::table('products')
                        ->where('id', $product->id)
                        ->update([
                            'qty' => $aggregate,
                            'unallocated_qty' => $unallocated,
                        ]);
                }
            });

        DB::table('inventories')
            ->whereNull('deleted_at')
            ->where('qty', '>', 0)
            ->orderBy('id')
            ->chunkById(100, function ($inventories) {
                foreach ($inventories as $inventory) {
                    $idempotencyKey = 'opening:'.$inventory->id;
                    if (DB::table('stock_movements')->where('idempotency_key', $idempotencyKey)->exists()) {
                        continue;
                    }

                    $quantity = (float) $inventory->qty;
                    $uuid = (string) Str::uuid();
                    DB::table('stock_movements')->insert([
                        'id' => $uuid,
                        'movement_number' => 'SM-OPEN-'.strtoupper(substr(str_replace('-', '', $uuid), 0, 12)),
                        'type' => 'ADJUSTMENT',
                        'product_id' => $inventory->product_id,
                        'warehouse_id' => $inventory->warehouse_id,
                        'quantity' => (int) round($quantity),
                        'qty' => $quantity,
                        'from_warehouse_id' => null,
                        'to_warehouse_id' => $inventory->warehouse_id,
                        'reason' => 'opening-balance',
                        'idempotency_key' => $idempotencyKey,
                        'request_hash' => hash('sha256', $inventory->product_id.'|'.$inventory->warehouse_id.'|'.$quantity),
                        'source_balance_before' => 0,
                        'source_balance_after' => 0,
                        'destination_balance_before' => 0,
                        'destination_balance_after' => $quantity,
                        'movement_date' => now(),
                        'status' => 'COMPLETED',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        foreach (['purchase_orders', 'sales_orders', 'goods_receipts', 'shipments', 'returns'] as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'lines')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('lines');
                });
            }
        }

        Schema::table('stock_movements', function (Blueprint $table) {
            $columns = [
                'reason',
                'idempotency_key',
                'request_hash',
                'source_balance_before',
                'source_balance_after',
                'destination_balance_before',
                'destination_balance_after',
            ];
            foreach ($columns as $column) {
                if (Schema::hasColumn('stock_movements', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        if (Schema::hasColumn('products', 'unallocated_qty')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('unallocated_qty');
            });
        }
    }
};
