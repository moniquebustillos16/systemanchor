<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'dashboard.view',

            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.delete',

            'stock.view',
            'stock.in',
            'stock.out',
            'stock.transfer',
            'stock.adjust',

            'sales_orders.view',
            'sales_orders.create',
            'sales_orders.update',
            'sales_orders.delete',

            'purchase_orders.view',
            'purchase_orders.create',
            'purchase_orders.update',
            'purchase_orders.delete',

            'receiving.view',
            'receiving.create',
            'receiving.update',

            'shipping.view',
            'shipping.create',
            'shipping.update',

            'returns.view',
            'returns.create',
            'returns.update',

            'warehouses.view',
            'warehouses.create',
            'warehouses.update',
            'warehouses.delete',
            'capacity.view',
            'capacity.create',
            'capacity.update',
            'capacity.delete',

            'suppliers.view',
            'customers.view',

            'users.view',
            'users.create',
            'users.update',
            'users.delete',

            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'roles.permissions',

            'settings.view',
            'settings.update',

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
