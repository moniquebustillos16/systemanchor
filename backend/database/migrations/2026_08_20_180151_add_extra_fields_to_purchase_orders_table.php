<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up()
{
    Schema::table('purchase_orders', function (Blueprint $table) {
        $table->date('expected_date')->nullable()->after('order_date');
        $table->string('reference', 255)->nullable()->after('expected_date');
        $table->text('notes')->nullable()->after('reference');
        $table->string('product_name')->nullable()->change();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('product_name')->nullable(false)->change();
            //
        });
    }
};
