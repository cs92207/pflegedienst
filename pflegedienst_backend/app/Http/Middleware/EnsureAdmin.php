<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            return response()->json([
                'success' => 0,
                'message' => 'Nur Administratoren haben Zugriff auf diesen Bereich.',
            ], 403);
        }

        return $next($request);
    }
}