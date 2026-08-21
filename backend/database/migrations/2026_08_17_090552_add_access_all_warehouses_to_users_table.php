<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'access_all_warehouses')) {
                $table->boolean('access_all_warehouses')->default(false)->after('warehouse_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'access_all_warehouses')) {
                $table->dropColumn('access_all_warehouses');
            }
        });
    }
};