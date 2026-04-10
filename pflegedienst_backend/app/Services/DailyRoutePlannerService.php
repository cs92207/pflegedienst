<?php

namespace App\Services;

use App\Models\DailyRoute;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DailyRoutePlannerService
{
    public function __construct(private OpenStreetMapRoutingService $routingService)
    {
    }

    public function createPlannedRoute(array $payload, User $planner): DailyRoute
    {
        return $this->savePlannedRoute(null, $payload, $planner);
    }

    public function updatePlannedRoute(DailyRoute $dailyRoute, array $payload, User $planner): DailyRoute
    {
        return $this->savePlannedRoute($dailyRoute, $payload, $planner);
    }

    private function savePlannedRoute(?DailyRoute $dailyRoute, array $payload, User $planner): DailyRoute
    {
        $employee = User::query()->findOrFail($payload['employee_id']);
        $routeDate = Carbon::parse($payload['route_date'])->startOfDay();
        $shiftStartTime = $payload['shift_start_time'] ?? '08:00';
        $startAddress = trim((string) ($payload['start_address'] ?? '')) ?: null;
        $endAddress = trim((string) ($payload['end_address'] ?? '')) ?: null;

        $requestedStops = collect($payload['stops'] ?? []);
        $patients = Patient::query()
            ->whereIn('id', $requestedStops->pluck('patient_id')->all())
            ->get()
            ->keyBy('id');

        if ($patients->count() !== $requestedStops->count()) {
            throw ValidationException::withMessages([
                'stops' => 'Mindestens ein ausgewählter Pflegekunde existiert nicht mehr.',
            ]);
        }

        $geoCache = [];
        $stops = $requestedStops->values()->map(function (array $input, int $index) use ($patients, &$geoCache) {
            $patient = $patients->get($input['patient_id']);
            $addressLine = $this->buildPatientAddress($patient);
            $geo = $geoCache[$addressLine] ??= $this->routingService->geocode($addressLine);

            return [
                'list_index' => $index,
                'patient' => $patient,
                'service_minutes' => (int) $input['service_minutes'],
                'fixed_time' => $input['fixed_time'] ?? null,
                'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
                'address_line' => $addressLine,
                'zip_code' => (string) ($patient->zip_code ?? ''),
                'city' => (string) ($patient->city ?? ''),
                'lat' => $geo['lat'],
                'lng' => $geo['lng'],
            ];
        });

        $points = [];
        $startIndex = null;
        $endIndex = null;

        if ($startAddress) {
            $startGeo = $geoCache[$startAddress] ??= $this->routingService->geocode($startAddress);
            $startIndex = count($points);
            $points[] = ['lat' => $startGeo['lat'], 'lng' => $startGeo['lng']];
        }

        $stops = $stops->map(function (array $stop) use (&$points) {
            $stop['node_index'] = count($points);
            $points[] = ['lat' => $stop['lat'], 'lng' => $stop['lng']];
            return $stop;
        });

        if ($endAddress) {
            $endGeo = $geoCache[$endAddress] ??= $this->routingService->geocode($endAddress);
            $endIndex = count($points);
            $points[] = ['lat' => $endGeo['lat'], 'lng' => $endGeo['lng']];
        }

        $matrix = $this->routingService->getMatrix($points);
        $planned = $this->buildPlan(
            $stops->all(),
            $matrix['durations'] ?? [],
            $matrix['distances'] ?? [],
            $routeDate,
            $shiftStartTime,
            $startIndex
        );

        if (!empty($matrix['meta']['warning'])) {
            $planned['warnings'][] = $matrix['meta']['warning'];
        }

        $orderedPoints = [];
        if ($startIndex !== null) {
            $orderedPoints[] = $points[$startIndex];
        }
        foreach ($planned['stops'] as $stop) {
            $orderedPoints[] = ['lat' => $stop['latitude'], 'lng' => $stop['longitude']];
        }
        if ($endIndex !== null) {
            $orderedPoints[] = $points[$endIndex];
        }

        $finalLeg = $this->calculateFinalLeg($planned['last_node_index'], $endIndex, $matrix['durations'] ?? [], $matrix['distances'] ?? [], $planned['timeline']);
        $geometry = $this->routingService->getRouteGeometry($orderedPoints);

        return DB::transaction(function () use ($dailyRoute, $employee, $planner, $routeDate, $shiftStartTime, $startAddress, $endAddress, $planned, $finalLeg, $geometry) {
            $dailyRoute ??= new DailyRoute();

            $dailyRoute->fill([
                'route_name' => sprintf('Tagesroute %s %s', $employee->name, $routeDate->format('d.m.Y')),
                'route_date' => $routeDate->toDateString(),
                'employee_id' => $employee->id,
                'planner_id' => $planner->id,
                'shift_start_time' => $shiftStartTime,
                'start_address' => $startAddress,
                'end_address' => $endAddress,
                'total_travel_minutes' => $planned['total_travel_minutes'] + $finalLeg['travel_minutes'],
                'total_service_minutes' => $planned['total_service_minutes'],
                'total_distance_meters' => $planned['total_distance_meters'] + $finalLeg['distance_meters'],
                'route_geometry' => $geometry,
                'summary' => [
                    'warnings' => $planned['warnings'],
                    'used_estimated_travel_data' => (bool) ($matrix['meta']['used_fallback'] ?? false),
                    'final_leg' => $finalLeg,
                    'end_time' => $finalLeg['arrival_time'],
                ],
            ]);

            $dailyRoute->save();
            $dailyRoute->stops()->delete();

            foreach ($planned['stops'] as $stop) {
                $dailyRoute->stops()->create([
                    'patient_id' => $stop['patient_id'],
                    'stop_order' => $stop['stop_order'],
                    'patient_name' => $stop['patient_name'],
                    'patient_number' => $stop['patient_number'],
                    'address_line' => $stop['address_line'],
                    'zip_code' => $stop['zip_code'],
                    'city' => $stop['city'],
                    'latitude' => $stop['latitude'],
                    'longitude' => $stop['longitude'],
                    'scheduled_for' => $stop['scheduled_for'],
                    'service_minutes' => $stop['service_minutes'],
                    'travel_minutes_from_previous' => $stop['travel_minutes_from_previous'],
                    'travel_distance_meters' => $stop['travel_distance_meters'],
                    'waiting_minutes' => $stop['waiting_minutes'],
                    'arrival_time' => $stop['arrival_time'],
                    'departure_time' => $stop['departure_time'],
                    'fixed_time' => $stop['fixed_time'],
                    'notes' => $stop['notes'],
                    'meta' => [
                        'lateness_minutes' => $stop['lateness_minutes'],
                    ],
                ]);
            }

            return $dailyRoute->load(['employee', 'planner', 'stops']);
        });
    }

    private function buildPlan(array $stops, array $durations, array $distances, Carbon $routeDate, string $shiftStartTime, ?int $startIndex): array
    {
        $remaining = collect($stops)->values();
        $timeline = Carbon::parse($routeDate->toDateString() . ' ' . $shiftStartTime);
        $currentNodeIndex = $startIndex;
        $orderedStops = [];
        $warnings = [];
        $totalTravelMinutes = 0;
        $totalServiceMinutes = 0;
        $totalDistanceMeters = 0;

        while ($remaining->isNotEmpty()) {
            $nextStop = $this->chooseNextStop($remaining->all(), $durations, $timeline, $currentNodeIndex, $routeDate);
            $travelSeconds = $currentNodeIndex === null ? 0 : (int) round($durations[$currentNodeIndex][$nextStop['node_index']] ?? 0);
            $distanceMeters = $currentNodeIndex === null ? 0 : (int) round($distances[$currentNodeIndex][$nextStop['node_index']] ?? 0);
            $travelMinutes = (int) ceil($travelSeconds / 60);
            $arrival = $timeline->copy()->addMinutes($travelMinutes);

            $scheduledFor = $nextStop['fixed_time'];
            $scheduledAt = $scheduledFor ? Carbon::parse($routeDate->toDateString() . ' ' . $scheduledFor) : null;
            $serviceStart = $scheduledAt && $arrival->lt($scheduledAt) ? $scheduledAt->copy() : $arrival->copy();
            $waitingMinutes = max(0, $arrival->diffInMinutes($serviceStart, false));
            $latenessMinutes = $scheduledAt && $arrival->gt($scheduledAt) ? $scheduledAt->diffInMinutes($arrival) : 0;

            if ($latenessMinutes > 0) {
                $warnings[] = sprintf(
                    '%s wird voraussichtlich %d Minuten nach der gewünschten Uhrzeit erreicht.',
                    $nextStop['patient']->full_name,
                    $latenessMinutes
                );
            }

            $departure = $serviceStart->copy()->addMinutes($nextStop['service_minutes']);

            $orderedStops[] = [
                'patient_id' => $nextStop['patient']->id,
                'stop_order' => count($orderedStops) + 1,
                'patient_name' => $nextStop['patient']->full_name,
                'patient_number' => $nextStop['patient']->patient_number,
                'address_line' => $nextStop['address_line'],
                'zip_code' => $nextStop['zip_code'],
                'city' => $nextStop['city'],
                'latitude' => $nextStop['lat'],
                'longitude' => $nextStop['lng'],
                'scheduled_for' => $scheduledFor,
                'service_minutes' => $nextStop['service_minutes'],
                'travel_minutes_from_previous' => $travelMinutes,
                'travel_distance_meters' => $distanceMeters,
                'waiting_minutes' => $waitingMinutes,
                'arrival_time' => $arrival->format('H:i'),
                'departure_time' => $departure->format('H:i'),
                'fixed_time' => $scheduledFor !== null,
                'notes' => $nextStop['notes'],
                'lateness_minutes' => $latenessMinutes,
            ];

            $totalTravelMinutes += $travelMinutes;
            $totalDistanceMeters += $distanceMeters;
            $totalServiceMinutes += $nextStop['service_minutes'];

            $timeline = $departure;
            $currentNodeIndex = $nextStop['node_index'];
            $remaining = $remaining->reject(fn (array $stop) => $stop['list_index'] === $nextStop['list_index'])->values();
        }

        return [
            'stops' => $orderedStops,
            'warnings' => $warnings,
            'total_travel_minutes' => $totalTravelMinutes,
            'total_service_minutes' => $totalServiceMinutes,
            'total_distance_meters' => $totalDistanceMeters,
            'last_node_index' => $currentNodeIndex,
            'timeline' => $timeline,
        ];
    }

    private function chooseNextStop(array $candidates, array $durations, Carbon $timeline, ?int $currentNodeIndex, Carbon $routeDate): array
    {
        $best = null;
        $bestScore = null;

        foreach ($candidates as $candidate) {
            $travelSeconds = $currentNodeIndex === null
                ? $this->estimateInitialTravelCost($candidate, $candidates, $durations)
                : (int) round($durations[$currentNodeIndex][$candidate['node_index']] ?? 0);

            $travelMinutes = (int) ceil($travelSeconds / 60);
            $arrival = $timeline->copy()->addMinutes($travelMinutes);

            $score = $travelMinutes;

            if ($candidate['fixed_time']) {
                $scheduledAt = Carbon::parse($routeDate->toDateString() . ' ' . $candidate['fixed_time']);
                $latenessMinutes = $scheduledAt->lt($arrival) ? $scheduledAt->diffInMinutes($arrival) : 0;
                $earlinessMinutes = $scheduledAt->gt($arrival) ? $arrival->diffInMinutes($scheduledAt) : 0;

                $score += ($latenessMinutes * 100) + ($earlinessMinutes * 0.2);
            }

            if ($best === null || $score < $bestScore) {
                $best = $candidate;
                $bestScore = $score;
            }
        }

        return $best;
    }

    private function estimateInitialTravelCost(array $candidate, array $candidates, array $durations): int
    {
        $otherDurations = collect($candidates)
            ->reject(fn (array $other) => $other['list_index'] === $candidate['list_index'])
            ->map(fn (array $other) => (int) round($durations[$candidate['node_index']][$other['node_index']] ?? 0))
            ->filter(fn (int $duration) => $duration > 0)
            ->values();

        if ($otherDurations->isEmpty()) {
            return 0;
        }

        return (int) round($otherDurations->avg());
    }

    private function calculateFinalLeg(?int $lastNodeIndex, ?int $endIndex, array $durations, array $distances, Carbon $timeline): array
    {
        if ($lastNodeIndex === null || $endIndex === null) {
            return [
                'travel_minutes' => 0,
                'distance_meters' => 0,
                'arrival_time' => $timeline->format('H:i'),
            ];
        }

        $travelMinutes = (int) ceil(((int) round($durations[$lastNodeIndex][$endIndex] ?? 0)) / 60);
        $distanceMeters = (int) round($distances[$lastNodeIndex][$endIndex] ?? 0);

        return [
            'travel_minutes' => $travelMinutes,
            'distance_meters' => $distanceMeters,
            'arrival_time' => $timeline->copy()->addMinutes($travelMinutes)->format('H:i'),
        ];
    }

    private function buildPatientAddress(Patient $patient): string
    {
        $parts = array_filter([
            trim((string) $patient->street . ' ' . (string) $patient->house_number),
            trim((string) $patient->zip_code . ' ' . (string) $patient->city),
        ]);

        if (count($parts) < 2) {
            throw ValidationException::withMessages([
                'stops' => sprintf('Für %s fehlt eine vollständige Adresse.', $patient->full_name),
            ]);
        }

        return implode(', ', $parts);
    }
}