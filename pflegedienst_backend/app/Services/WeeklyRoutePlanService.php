<?php

namespace App\Services;

use App\Models\Patient;
use App\Models\User;
use App\Models\WeeklyRouteOverride;
use App\Models\WeeklyRouteTemplate;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WeeklyRoutePlanService
{
    public function __construct(private OpenStreetMapRoutingService $routingService)
    {
    }

    public function listTemplates(): Collection
    {
        return WeeklyRouteTemplate::query()
            ->with(['employee', 'planner', 'stops'])
            ->orderBy('weekday')
            ->orderBy('route_name')
            ->orderBy('employee_id')
            ->get();
    }

    public function listTemplatesForEmployee(int $employeeId): Collection
    {
        return WeeklyRouteTemplate::query()
            ->with(['employee', 'planner', 'stops'])
            ->where('employee_id', $employeeId)
            ->orderBy('weekday')
            ->orderBy('route_name')
            ->get();
    }

    public function buildWeekOverview(Carbon $weekStart): array
    {
        return $this->buildWeekOverviewFromTemplates($weekStart, $this->listTemplates());
    }

    public function buildWeekOverviewForEmployee(Carbon $weekStart, int $employeeId): array
    {
        return $this->buildWeekOverviewFromTemplates($weekStart, $this->listTemplatesForEmployee($employeeId));
    }

    private function buildWeekOverviewFromTemplates(Carbon $weekStart, Collection $templates): array
    {
        $weekEnd = $weekStart->copy()->addDays(6);

        $overrides = WeeklyRouteOverride::query()
            ->with(['employee', 'planner', 'stops', 'template'])
            ->whereIn('weekly_route_template_id', $templates->pluck('id')->all())
            ->whereBetween('route_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->get()
            ->keyBy(fn (WeeklyRouteOverride $override) => $override->route_date->toDateString() . ':' . $override->weekly_route_template_id);

        $days = [];

        foreach (range(0, 6) as $offset) {
            $date = $weekStart->copy()->addDays($offset);
            $weekday = $date->dayOfWeekIso;

            $routes = $templates
                ->where('weekday', $weekday)
                ->map(function (WeeklyRouteTemplate $template) use ($date, $overrides) {
                    $override = $overrides->get($date->toDateString() . ':' . $template->id);

                    return $override ?? $this->makeEffectiveTemplateView($template, $date);
                })
                ->sortBy(fn ($route) => [strtolower((string) ($route->employee?->name ?? '')), strtolower((string) ($route->route_name ?? ''))])
                ->values();

            $days[] = [
                'date' => $date->toDateString(),
                'label' => $this->dayLabel($date),
                'weekday' => $weekday,
                'weekday_label' => $this->weekdayLabel($weekday),
                'routes' => $routes,
            ];
        }

        return [
            'start_date' => $weekStart->toDateString(),
            'end_date' => $weekEnd->toDateString(),
            'label' => sprintf('%s - %s', $weekStart->format('d.m.Y'), $weekEnd->format('d.m.Y')),
            'days' => $days,
        ];
    }

    public function ensureResponsibleEmployeeAssignments(array $patientIds, int $employeeId, bool $autoAssign): array
    {
        $patientIds = collect($patientIds)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $employee = User::query()->findOrFail($employeeId);

        if ($patientIds->isEmpty()) {
            return [
                'resolved' => true,
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'email' => $employee->email,
                ],
                'patients' => [],
            ];
        }

        $patients = Patient::query()
            ->with('responsibleUsers:id')
            ->whereIn('id', $patientIds->all())
            ->get();

        $missingPatients = $patients
            ->filter(fn (Patient $patient) => !$patient->responsibleUsers->contains('id', $employee->id))
            ->values();

        if ($missingPatients->isEmpty()) {
            return [
                'resolved' => true,
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'email' => $employee->email,
                ],
                'patients' => [],
            ];
        }

        if (!$autoAssign) {
            return [
                'resolved' => false,
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'email' => $employee->email,
                ],
                'patients' => $missingPatients->map(fn (Patient $patient) => [
                    'id' => $patient->id,
                    'patient_number' => $patient->patient_number,
                    'full_name' => $patient->full_name,
                ])->all(),
            ];
        }

        foreach ($missingPatients as $patient) {
            $patient->responsibleUsers()->syncWithoutDetaching([$employee->id]);
        }

        return [
            'resolved' => true,
            'employee' => [
                'id' => $employee->id,
                'name' => $employee->name,
                'email' => $employee->email,
            ],
            'patients' => $missingPatients->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'patient_number' => $patient->patient_number,
                'full_name' => $patient->full_name,
            ])->all(),
        ];
    }

    public function createTemplate(array $payload, User $planner): WeeklyRouteTemplate
    {
        return $this->saveTemplate(null, $payload, $planner);
    }

    public function updateTemplate(WeeklyRouteTemplate $template, array $payload, User $planner): WeeklyRouteTemplate
    {
        return $this->saveTemplate($template, $payload, $planner);
    }

    public function saveOverride(WeeklyRouteTemplate $template, Carbon $routeDate, array $payload, User $planner): WeeklyRouteOverride
    {
        $override = WeeklyRouteOverride::query()
            ->where('weekly_route_template_id', $template->id)
            ->whereDate('route_date', $routeDate->toDateString())
            ->first();

        $snapshot = $this->buildRouteSnapshot($payload, $routeDate, $planner, $payload['route_name'] ?? $template->route_name);

        return DB::transaction(function () use ($override, $template, $routeDate, $snapshot, $planner) {
            $override ??= new WeeklyRouteOverride();

            $override->fill([
                'weekly_route_template_id' => $template->id,
                'route_date' => $routeDate->toDateString(),
                'route_name' => $snapshot['route_name'],
                'employee_id' => $snapshot['employee']->id,
                'planner_id' => $planner->id,
                'shift_start_time' => $snapshot['shift_start_time'],
                'start_address' => $snapshot['start_address'],
                'end_address' => $snapshot['end_address'],
                'total_travel_minutes' => $snapshot['total_travel_minutes'],
                'total_service_minutes' => $snapshot['total_service_minutes'],
                'total_distance_meters' => $snapshot['total_distance_meters'],
                'route_geometry' => $snapshot['route_geometry'],
                'summary' => $snapshot['summary'],
            ]);

            $override->save();
            $override->stops()->delete();

            foreach ($snapshot['stops'] as $stop) {
                $override->stops()->create($stop);
            }

            return $override->load(['employee', 'planner', 'stops', 'template']);
        });
    }

    public function deleteOverride(WeeklyRouteTemplate $template, Carbon $routeDate): bool
    {
        $override = WeeklyRouteOverride::query()
            ->where('weekly_route_template_id', $template->id)
            ->whereDate('route_date', $routeDate->toDateString())
            ->first();

        if (!$override) {
            return false;
        }

        $override->delete();

        return true;
    }

    private function saveTemplate(?WeeklyRouteTemplate $template, array $payload, User $planner): WeeklyRouteTemplate
    {
        $weekday = (int) $payload['weekday'];
        $planningDate = Carbon::now()->startOfWeek(Carbon::MONDAY)->addDays($weekday - 1);
        $snapshot = $this->buildRouteSnapshot($payload, $planningDate, $planner, $payload['route_name'] ?? null, $weekday);

        return DB::transaction(function () use ($template, $snapshot, $planner, $weekday) {
            $template ??= new WeeklyRouteTemplate();

            $template->fill([
                'weekday' => $weekday,
                'route_name' => $snapshot['route_name'],
                'employee_id' => $snapshot['employee']->id,
                'planner_id' => $planner->id,
                'shift_start_time' => $snapshot['shift_start_time'],
                'start_address' => $snapshot['start_address'],
                'end_address' => $snapshot['end_address'],
                'total_travel_minutes' => $snapshot['total_travel_minutes'],
                'total_service_minutes' => $snapshot['total_service_minutes'],
                'total_distance_meters' => $snapshot['total_distance_meters'],
                'route_geometry' => $snapshot['route_geometry'],
                'summary' => $snapshot['summary'],
            ]);

            $template->save();
            $template->stops()->delete();

            foreach ($snapshot['stops'] as $stop) {
                $template->stops()->create($stop);
            }

            return $template->load(['employee', 'planner', 'stops']);
        });
    }

    private function buildRouteSnapshot(array $payload, Carbon $routeDate, User $planner, ?string $routeName = null, ?int $weekday = null): array
    {
        $employee = User::query()->findOrFail($payload['employee_id']);
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

        return [
            'employee' => $employee,
            'route_name' => trim((string) $routeName) ?: $this->defaultRouteName($employee->name, $weekday ?? $routeDate->dayOfWeekIso),
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
            'stops' => collect($planned['stops'])->map(fn (array $stop) => [
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
            ])->all(),
        ];
    }

    private function makeEffectiveTemplateView(WeeklyRouteTemplate $template, Carbon $date): WeeklyRouteTemplate
    {
        $template->setAttribute('route_date', $date->toDateString());
        $template->setAttribute('override_id', null);
        $template->setAttribute('template_id', $template->id);
        $template->setAttribute('is_override', false);

        return $template;
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
            'warnings' => array_values(array_unique($warnings)),
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

    private function defaultRouteName(string $employeeName, int $weekday): string
    {
        return sprintf('%s · %s', $this->weekdayLabel($weekday), $employeeName);
    }

    private function weekdayLabel(int $weekday): string
    {
        return [
            1 => 'Montag',
            2 => 'Dienstag',
            3 => 'Mittwoch',
            4 => 'Donnerstag',
            5 => 'Freitag',
            6 => 'Samstag',
            7 => 'Sonntag',
        ][$weekday] ?? 'Unbekannt';
    }

    private function dayLabel(Carbon $date): string
    {
        return sprintf('%s · %s', $this->weekdayLabel($date->dayOfWeekIso), $date->format('d.m.'));
    }
}
