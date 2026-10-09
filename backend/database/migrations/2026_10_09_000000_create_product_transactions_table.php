<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_transactions')) {
            return;
        }

        Schema::create('product_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('transaction_type', 30);
            $table->uuid('reference_id')->nullable();
            $table->string('reference_number', 100)->nullable();
            $table->uuid('partner_id')->nullable();
            $table->string('partner_type', 20);
            $table->decimal('quantity', 18, 4)->default(0);
            $table->decimal('unit_price', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->storedAs('quantity * unit_price');
            $table->string('status', 30)->default('pending');
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_transactions');
    }
};