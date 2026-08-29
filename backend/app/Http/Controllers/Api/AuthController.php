<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::with('role')->where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password',
            ], 401);
        }

        // Optional: update last login
        $user->update(['last_login_at' => now()]);

        $token = $user->createToken('systemanchor-api-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'token'   => $token,
            'user'    => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'role_id'  => $user->role_id,
                'role'     => $user->role?->name ?? null,   // safe access
                'status'   => $user->status,
                'image_url'=> $user->image_url,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

   public function me(Request $request)
{
    $user = $request->user()->load('role');

    // Get all permission names of this user (through their role)
    $permissions = [];

    if ($user->role) {
        // Load the permissions of the role
        $user->role->load('permissions');
        $permissions = $user->role->permissions->pluck('name')->toArray();
    }

    return response()->json([
        'user' => [
            'id'                     => $user->id,
            'name'                   => $user->name,
            'email'                  => $user->email,
            'role_id'                => $user->role_id,
            'warehouse_id'           => $user->warehouse_id,
            'access_all_warehouses'  => $user->access_all_warehouses,
            'status'                 => $user->status,
            'phone'                  => $user->phone,
            'job_title'              => $user->job_title,
            'department'             => $user->department,
            'image_path'             => $user->image_path,
            'image_url'              => $user->image_url,
            'last_login_at'          => $user->last_login_at,
            'created_at'             => $user->created_at,
            'updated_at'             => $user->updated_at,
            'role'                   => $user->role,
            'permissions'            => $permissions,   // ← this is the important part
        ],
    ]);
}
}