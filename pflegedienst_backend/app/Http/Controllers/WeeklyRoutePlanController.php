<?php

namespace App\Http\Controllers;

use App\Models\WeeklyRouteOverride;
use App\Models\WeeklyRouteTemplate;
use App\Services\WeeklyRoutePlanService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class WeeklyRoutePlanController extends Controller
{
    public function __construct(private WeeklyRoutePlanService $planService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->ensureTablesExist()) {
            return $response;
        }

        $validated = $request->validate([
            'week_start' => ['nullable', 'date'],
        ]);

        $weekStart = isset($validated['week_start'])
            ? Carbon::parse($validated['week_start'])->startOfWeek(Carbon::MONDAY)
            : Carbon::now()->startOfWeek(Carbon::MONDAY);

        $templates = $this->planService->listTemplates();

        return response()->json([
            'success' => 1,
            'templates' => $templates->map(fn (WeeklyRouteTemplate $template) => $this->serializeTemplate($template))->values(),
            'week' => $this->serializeWeek($this->planService->buildWeekOverview($weekStart)),
        ]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        if ($response = $this->ensureTablesExist()) {
            return $response;
        }

        $validated = $this->validateTemplatePayload($request);

        $assignmentCheck = $this->planService->ensureResponsibleEmployeeAssignments(
            collect($validated['stops'] ?? [])->pluck('patient_id')->all(),
            (int) $validated['employee_id'],
            (bool) ($validated['auto_assign_responsible_employee'] ?? false)
        );

        if (!$assignmentCheck['resolved']) {
            return response()->json([
                'success' => 0,
                'code' => 'missing_responsible_employee_assignment',
                'message' => 'Der ausgewählte Pfleger ist noch nicht bei allen Pflegekunden dieser Route als zuständig hinterlegt.',
                'employee' => $assignmentCheck['employee'],
                'patients' => $assignmentCheck['patients'],
            ], 409);
        }

        try {
            $template = $this->planService->createTemplate($validated, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['success' => 0, 'message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Wochenroute wurde gespeichert.',
            'template' => $this->serializeTemplate($template),
        ], 201);
    }

    public function updateTemplate(Request $request, WeeklyRouteTemplate $weeklyRouteTemplate): JsonResponse
    {
        if ($response = $this->ensureTablesExist()) {
            return $response;
        }

        $validated = $this->validateTemplatePayload($request);

        $assignmentCheck = $this->planService->ensureResponsibleEmployeeAssignments(
            collect($validated['stops'] ?? [])->pluck('patient_id')->all(),
            (int) $validated['employee_id'],
            (bool) ($validated['auto_assign_responsible_employee'] ?? false)
        );

        if (!$assignmentCheck['resolved']) {
            return response()->json([
                'success' => 0,
                'code' => 'missing_responsible_employee_assignment',
                'message' => 'Der ausgewählte Pfleger ist noch nicht bei allen Pflegekunden dieser Route als zuständig hinterlegt.',
                'employee' => $assignmentCheck['employee'],
                'patients' => $assignmentCheck['patients'],
            ], 409);
        }

        try {
            $template = $this->planService->updateTemplate($weeklyRouteTemplate, $validated, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['success' => 0, 'message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Wochenroute wurde aktualisiert.',
            'template' => $this->serializeTemplate($template),
        ]);
    }

    public function destroyTemplate(WeeklyRouteTemplate $weeklyRouteTemplate): JsonResponse
    {
        $weeklyRouteTemplate->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Wochenroute wurde gelöscht.',
        ]);
    }

    public function saveOverride(Request $request, WeeklyRouteTemplate $weeklyRouteTemplate, string $date): JsonResponse
    {
        if ($response = $this->ensureTablesExist()) {
            return $response;
        }

        $validated = $this->validateOverridePayload($request);
        $routeDate = $this->parseRouteDate($date);

        $assignmentCheck = $this->planService->ensureResponsibleEmployeeAssignments(
            collect($validated['stops'] ?? [])->pluck('patient_id')->all(),
            (int) $validated['employee_id'],
            (bool) ($validated['auto_assign_responsible_employee'] ?? false)
        );

        if (!$assignmentCheck['resolved']) {
            return response()->json([
                'success' => 0,
                'code' => 'missing_responsible_employee_assignment',
                'message' => 'Der ausgewählte Pfleger ist noch nicht bei allen Pflegekunden dieser Route als zuständig hinterlegt.',
                'employee' => $assignmentCheck['employee'],
                'patients' => $assignmentCheck['patients'],
            ], 409);
        }

        try {
            $override = $this->planService->saveOverride($weeklyRouteTemplate, $routeDate, $validated, $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['success' => 0, 'message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Einmalige Wochenänderung wurde gespeichert.',
            'override' => $this->serializeOverride($override),
        ]);
    }

    public function destroyOverride(WeeklyRouteTemplate $weeklyRouteTemplate, string $date): JsonResponse
    {
        $routeDate = $this->parseRouteDate($date);
        $deleted = $this->planService->deleteOverride($weeklyRouteTemplate, $routeDate);

        if (!$deleted) {
            return response()->json([
                'success' => 0,
                'message' => 'Für dieses Datum existiert keine einmalige Änderung.',
            ], 404);
        }

        return response()->json([
            'success' => 1,
            'message' => 'Die einmalige Änderung wurde entfernt. Ab jetzt gilt wieder der globale Wochenplan.',
        ]);
    }

    private function serializeWeek(array $week): array
    {
        return [
            'start_date' => $week['start_date'],
            'end_date' => $week['end_date'],
            'label' => $week['label'],
            'days' => collect($week['days'])->map(function (array $day) {
                return [
                    'date' => $day['date'],
                    'label' => $day['label'],
                    'weekday' => $day['weekday'],
                    'weekday_label' => $day['weekday_label'],
                    'routes' => collect($day['routes'])->map(function ($route) use ($day) {
                        if ($route instanceof WeeklyRouteOverride) {
                            return $this->serializeOverride($route);
                        }

                        return $this->serializeTemplate($route, $day['date']);
                    })->values(),
                ];
            })->values(),
        ];
    }

    private function serializeTemplate(WeeklyRouteTemplate $template, ?string $routeDate = null): array
    {
        return $this->serializeRouteRecord(
            $template,
            $template->stops,
            [
                'template_id' => $template->id,
                'override_id' => null,
                'scope' => 'template',
                'weekday' => $template->weekday,
                'weekday_label' => $this->weekdayLabel($template->weekday),
                'route_date' => $routeDate,
                'has_override' => false,
            ]
        );
    }

    private function serializeOverride(WeeklyRouteOverride $override): array
    {
        return $this->serializeRouteRecord(
            $override,
            $override->stops,
            [
                'template_id' => $override->weekly_route_template_id,
                'override_id' => $override->id,
                'scope' => 'override',
                'weekday' => $override->route_date?->dayOfWeekIso,
                'weekday_label' => $override->route_date ? $this->weekdayLabel($override->route_date->dayOfWeekIso) : null,
                'route_date' => $override->route_date?->toDateString(),
                'has_override' => true,
            ]
        );
    }

    private function serializeRouteRecord($record, $stops, array $meta): array
    {
        return [
            'id' => $record->id,
            'template_id' => $meta['template_id'],
            'override_id' => $meta['override_id'],
            'scope' => $meta['scope'],
            'route_name' => $record->route_name,
            'route_date' => $meta['route_date'],
            'weekday' => $meta['weekday'],
            'weekday_label' => $meta['weekday_label'],
            'shift_start_time' => $record->shift_start_time,
            'start_address' => $record->start_address,
            'end_address' => $record->end_address,
            'total_travel_minutes' => $record->total_travel_minutes,
            'total_service_minutes' => $record->total_service_minutes,
            'total_distance_meters' => $record->total_distance_meters,
            'route_geometry' => $record->route_geometry ?? [],
            'summary' => $record->summary ?? [],
            'employee' => $record->employee ? [
                'id' => $record->employee->id,
                'name' => $record->employee->name,
                'email' => $record->employee->email,
            ] : null,
            'planner' => $record->planner ? [
                'id' => $record->planner->id,
                'name' => $record->planner->name,
                'email' => $record->planner->email,
            ] : null,
            'stops' => $stops->map(fn ($stop) => [
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
            'created_at' => $record->created_at?->toISOString(),
            'updated_at' => $record->updated_at?->toISOString(),
            'has_override' => $meta['has_override'],
        ];
    }

    private function ensureTablesExist(): ?JsonResponse
    {
        if (
            Schema::hasTable('weekly_route_templates')
            && Schema::hasTable('weekly_route_template_stops')
            && Schema::hasTable('weekly_route_overrides')
            && Schema::hasTable('weekly_route_override_stops')
            && Schema::hasTable('patient_responsible_users')
        ) {
            return null;
        }

        return response()->json([
            'success' => 0,
            'message' => 'Die Dienstplan-Funktion ist noch nicht aktiv, weil die neuen Datenbanktabellen fehlen. Bitte im Backend zuerst die Migrationen ausführen.',
        ], 503);
    }

    private function validateTemplatePayload(Request $request): array
    {
        return $request->validate([
            'weekday' => ['required', 'integer', 'min:1', 'max:7'],
            'route_name' => ['nullable', 'string', 'max:255'],
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'shift_start_time' => ['nullable', 'date_format:H:i'],
            'start_address' => ['nullable', 'string', 'max:255'],
            'end_address' => ['nullable', 'string', 'max:255'],
            'auto_assign_responsible_employee' => ['sometimes', 'boolean'],
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.patient_id' => ['required', 'integer', 'distinct', 'exists:patients,id'],
            'stops.*.service_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'stops.*.fixed_time' => ['nullable', 'date_format:H:i'],
            'stops.*.notes' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function validateOverridePayload(Request $request): array
    {
        return $request->validate([
            'route_name' => ['nullable', 'string', 'max:255'],
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'shift_start_time' => ['nullable', 'date_format:H:i'],
            'start_address' => ['nullable', 'string', 'max:255'],
            'end_address' => ['nullable', 'string', 'max:255'],
            'auto_assign_responsible_employee' => ['sometimes', 'boolean'],
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.patient_id' => ['required', 'integer', 'distinct', 'exists:patients,id'],
            'stops.*.service_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'stops.*.fixed_time' => ['nullable', 'date_format:H:i'],
            'stops.*.notes' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function parseRouteDate(string $date): Carbon
    {
        try {
            return Carbon::createFromFormat('Y-m-d', $date)->startOfDay();
        } catch (\Throwable $exception) {
            abort(response()->json([
                'success' => 0,
                'message' => 'Das Datum für die Wochenänderung ist ungültig.',
            ], 422));
        }
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
}
