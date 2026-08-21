<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ensure the indexes the Roles page depends on actually exist.
 * The earlier migration used Doctrine SchemaManager which is removed
 * on newer Laravel/DBAL versions and could silently skip index creation.
 */
return new class extends Migration
{
    private function pivot(): ?string
    {
        foreach (['role_permissions', 'permission_role', 'role_permission'] as $name) {
            if (Schema::hasTable($name)) {
                return $name;
            }
        }
        return null;
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            $row = DB::selectOne(
                'SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ?',
                [$table, $indexName]
            );
            return (bool) $row;
        }

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $db = Schema::getConnection()->getDatabaseName();
            $row = DB::selectOne(
                'SELECT 1 AS ok FROM information_schema.statistics
                 WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
                [$db, $table, $indexName]
            );
            return (bool) $row;
        }

        // sqlite / others – try and ignore
        return false;
    }

    private function addIndex(string $table, array $columns, string $name): void
    {
        foreach ($columns as $col) {
            if (!Schema::hasColumn($table, $col)) {
                return;
            }
        }
        if ($this->indexExists($table, $name)) {
            return;
        }
        Schema::table($table, function (Blueprint $blueprint) use ($columns, $name) {
            $blueprint->index($columns, $name);
        });
    }

    public function up(): void
    {
        if (Schema::hasTable('roles')) {
            $this->addIndex('roles', ['name'], 'roles_name_index');
            if (Schema::hasColumn('roles', 'deleted_at')) {
                $this->addIndex('roles', ['deleted_at'], 'roles_deleted_at_index');
            }
        }

        if (Schema::hasTable('permissions')) {
            $this->addIndex('permissions', ['name'], 'permissions_name_index');
        }

        $pivot = $this->pivot();
        if ($pivot) {
            // Critical for GET /roles/{id}/permissions
            $this->addIndex($pivot, ['role_id'], "{$pivot}_role_id_index");
            $this->addIndex($pivot, ['permission_id'], "{$pivot}_permission_id_index");
            $this->addIndex($pivot, ['role_id', 'permission_id'], "{$pivot}_role_id_permission_id_index");
        }
    }

    public function down(): void
    {
        // non-destructive – leave indexes in place
    }
};