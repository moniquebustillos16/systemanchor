<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optional migration for Profile activity feed + 2FA flags.
 *
 * php artisan migrate
 */
return new class extends Migration
{
    public function up(): void
    {
        // Activity log for Profile → Activity tab
        if (!Schema::hasTable('profile_activity')) {
            Schema::create('profile_activity', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id')->index();
                $table->string('type', 20)->default('info'); // success|warning|danger|info
                $table->string('title', 150);
                $table->string('description', 500)->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 500)->nullable();
                $table->timestamps();

                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->cascadeOnDelete();
            });
        }

        // 2FA columns on users (simple flags; use Fortify for full TOTP)
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'two_factor_enabled')) {
                $table->boolean('two_factor_enabled')->default(false)->after('password');
            }
            if (!Schema::hasColumn('users', 'two_factor_secret')) {
                $table->text('two_factor_secret')->nullable()->after('two_factor_enabled');
            }
            // Profile fields used by frontend (add only if missing)
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 50)->nullable();
            }
            if (!Schema::hasColumn('users', 'job_title')) {
                $table->string('job_title', 150)->nullable();
            }
            if (!Schema::hasColumn('users', 'department')) {
                $table->string('department', 150)->nullable();
            }
            if (!Schema::hasColumn('users', 'image_path')) {
                $table->string('image_path')->nullable();
            }
            if (!Schema::hasColumn('users', 'image_url')) {
                $table->string('image_url')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_activity');

        Schema::table('users', function (Blueprint $table) {
            foreach (['two_factor_secret', 'two_factor_enabled'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};