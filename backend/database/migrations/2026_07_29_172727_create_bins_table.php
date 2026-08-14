<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 50);
            $table->uuid('zone_id')->index();
            $table->uuid('warehouse_id')->index();
            $table->uuid('product_id')->nullable()->index();
            $table->unsignedInteger('qty')->default(0);
            $table->unsignedInteger('capacity')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['warehouse_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bins');
    }
};