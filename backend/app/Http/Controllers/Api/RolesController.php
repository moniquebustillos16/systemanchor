<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Roles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class RolesController extends Controller
{
    private const LIST_COLUMNS = ['id', 'name', 'description', 'created_at', 'updated_at'];

    /**
     * GET /api/roles
     * Fast path: paginate=false|all=1 → plain { success, data: [...] }
     */
    public function index(Request $request)
    {
        try {
            if (!Schema::hasTable('roles')) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $cols = array_values(array_filter(
                self::LIST_COLUMNS,
                fn (string $c) => Schema::hasColumn('roles', $c)
            ));
            if ($cols === []) {
                $cols = ['id', 'name'];
            }

            $query = DB::table('roles')->select($cols);

            if (Schema::hasColumn('roles', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $search = trim((string) $request->query('search', ''));
            if ($search !== '') {
                $driver = DB::getDriverName();
                $op = $driver === 'pgsql' ? 'ilike' : 'like';
                $query->where(function ($q) use ($search, $op, $cols) {
                    if (in_array('name', $cols, true)) {
                        $q->where('name', $op, "%{$search}%");
                    }
                    if (in_array('description', $cols, true)) {
                        $q->orWhere('description', $op, "%{$search}%");
                    }
                });
            }

            $sort = $request->query('sort', in_array('name', $cols, true) ? 'name' : $cols[0]);
            if (!in_array($sort, $cols, true)) {
                $sort = $cols[0];
            }
            $dir = $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $dir);

            $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
            $plain = $request->boolean('all')
                || $request->has('all')
                || !$request->boolean('paginate', true);

            if ($plain) {
                $rows = $query->limit($perPage)->get();
                return response()->json([
                    'success' => true,
                    'data'    => $rows,
                ]);
            }

            $total = (clone $query)->count();
            $page  = max((int) $request->query('page', 1), 1);
            $items = $query->forPage($page, $perPage)->get();

            return response()->json([
                'success'      => true,
                'data'         => $items,
                'current_page' => $page,
                'last_page'    => (int) ceil($total / max($perPage, 1)) ?: 1,
                'total'        => $total,
                'per_page'     => $perPage,
            ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'success' => false,
                'message' => 'Failed to load roles',
                'error'   => config('app.debug') ? $e->getMessage() : null,
                'data'    => [],
            ], 200);
        }
    }

    public function show(string $id)
    {
        try {
            $role = Roles::query()->select($this->safeSelect())->findOrFail($id);
            return response()->json(['success' => true, 'data' => $role]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['success' => false, 'message' => 'Role not found'], 404);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:100|unique:roles,name',
            'description' => 'nullable|string|max:255',
        ]);

        $role = Roles::create([
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role created successfully',
            'data'    => $role->only($this->safeSelect()),
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $role = Roles::query()->findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'description' => 'nullable|string|max:255',
        ]);

        $role->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Role updated successfully',
            'data'    => $role->fresh()->only($this->safeSelect()),
        ]);
    }

    public function destroy(string $id)
    {
        Roles::query()->findOrFail($id)->delete();
        return response()->json([
            'success' => true,
            'message' => 'Role deleted successfully',
        ]);
    }

    public function stats()
    {
        try {
            $q = DB::table('roles');
            if (Schema::hasColumn('roles', 'deleted_at')) {
                $q->whereNull('deleted_at');
            }
            return response()->json([
                'success' => true,
                'data'    => ['all' => $q->count()],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => true, 'data' => ['all' => 0]]);
        }
    }

    /** @return string[] */
    private function safeSelect(): array
    {
        try {
            $cols = array_values(array_filter(
                self::LIST_COLUMNS,
                fn (string $c) => Schema::hasColumn('roles', $c)
            ));
            return $cols !== [] ? $cols : ['id', 'name'];
        } catch (\Throwable $e) {
            return ['id', 'name'];
        }
    }
}