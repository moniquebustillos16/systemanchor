<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('sku', 100)->unique();
            $table->string('name');
            $table->text('description')->nullable();

            $table->string('barcode', 100)->nullable();
            $table->string('serial', 100)->nullable();

            // Relations (FKs can be added later when order is correct)
            $table->uuid('category_id')->nullable();
            $table->uuid('supplier_id')->nullable();
            $table->uuid('warehouse_id')->nullable();

            $table->string('unit', 20)->default('pcs');

            // Stock — names your InventoryController currently uses
            $table->decimal('qty', 18, 4)->default(0);
            $table->decimal('min_stock', 18, 4)->default(0);
            $table->decimal('max_stock', 18, 4)->default(0);
            $table->decimal('reorder_point', 18, 4)->default(0);

            // Pricing
            $table->decimal('cost_price', 18, 2)->default(0);
            $table->decimal('price', 18, 2)->default(0); // selling price (DBML + controllers)

            $table->string('status', 30)->default('active');
            // active | inactive | low_stock | out_of_stock

            // Dimensions / weight (optional)
            $table->decimal('weight', 10, 2)->nullable();
            $table->decimal('length', 10, 2)->nullable();
            $table->decimal('width', 10, 2)->nullable();
            $table->decimal('height', 10, 2)->nullable();

            $table->string('image', 500)->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};