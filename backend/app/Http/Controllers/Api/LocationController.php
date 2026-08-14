<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bin;
use App\Models\Warehouse;
use App\Models\Zone;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function stats()
    {
        return response()->json([
            'zones'      => Zone::whereNull('deleted_at')->count(),
            'bins'       => Bin::whereNull('deleted_at')->count(),
            'warehouses' => Warehouse::whereNull('deleted_at')->count(),
            'capacity'   => (int) Bin::whereNull('deleted_at')->sum('capacity'),
        ]);
    }

    public function zones(Request $request)
    {
        $query = Zone::with('warehouse:id,code,name')
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('type', 'ilike', "%{$search}%")
                  ->orWhereHas('warehouse', fn ($w) => $w->where('code', 'ilike', "%{$search}%")->orWhere('name', 'ilike', "%{$search}%"));
            });
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('warehouse') && $request->warehouse !== 'all') {
            $query->whereHas('warehouse', fn ($w) => $w->where('code', $request->warehouse));
        }

        $zones = $query->orderBy('name')->get()->map(fn (Zone $z) => [
            'id'        => $z->id,
            'warehouse' => $z->warehouse?->code ?? $z->warehouse?->name ?? '—',
            'name'      => $z->name,
            'type'      => $z->type,
            'bins'      => $z->bins_count,
            'capacity'  => $z->capacity_pct,
        ]);

        return response()->json($zones);
    }

    public function bins(Request $request)
    {
        $query = Bin::with([
                'zone:id,name',
                'warehouse:id,code,name',
                'product:id,name,sku',
            ])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'ilike', "%{$search}%")
                  ->orWhereHas('zone', fn ($z) => $z->where('name', 'ilike', "%{$search}%"))
                  ->orWhereHas('product', fn ($p) => $p->where('name', 'ilike', "%{$search}%")->orWhere('sku', 'ilike', "%{$search}%"));
            });
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('warehouse') && $request->warehouse !== 'all') {
            $query->whereHas('warehouse', fn ($w) => $w->where('code', $request->warehouse));
        }

        $bins = $query->orderBy('code')->get()->map(fn (Bin $b) => [
            'id'        => $b->id,
            'code'      => $b->code,
            'zone'      => $b->zone?->name ?? '—',
            'warehouse' => $b->warehouse?->code ?? $b->warehouse?->name ?? '—',
            'product'   => $b->product?->name ?? '—',
            'qty'       => $b->qty,
            'capacity'  => $b->capacity,
        ]);

        return response()->json($bins);
    }

    public function warehouses()
    {
        $list = Warehouse::whereNull('deleted_at')
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        return response()->json($list);
    }
}