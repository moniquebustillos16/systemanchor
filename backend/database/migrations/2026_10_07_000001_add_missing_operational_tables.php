<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('customers')) {
            Schema::create('customers', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name');
                $table->string('email')->nullable();
                $table->string('phone', 50)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('user_warehouses')) {
            Schema::create('user_warehouses', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id')->index();
                $table->uuid('warehouse_id')->index();
                $table->timestamp('created_at')->nullable();
                $table->unique(['user_id', 'warehouse_id']);
            });
        }

        if (!Schema::hasTable('sales_orders')) {
            Schema::create('sales_orders', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('so_number')->unique();
                $table->uuid('customer_id')->nullable()->index();
                $table->uuid('warehouse_id')->nullable()->index();
                $table->date('order_date');
                $table->unsignedInteger('items')->default(0);
                $table->decimal('total', 12, 2)->default(0);
                $table->string('status', 30)->default('pending');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('shipments')) {
            Schema::create('shipments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('shipment_number')->unique();
                $table->uuid('sales_order_id')->nullable()->index();
                $table->uuid('warehouse_id')->nullable()->index();
                $table->string('carrier')->nullable();
                $table->string('tracking')->nullable();
                $table->unsignedInteger('packages')->default(0);
                $table->date('date')->nullable();
                $table->string('status', 30)->default('pending');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('returns')) {
            Schema::create('returns', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('return_number')->unique();
                $table->uuid('sales_order_id')->nullable()->index();
                $table->uuid('warehouse_id')->nullable()->index();
                $table->string('reason')->nullable();
                $table->string('disposition')->nullable();
                $table->unsignedInteger('items')->default(0);
                $table->date('date')->nullable();
                $table->string('status', 30)->default('pending');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('cycle_counts')) {
            Schema::create('cycle_counts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('code')->unique();
                $table->uuid('warehouse_id')->nullable()->index();
                $table->string('zone')->nullable();
                $table->date('scheduled_date')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->decimal('counted', 18, 4)->nullable();
                $table->decimal('system_qty', 18, 4)->nullable();
                $table->decimal('variance', 18, 4)->nullable();
                $table->decimal('accuracy', 8, 2)->nullable();
                $table->string('counter')->nullable();
                $table->string('status', 30)->default('pending');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'items')) {
                $table->unsignedInteger('items')->default(0);
            }
            if (!Schema::hasColumn('purchase_orders', 'total')) {
                $table->decimal('total', 12, 2)->default(0);
            }
        });

        if (!Schema::hasColumn('goods_receipts', 'received')) {
            Schema::table('goods_receipts', function (Blueprint $table) {
                $table->unsignedInteger('received')->default(0);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cycle_counts');
        Schema::dropIfExists('returns');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('sales_orders');
        Schema::dropIfExists('user_warehouses');
        Schema::dropIfExists('customers');
    }
};
