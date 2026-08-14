<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable(); // Laravel auth
            $table->string('password');

            $table->uuid('role_id')->nullable();
            $table->string('status', 30)->default('active');
            $table->string('phone', 50)->nullable();
            $table->string('job_title', 150)->nullable();
            $table->string('department', 150)->nullable();
            $table->string('image_path', 500)->nullable();
            $table->string('image_url', 1000)->nullable();
            $table->timestamp('last_login_at')->nullable();

            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            // Optional FK (roles table must exist first, or add in a later migration)
            // $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};