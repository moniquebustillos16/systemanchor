<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->uuid('product_id');
            $table->uuid('warehouse_id');

            $table->decimal('qty', 18, 4)->default(0);
            $table->decimal('min_stock', 18, 4)->default(0);
            $table->decimal('max_stock', 18, 4)->default(0);
            $table->decimal('reserved_qty', 18, 4)->default(0); // optional: allocated to orders

            $table->string('status', 30)->default('active'); // active | inactive
            $table->timestamp('last_counted_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // One stock row per product per warehouse
            $table->unique(['product_id', 'warehouse_id']);

            // Uncomment when products & warehouses tables exist and order is correct:
            // $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            // $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};