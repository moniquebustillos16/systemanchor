<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Roles;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PermissionSeeder::class);

        $adminRole = Roles::updateOrCreate(
            ['name' => 'Admin'],
            ['description' => 'Full system access']
        );

        $adminRole->permissions()->sync(Permission::pluck('id'));

        User::updateOrCreate(
            ['email' => 'admin@systemanchor.com'],
            [
                'name'     => 'Admin User',
                'password' => Hash::make('SystemAnchor@123'), // or just 'SystemAnchor@123' if cast is 'hashed'
                'status'   => 'active',
                'role_id'  => $adminRole->id,
            ]
        );

        // optional second user
        User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name'     => 'Test User',
                'password' => Hash::make('password'),
                'status'   => 'active',
            ]
        );

        $this->call(SampleDataSeeder::class);
    }
}
