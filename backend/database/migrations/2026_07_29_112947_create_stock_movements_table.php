<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();

            /*
            |--------------------------------------------------------------------------
            | Product & Warehouse Relationship
            |--------------------------------------------------------------------------
            */
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('warehouse_id')->constrained()->cascadeOnDelete();

            /*
            |--------------------------------------------------------------------------
            | User Tracking
            |--------------------------------------------------------------------------
            */
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();

            /*
            |--------------------------------------------------------------------------
            | Movement Details
            |--------------------------------------------------------------------------
            */
            $table->enum('type', [
                'IN',
                'OUT',
                'TRANSFER',
                'ADJUSTMENT',
            ]);

            $table->integer('quantity');

            /*
            |--------------------------------------------------------------------------
            | Reference Information
            |--------------------------------------------------------------------------
            */
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();

            /*
            |--------------------------------------------------------------------------
            | Status
            |--------------------------------------------------------------------------
            */
            $table->enum('status', [
                'PENDING',
                'COMPLETED',
                'CANCELLED',
            ])->default('COMPLETED');

            $table->timestamps();

            /*
            |--------------------------------------------------------------------------
            | Performance Indexes
            |--------------------------------------------------------------------------
            */
            $table->index(['product_id', 'warehouse_id']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};