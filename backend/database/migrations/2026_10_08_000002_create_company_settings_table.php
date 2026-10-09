<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company_settings')) {
            return;
        }

        Schema::create('company_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_name')->default('System Anchor Logistics Inc.');
            $table->string('trading_name')->nullable();
            $table->string('tin', 50)->nullable();
            $table->string('industry', 100)->default('Warehousing & Logistics');
            $table->string('street_address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('zip_code', 20)->nullable();
            $table->string('country', 100)->default('Philippines');
            $table->string('landmark')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('timezone', 80)->default('Asia/Manila');
            $table->string('currency', 10)->default('PHP');
            $table->string('date_format', 20)->default('YYYY-MM-DD');
            $table->string('language', 50)->default('English');
            $table->foreignUuid('default_warehouse_id')
                ->nullable()
                ->constrained('warehouses')
                ->nullOnDelete();
            $table->string('fiscal_year_start', 20)->default('January');
            $table->decimal('low_stock_threshold', 18, 4)->default(15);
            $table->string('auto_reorder', 50)->default('disabled');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};