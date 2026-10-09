<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            if (!Schema::hasColumn('goods_receipts', 'date')) {
                $table->date('date')->nullable();
            }
            if (!Schema::hasColumn('goods_receipts', 'expected')) {
                $table->decimal('expected', 18, 4)->default(0);
            }
            if (!Schema::hasColumn('goods_receipts', 'receiver_id')) {
                $table->uuid('receiver_id')->nullable()->index();
            }
        });

        if (Schema::hasColumn('goods_receipts', 'receipt_date')) {
            DB::table('goods_receipts')
                ->whereNull('date')
                ->whereNotNull('receipt_date')
                ->update(['date' => DB::raw('receipt_date')]);
        }

        if (Schema::hasColumn('goods_receipts', 'expected_qty')) {
            DB::table('goods_receipts')
                ->where('expected', 0)
                ->where('expected_qty', '>', 0)
                ->update(['expected' => DB::raw('expected_qty')]);
        }
    }

    public function down(): void
    {
        Schema::table('goods_receipts', function (Blueprint $table) {
            $table->dropIndex(['receiver_id']);
            $table->dropColumn(['date', 'expected', 'receiver_id']);
        });
    }
};