<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_sku_unique');
        });

        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            Schema::table('products', function (Blueprint $table) {
                $table->string('active_sku', 100)
                    ->nullable()
                    ->storedAs('IF(deleted_at IS NULL, sku, NULL)');
                $table->unique('active_sku', 'products_active_sku_unique');
            });

            return;
        }

        DB::statement(
            'CREATE UNIQUE INDEX products_active_sku_unique ON products (sku) WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            Schema::table('products', function (Blueprint $table) {
                $table->dropUnique('products_active_sku_unique');
                $table->dropColumn('active_sku');
            });
        } else {
            DB::statement('DROP INDEX products_active_sku_unique');
        }

        Schema::table('products', function (Blueprint $table) {
            $table->unique('sku', 'products_sku_unique');
        });
    }
};
