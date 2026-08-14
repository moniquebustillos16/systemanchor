<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goods_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('receipt_number', 50)->unique();
            $table->uuid('purchase_order_id')->nullable()->index();
            $table->uuid('supplier_id')->nullable()->index();
            $table->uuid('warehouse_id')->nullable()->index();
            $table->date('receipt_date')->nullable();
            $table->unsignedInteger('expected_qty')->default(0);
            $table->unsignedInteger('received_qty')->default(0);
            $table->string('receiver', 150)->nullable();
            $table->string('status', 30)->default('pending');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goods_receipts');
    }
};