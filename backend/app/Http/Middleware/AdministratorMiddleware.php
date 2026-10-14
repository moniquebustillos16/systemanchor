<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdministratorMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || strcasecmp((string) $user->role?->name, 'Admin') !== 0) {
            return response()->json([
                'message' => 'Administrator access is required.',
            ], $user ? 403 : 401);
        }

        return $next($request);
    }
}
