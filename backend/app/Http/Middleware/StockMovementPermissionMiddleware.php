<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StockMovementPermissionMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if (strcasecmp((string) $user->role?->name, 'Admin') === 0) {
            return $next($request);
        }

        $type = strtolower((string) $request->input('type'));
        $permission = match ($type) {
            'in' => 'stock.in',
            'out' => 'stock.out',
            'transfer' => 'stock.transfer',
            'adjust', 'adjustment' => 'stock.adjust',
            default => null,
        };

        if (! $permission || (! $user->hasPermission($permission) && ! $user->hasPermission('movements.create'))) {
            return response()->json([
                'message' => 'You do not have permission to perform this stock movement.',
            ], 403);
        }

        return $next($request);
    }
}
