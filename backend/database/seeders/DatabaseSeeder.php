<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@systemanchor.com'],
            [
                'name'     => 'Admin User',
                'password' => Hash::make('SystemAnchor@123'), // or just 'SystemAnchor@123' if cast is 'hashed'
                'status'   => 'active',
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
    }
}