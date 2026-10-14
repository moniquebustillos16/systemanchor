<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const PERMISSIONS = [
        'receiving.view',
        'receiving.create',
        'receiving.update',
        'shipping.view',
        'shipping.create',
        'shipping.update',
        'returns.view',
        'returns.create',
        'returns.update',
        'settings.view',
        'settings.update',
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::PERMISSIONS as $name) {
            DB::table('permissions')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'updated_at' => $now,
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->pluck('id');

        DB::table('role_permissions')
            ->whereIn('permission_id', $permissionIds)
            ->delete();

        DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->delete();
    }
};
