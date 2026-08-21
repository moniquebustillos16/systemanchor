<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Resolve the role–permission pivot table name.
     */
    private function pivotTable(): ?string
    {
        foreach (['role_permissions', 'permission_role', 'role_permission'] as $name) {
            if (Schema::hasTable($name)) {
                return $name;
            }
        }

        return null;
    }

    /**
     * Add an index only if the column exists and the index does not.
     */
    private function addIndexIfMissing(string $table, array $columns, ?string $indexName = null): void
    {
        $indexName = $indexName ?: ($table . '_' . implode('_', $columns) . '_index');

        // Skip if any column is missing
        foreach ($columns as $col) {
            if (!Schema::hasColumn($table, $col)) {
                return;
            }
        }

        Schema::table($table, function (Blueprint $blueprint) use ($table, $columns, $indexName) {
            $sm = Schema::getConnection()->getDoctrineSchemaManager();
            $indexes = $sm->listTableIndexes($table);

            if (!isset($indexes[$indexName])) {
                $blueprint->index($columns, $indexName);
            }
        });
    }

    public function up(): void
    {
        // roles
        if (Schema::hasTable('roles')) {
            if (Schema::hasColumn('roles', 'deleted_at')) {
                Schema::table('roles', function (Blueprint $table) {
                    $table->index('deleted_at');
                });
            }
            if (Schema::hasColumn('roles', 'name')) {
                Schema::table('roles', function (Blueprint $table) {
                    $table->index('name');
                });
            }
        }

        // permissions
        if (Schema::hasTable('permissions') && Schema::hasColumn('permissions', 'name')) {
            Schema::table('permissions', function (Blueprint $table) {
                $table->index('name');
            });
        }

        // pivot
        $pivot = $this->pivotTable();
        if ($pivot) {
            Schema::table($pivot, function (Blueprint $table) use ($pivot) {
                if (Schema::hasColumn($pivot, 'role_id')) {
                    $table->index('role_id');
                }
                if (Schema::hasColumn($pivot, 'permission_id')) {
                    $table->index('permission_id');
                }
                if (Schema::hasColumn($pivot, 'role_id') && Schema::hasColumn($pivot, 'permission_id')) {
                    // Composite – speeds WHERE role_id = ? lookups used by forRole
                    $table->index(['role_id', 'permission_id']);
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('roles')) {
            Schema::table('roles', function (Blueprint $table) {
                try {
                    $table->dropIndex(['deleted_at']);
                } catch (\Throwable $e) {
                }
                try {
                    $table->dropIndex(['name']);
                } catch (\Throwable $e) {
                }
            });
        }

        if (Schema::hasTable('permissions')) {
            Schema::table('permissions', function (Blueprint $table) {
                try {
                    $table->dropIndex(['name']);
                } catch (\Throwable $e) {
                }
            });
        }

        $pivot = $this->pivotTable();
        if ($pivot) {
            Schema::table($pivot, function (Blueprint $table) {
                try {
                    $table->dropIndex(['role_id']);
                } catch (\Throwable $e) {
                }
                try {
                    $table->dropIndex(['permission_id']);
                } catch (\Throwable $e) {
                }
                try {
                    $table->dropIndex(['role_id', 'permission_id']);
                } catch (\Throwable $e) {
                }
            });
        }
    }
};