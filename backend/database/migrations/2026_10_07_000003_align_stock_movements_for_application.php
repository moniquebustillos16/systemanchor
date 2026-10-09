<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_movements', 'movement_number')) {
                $table->string('movement_number', 50)->nullable()->unique();
            }
            if (!Schema::hasColumn('stock_movements', 'qty')) {
                $table->decimal('qty', 18, 4)->default(0);
            }
            if (!Schema::hasColumn('stock_movements', 'from_warehouse_id')) {
                $table->uuid('from_warehouse_id')->nullable();
            }
            if (!Schema::hasColumn('stock_movements', 'to_warehouse_id')) {
                $table->uuid('to_warehouse_id')->nullable();
            }
            if (!Schema::hasColumn('stock_movements', 'performed_by')) {
                $table->uuid('performed_by')->nullable();
            }
            if (!Schema::hasColumn('stock_movements', 'movement_date')) {
                $table->timestampTz('movement_date')->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropUnique(['movement_number']);
            $table->dropIndex(['movement_date']);
            $table->dropColumn([
                'movement_number',
                'qty',
                'from_warehouse_id',
                'to_warehouse_id',
                'performed_by',
                'movement_date',
            ]);
        });
    }
};