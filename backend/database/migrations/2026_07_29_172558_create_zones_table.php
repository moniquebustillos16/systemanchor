<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('warehouse_id')->index();
            $table->string('name', 150);
            $table->string('type', 50)->default('Storage');
            $table->unsignedInteger('bins_count')->default(0);
            $table->unsignedTinyInteger('capacity_pct')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zones');
    }
};