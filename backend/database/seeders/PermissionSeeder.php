<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',

            'stock.view',
            'stock.in',
            'stock.out',
            'stock.transfer',
            'stock.adjust',

            'orders.view',
            'orders.create',
            'orders.update',
            'orders.delete',
            'orders.cancel',

            'purchase_orders.view',
            'purchase_orders.create',
            'purchase_orders.update',
            'purchase_orders.delete',

            'warehouses.view',
            'warehouses.create',
            'warehouses.update',
            'warehouses.delete',

            'users.view',
            'users.create',
            'users.update',
            'users.delete',

            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'roles.permissions',

            'reports.view',
            'reports.export',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate([
                'name' => $name,
            ]);
        }
    }
}