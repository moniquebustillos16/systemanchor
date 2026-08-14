<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Always load role + warehouse (users.warehouse_id → warehouses).
     */
    protected function userWith(): array
    {
        return ['role', 'warehouse'];
    }

    /**
     * GET /api/users
     */
    public function index(Request $request)
    {
        $query = User::with($this->userWith())->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($roleId = $request->query('role_id')) {
            $query->where('role_id', $roleId);
        }

        if ($warehouseId = $request->query('warehouse_id')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $sort = $request->query('sort', 'name');
        $dir  = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
        $allowedSorts = ['name', 'email', 'status', 'created_at', 'last_login_at'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'name';
        }
        $query->orderBy($sort, $dir);

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        if ($request->boolean('paginate', true) && !$request->has('all')) {
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data'         => $paginator->items(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
            ]);
        }

        return response()->json([
            'data' => $query->limit($perPage)->get(),
        ]);
    }

    /**
     * GET /api/users/{id}
     */
    public function show(string $id)
    {
        $user = User::with($this->userWith())->findOrFail($id);

        return response()->json(['data' => $user]);
    }

    /**
     * POST /api/users
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|max:255|unique:users,email',
            'password'     => 'required|string|min:6|max:255',
            'role_id'      => 'nullable|uuid|exists:roles,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'status'       => 'nullable|string|max:30|in:active,inactive,suspended',
            'phone'        => 'nullable|string|max:50',
            'job_title'    => 'nullable|string|max:150',
            'department'   => 'nullable|string|max:150',
        ]);

        $user = User::create([
            'name'         => $validated['name'],
            'email'        => $validated['email'],
            'password'     => $validated['password'],
            'role_id'      => $validated['role_id'] ?? null,
            'warehouse_id' => $validated['warehouse_id'] ?? null,
            'status'       => $validated['status'] ?? 'active',
            'phone'        => $validated['phone'] ?? null,
            'job_title'    => $validated['job_title'] ?? null,
            'department'   => $validated['department'] ?? null,
        ]);

        $user->load($this->userWith());

        return response()->json([
            'message' => 'User created successfully',
            'data'    => $user,
        ], 201);
    }

    /**
     * PUT / PATCH /api/users/{id}
     */
    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name'         => 'sometimes|required|string|max:255',
            'email'        => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password'     => 'sometimes|nullable|string|min:6|max:255',
            'role_id'      => 'nullable|uuid|exists:roles,id',
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'status'       => 'nullable|string|max:30|in:active,inactive,suspended',
            'phone'        => 'nullable|string|max:50',
            'job_title'    => 'nullable|string|max:150',
            'department'   => 'nullable|string|max:150',
        ]);

        if (array_key_exists('password', $validated) && empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);
        $user->load($this->userWith());

        return response()->json([
            'message' => 'User updated successfully',
            'data'    => $user,
        ]);
    }

    /**
     * DELETE /api/users/{id}
     */
    public function destroy(string $id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * GET /api/users/stats
     */
    public function stats()
    {
        $base = User::whereNull('deleted_at');

        return response()->json([
            'all'       => (clone $base)->count(),
            'active'    => (clone $base)->where('status', 'active')->count(),
            'inactive'  => (clone $base)->where('status', 'inactive')->count(),
            'suspended' => (clone $base)->where('status', 'suspended')->count(),
        ]);
    }
}