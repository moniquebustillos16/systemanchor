<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WarehouseAccessMiddleware
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        /*
         * Users with access_all_warehouses can access
         * every warehouse.
         */
        if ((bool) $user->access_all_warehouses) {
            $request->attributes->set('warehouse_ids', null);

            return $next($request);
        }

        /*
         * Get ALL warehouses assigned to this user.
         *
         * This is important:
         *
         * User A:
         *   Warehouse A
         *   Warehouse B
         *
         * will receive:
         *
         *   [A, B]
         */
        $warehouseIds = $user->warehouses()
            ->pluck('warehouses.id')
            ->map(fn ($id) => (string) $id)
            ->values()
            ->all();

        /*
         * Also include the user's primary warehouse
         * if it isn't already in the assignment table.
         */
        if ($user->warehouse_id) {
            $primaryWarehouseId = (string) $user->warehouse_id;

            if (!in_array($primaryWarehouseId, $warehouseIds, true)) {
                $warehouseIds[] = $primaryWarehouseId;
            }
        }

        /*
         * No assigned warehouses.
         */
        if (empty($warehouseIds)) {
            return response()->json([
                'message' => 'No warehouse access has been assigned to this user.',
            ], 403);
        }

        /*
         * Make the allowed warehouse IDs available
         * to controllers.
         */
        $request->attributes->set(
            'warehouse_ids',
            array_values(array_unique($warehouseIds))
        );

        return $next($request);
    }
}