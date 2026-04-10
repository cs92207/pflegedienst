<?php

namespace App\Http\Controllers;

use App\Models\DailyRoute;
use App\Services\DailyRoutePlannerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class DailyRouteController extends Controller
{
    public function __construct(private DailyRoutePlannerService $plannerService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->ensureDailyRouteTablesExist()) {
            return $response;
        }

        $query = DailyRoute::query()
            ->with(['employee', 'planner', 'stops'])
            ->orderByDesc('route_date')
            ->orderBy('employee_id');

        if ($date = $request->input('date')) {
            $query->whereDate('route_date', $date);
        }

        if ($employeeId = $request->input('employee_id')) {
            $query->where('employee_id', $employeeId);
        }

        return response()->json([
            'success' => 1,
            'routes' => $query->get()->map(fn (DailyRoute $route) => $this->serializeRoute($route)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->ensureDailyRouteTablesExist()) {
            return $response;
        }

        $validated = $this->validatePayload($request);

        try {
            $dailyRoute = $this->plannerService->createPlannedRoute($validated, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => 0,
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Tagesroute wurde erstellt.',
            'route' => $this->serializeRoute($dailyRoute),
        ], 201);
    }

    public function update(Request $request, DailyRoute $dailyRoute): JsonResponse
    {
        if ($response = $this->ensureDailyRouteTablesExist()) {
            return $response;
        }

        $validated = $this->validatePayload($request);

        try {
            $updatedRoute = $this->plannerService->updatePlannedRoute($dailyRoute, $validated, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => 0,
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Tagesroute wurde aktualisiert.',
            'route' => $this->serializeRoute($updatedRoute),
        ]);
    }

    public function show(DailyRoute $dailyRoute): JsonResponse
    {
        return response()->json([
            'success' => 1,
            'route' => $this->serializeRoute($dailyRoute->load(['employee', 'planner', 'stops'])),
        ]);
    }

    public function destroy(DailyRoute $dailyRoute): JsonResponse
    {
        $dailyRoute->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Tagesroute wurde gelöscht.',
        ]);
    }

    private function serializeRoute(DailyRoute $route): array
    {
        return [
            'id' => $route->id,
            'route_name' => $route->route_name,
            'route_date' => $route->route_date?->toDateString(),
            'shift_start_time' => $route->shift_start_time,
            'start_address' => $route->start_address,
            'end_address' => $route->end_address,
            'total_travel_minutes' => $route->total_travel_minutes,
            'total_service_minutes' => $route->total_service_minutes,
            'total_distance_meters' => $route->total_distance_meters,
            'route_geometry' => $route->route_geometry ?? [],
            'summary' => $route->summary ?? [],
            'employee' => $route->employee ? [
                'id' => $route->employee->id,
                'name' => $route->employee->name,
                'email' => $route->employee->email,
            ] : null,
            'planner' => $route->planner ? [
                'id' => $route->planner->id,
                'name' => $route->planner->name,
                'email' => $route->planner->email,
            ] : null,
            'stops' => $route->stops->map(fn ($stop) => [
                'id' => $stop->id,
                'patient_id' => $stop->patient_id,
                'stop_order' => $stop->stop_order,
                'patient_name' => $stop->patient_name,
                'patient_number' => $stop->patient_number,
                'address_line' => $stop->address_line,
                'zip_code' => $stop->zip_code,
                'city' => $stop->city,
                'latitude' => (float) $stop->latitude,
                'longitude' => (float) $stop->longitude,
                'scheduled_for' => $stop->scheduled_for,
                'service_minutes' => $stop->service_minutes,
                'travel_minutes_from_previous' => $stop->travel_minutes_from_previous,
                'travel_distance_meters' => $stop->travel_distance_meters,
                'waiting_minutes' => $stop->waiting_minutes,
                'arrival_time' => $stop->arrival_time,
                'departure_time' => $stop->departure_time,
                'fixed_time' => (bool) $stop->fixed_time,
                'notes' => $stop->notes,
                'meta' => $stop->meta ?? new \stdClass(),
            ])->values(),
            'created_at' => $route->created_at?->toISOString(),
            'updated_at' => $route->updated_at?->toISOString(),
        ];
    }

    private function ensureDailyRouteTablesExist(): ?JsonResponse
    {
        if (Schema::hasTable('daily_routes') && Schema::hasTable('daily_route_stops')) {
            return null;
        }

        return response()->json([
            'success' => 0,
            'message' => 'Die Tagesrouten-Funktion ist noch nicht aktiv, weil die Datenbanktabellen fehlen. Bitte im Backend zuerst die Migrationen ausführen. Der letzte Migrationslauf ist laut Log an fehlendem Speicherplatz gescheitert.',
        ], 503);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'route_date' => ['required', 'date'],
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'shift_start_time' => ['nullable', 'date_format:H:i'],
            'start_address' => ['nullable', 'string', 'max:255'],
            'end_address' => ['nullable', 'string', 'max:255'],
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.patient_id' => ['required', 'integer', 'distinct', 'exists:patients,id'],
            'stops.*.service_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'stops.*.fixed_time' => ['nullable', 'date_format:H:i'],
            'stops.*.notes' => ['nullable', 'string', 'max:500'],
        ]);
    }
}