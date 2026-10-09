<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'contact')) {
                $table->string('contact', 150)->nullable();
            }
            if (!Schema::hasColumn('customers', 'city')) {
                $table->string('city', 100)->nullable();
            }
            if (!Schema::hasColumn('customers', 'status')) {
                $table->string('status', 30)->default('active');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['contact', 'city', 'status']);
        });
    }
};