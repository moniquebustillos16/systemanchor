<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('purchase_orders', 'expected_date')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->date('expected_date')->nullable()->after('order_date');
            });
        }

        if (!Schema::hasColumn('purchase_orders', 'reference')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->string('reference', 255)->nullable()->after('expected_date');
            });
        }

        if (!Schema::hasColumn('purchase_orders', 'product_name')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->string('product_name')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['expected_date', 'reference', 'product_name']);
        });
    }
};
