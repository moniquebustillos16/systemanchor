<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Profile activity feed + optional user profile / 2FA columns.
 *
 * php artisan migrate
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('profile_activity')) {
            Schema::create('profile_activity', function (Blueprint $table) {
                $table->uuid('id')->primary();
                // Match your users.id type. If users.id is bigint, use:
                // $table->foreignId('user_id')->constrained()->cascadeOnDelete();
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

        // Add columns only if missing (checks outside Schema::table)
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'two_factor_enabled')) {
                $table->boolean('two_factor_enabled')->default(false);
            }
            if (!Schema::hasColumn('users', 'two_factor_secret')) {
                $table->text('two_factor_secret')->nullable();
            }
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
            $cols = [
                'two_factor_secret',
                'two_factor_enabled',
                // Uncomment if you also want these removed on rollback:
                // 'phone', 'job_title', 'department', 'image_path', 'image_url',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};