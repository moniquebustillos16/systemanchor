<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bin;
use App\Models\Warehouse;
use App\Models\Zone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class LocationController extends Controller
{
    private const STATS_CACHE_TTL = 20; // seconds

    /* ─────────────────────────────────────────────
     |  STATS
     ───────────────────────────────────────────── */

    public function stats()
    {
        $payload = Cache::remember('locations:stats', self::STATS_CACHE_TTL, function () {
            return [
                'zones'      => (int) Zone::query()->whereNull('deleted_at')->count(),
                'bins'       => (int) Bin::query()->whereNull('deleted_at')->count(),
                'warehouses' => (int) Warehouse::query()->whereNull('deleted_at')->count(),
                'capacity'   => (int) Bin::query()->whereNull('deleted_at')->sum('capacity'),
            ];
        });

        return response()->json($payload);
    }

    /* ─────────────────────────────────────────────
     |  ZONES
     ───────────────────────────────────────────── */

    public function zones(Request $request)
    {
        $query = Zone::query()
            ->select(['id', 'name', 'type', 'warehouse_id'])
            ->with(['warehouse:id,code,name'])
            ->withCount([
                'bins' => fn ($q) => $q->whereNull('deleted_at'),
            ])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('type', 'ilike', "%{$search}%")
                    ->orWhereHas(
                        'warehouse',
                        fn ($w) => $w->where('code', 'ilike', "%{$search}%")
                            ->orWhere('name', 'ilike', "%{$search}%")
                    );
            });
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('warehouse') && $request->warehouse !== 'all') {
            $query->whereHas(
                'warehouse',
                fn ($w) => $w->where('code', $request->warehouse)
            );
        }

        $perPage = min(max((int) $request->query('per_page', 100), 1), 500);

        // Default: capped list (UI currently expects an array)
        if (!$request->boolean('paginate')) {
            $zones = $query->orderBy('name')->limit($perPage)->get()->map(
                fn (Zone $z) => $this->mapZone($z)
            );

            return response()->json($zones);
        }

        $page = $query->orderBy('name')->paginate($perPage);
        $page->getCollection()->transform(fn (Zone $z) => $this->mapZone($z));

        return response()->json($page);
    }

    /* ─────────────────────────────────────────────
     |  BINS
     ───────────────────────────────────────────── */

    public function bins(Request $request)
    {
        $query = Bin::query()
            ->select([
                'id',
                'code',
                'qty',
                'capacity',
                'zone_id',
                'warehouse_id',
                'product_id',
            ])
            ->with([
                'zone:id,name',
                'warehouse:id,code,name',
                'product:id,name,sku',
            ])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'ilike', "%{$search}%")
                    ->orWhereHas(
                        'zone',
                        fn ($z) => $z->where('name', 'ilike', "%{$search}%")
                    )
                    ->orWhereHas(
                        'product',
                        fn ($p) => $p->where('name', 'ilike', "%{$search}%")
                            ->orWhere('sku', 'ilike', "%{$search}%")
                    );
            });
        }

        if ($request->filled('warehouse_id') && $request->warehouse_id !== 'all') {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('warehouse') && $request->warehouse !== 'all') {
            $query->whereHas(
                'warehouse',
                fn ($w) => $w->where('code', $request->warehouse)
            );
        }

        $perPage = min(max((int) $request->query('per_page', 100), 1), 500);

        if (!$request->boolean('paginate')) {
            $bins = $query->orderBy('code')->limit($perPage)->get()->map(
                fn (Bin $b) => $this->mapBin($b)
            );

            return response()->json($bins);
        }

        $page = $query->orderBy('code')->paginate($perPage);
        $page->getCollection()->transform(fn (Bin $b) => $this->mapBin($b));

        return response()->json($page);
    }

    /* ─────────────────────────────────────────────
     |  WAREHOUSES (dropdown)
     ───────────────────────────────────────────── */

    public function warehouses()
    {
        $list = Warehouse::query()
            ->whereNull('deleted_at')
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        return response()->json($list);
    }

    /* ─────────────────────────────────────────────
     |  MAPPERS
     ───────────────────────────────────────────── */

    private function mapZone(Zone $z): array
    {
        $capacity = 0;
        // Prefer real columns if they exist; avoid per-row DB accessors
        if (isset($z->capacity_pct)) {
            $capacity = (int) $z->capacity_pct;
        } elseif (isset($z->capacity)) {
            $capacity = (int) $z->capacity;
        }

        return [
            'id'        => $z->id,
            'warehouse' => $z->warehouse?->code ?? $z->warehouse?->name ?? '—',
            'name'      => $z->name,
            'type'      => $z->type,
            'bins'      => (int) ($z->bins_count ?? 0),
            'capacity'  => $capacity,
        ];
    }

    private function mapBin(Bin $b): array
    {
        return [
            'id'        => $b->id,
            'code'      => $b->code,
            'zone'      => $b->zone?->name ?? '—',
            'warehouse' => $b->warehouse?->code ?? $b->warehouse?->name ?? '—',
            'product'   => $b->product?->name ?? '—',
            'qty'       => $b->qty,
            'capacity'  => $b->capacity,
        ];
    }

    /** Call after zone/bin/warehouse create|update|delete */
    public static function bustStatsCache(): void
    {
        Cache::forget('locations:stats');
    }
}