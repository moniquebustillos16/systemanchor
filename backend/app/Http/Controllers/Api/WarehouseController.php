<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function index()
    {
        return response()->json(
            Warehouse::all()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'code'     => 'required|string|max:50',
            'address'  => 'nullable|string',
            'location' => 'nullable|string',
            'capacity' => 'nullable|numeric|min:0',
            'status'   => 'nullable',
            'manager'  => 'nullable|string|max:255',
        ]);

        // Normalize status to the string format used in the DB
        $status = $data['status'] ?? true;
        if (is_bool($status)) {
            $status = $status ? 'active' : 'inactive';
        } elseif (is_string($status)) {
            $status = strtolower($status) === 'active' ? 'active' : 'inactive';
        } else {
            $status = 'active';
        }

        // Prefer "location" column; fall back to "address"
        $location = $data['location'] ?? $data['address'] ?? null;

        $warehouse = Warehouse::create([
            'name'     => $data['name'],
            'code'     => $data['code'],
            'location' => $location,
            'capacity' => $data['capacity'] ?? 0,
            'status'   => $status,
            'manager'  => $data['manager'] ?? null,
        ]);

        return response()->json($warehouse, 201);
    }

    public function show($id)
    {
        $warehouse = Warehouse::findOrFail($id);
        return response()->json($warehouse);
    }

    public function update(Request $request, $id)
    {
        $warehouse = Warehouse::findOrFail($id);

        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'code'     => 'sometimes|string|max:50',
            'address'  => 'nullable|string',
            'location' => 'nullable|string',
            'capacity' => 'nullable|numeric|min:0',
            'status'   => 'nullable',
            'manager'  => 'nullable|string|max:255',
        ]);

        if (array_key_exists('status', $data)) {
            $status = $data['status'];
            if (is_bool($status)) {
                $data['status'] = $status ? 'active' : 'inactive';
            } elseif (is_string($status)) {
                $data['status'] = strtolower($status) === 'active' ? 'active' : 'inactive';
            }
        }

        // Map address → location if location was not sent
        if (!isset($data['location']) && isset($data['address'])) {
            $data['location'] = $data['address'];
        }
        unset($data['address']);

        $warehouse->update($data);

        return response()->json($warehouse->fresh());
    }

    public function destroy($id)
    {
        $warehouse = Warehouse::findOrFail($id);
        $warehouse->delete();

        return response()->json([
            'message' => 'Warehouse deleted successfully'
        ]);
    }
}