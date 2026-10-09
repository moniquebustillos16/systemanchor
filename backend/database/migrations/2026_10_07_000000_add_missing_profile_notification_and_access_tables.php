<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            if (!Schema::hasColumn('roles', 'name')) {
                $table->string('name')->nullable()->unique();
            }
            if (!Schema::hasColumn('roles', 'description')) {
                $table->text('description')->nullable();
            }
        });

        if (!Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name')->unique();
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('role_permissions')) {
            Schema::create('role_permissions', function (Blueprint $table) {
                $table->uuid('role_id');
                $table->uuid('permission_id');
                $table->unique(['role_id', 'permission_id']);
                $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
                $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('user_settings')) {
            Schema::create('user_settings', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id')->unique();
                $table->string('language', 50)->default('English');
                $table->string('timezone', 80)->default('Asia/Manila');
                $table->string('date_format', 20)->default('YYYY-MM-DD');
                $table->string('theme', 20)->default('system');
                $table->boolean('email_notifications')->default(true);
                $table->boolean('push_notifications')->default(true);
                $table->boolean('low_stock_alerts')->default(true);
                $table->boolean('order_alerts')->default(true);
                $table->string('digest_frequency', 20)->default('daily');
                $table->timestamps();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id')->index();
                $table->string('type', 20);
                $table->string('title');
                $table->text('message')->nullable();
                $table->string('page', 100)->nullable();
                $table->boolean('is_read')->default(false)->index();
                $table->timestamps();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('user_settings');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
    }
};
