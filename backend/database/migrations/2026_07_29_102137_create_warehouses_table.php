<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('code', 50)->unique();
            $table->string('name', 150);

            // What Locations.tsx / DBML send
            $table->string('location', 255)->nullable();
            $table->string('manager', 150)->nullable();
            $table->decimal('capacity', 12, 2)->nullable()->default(0);
            $table->decimal('utilized', 5, 2)->nullable()->default(0);
            $table->unsignedInteger('zones')->default(0);
            $table->unsignedInteger('bins')->default(0);

            // Address fields (keep if you still use them)
            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('country', 100)->nullable()->default('Philippines');
            $table->string('postal_code', 20)->nullable();
            $table->string('phone', 50)->nullable();

            $table->string('status', 30)->default('active');

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouses');
    }
};