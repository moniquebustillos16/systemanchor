<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const LEGACY_ACTIONS = [
        'view' => 'view',
        'create' => 'create',
        'update' => 'update',
        'delete' => 'delete',
        'cancel' => 'delete',
    ];

    public function up(): void
    {
        $now = now();

        foreach (array_unique(array_values(self::LEGACY_ACTIONS)) as $action) {
            DB::table('permissions')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'name' => 'sales_orders.'.$action,
                'description' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (self::LEGACY_ACTIONS as $legacyAction => $action) {
            $legacyPermissionId = DB::table('permissions')
                ->where('name', 'orders.'.$legacyAction)
                ->value('id');
            $salesPermissionId = DB::table('permissions')
                ->where('name', 'sales_orders.'.$action)
                ->value('id');

            if (! $legacyPermissionId || ! $salesPermissionId) {
                continue;
            }

            $roleIds = DB::table('role_permissions')
                ->where('permission_id', $legacyPermissionId)
                ->pluck('role_id');

            foreach ($roleIds as $roleId) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id' => $roleId,
                    'permission_id' => $salesPermissionId,
                ]);
            }
        }
    }

    public function down(): void {}
};
