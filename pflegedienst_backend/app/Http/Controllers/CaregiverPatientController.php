<?php

namespace App\Http\Controllers;

use App\Models\PatientDefaultTodo;
use App\Models\Patient;
use App\Models\PatientVisit;
use App\Models\PatientVisitTodo;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CaregiverPatientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->ensureTablesExist()) {
            return $response;
        }

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:40'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Patient::query()
            ->with('responsibleUsers:id,name,email')
            ->whereHas('responsibleUsers', fn ($builder) => $builder->where('users.id', $request->user()->id))
            ->orderByDesc('created_at');

        if ($search = $validated['search'] ?? null) {
            $query->where(function ($builder) use ($search) {
                $builder->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('patient_number', 'like', "%{$search}%");
            });
        }

        if ($status = $validated['status'] ?? null) {
            $query->where('status', $status);
        }

        if ($limit = $validated['limit'] ?? null) {
            $query->limit((int) $limit);
        }

        return response()->json([
            'success' => 1,
            'patients' => $query->get()->map(fn (Patient $patient) => $this->serializeListItem($patient))->values(),
        ]);
    }

    public function show(Request $request, Patient $patient): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $patient->load([
            'responsibleUsers:id,name,email',
            'defaultTodos.createdByUser:id,name,email',
            'visits.createdByUser:id,name,email',
            'visits.releasedToAdminByUser:id,name,email',
            'visits.todos.createdByUser:id,name,email',
            'visits.todos.defaultTodo:id,patient_id',
        ]);

        return response()->json([
            'success' => 1,
            'patient' => $this->serializeFullPatient($patient),
        ]);
    }

    public function storeDefaultTodo(Request $request, Patient $patient): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $todo = $patient->defaultTodos()->create([
            'title' => $validated['title'],
            'notes' => $validated['notes'] ?? null,
            'sort_order' => ((int) $patient->defaultTodos()->max('sort_order')) + 1,
            'source' => 'caregiver',
            'created_by_user_id' => $request->user()->id,
        ]);
        $todo->load('createdByUser:id,name,email');

        return response()->json([
            'success' => 1,
            'message' => 'Standard-Todo wurde hinzugefügt.',
            'default_todo' => $this->serializeDefaultTodo($todo),
        ], 201);
    }

    public function updateDefaultTodo(Request $request, Patient $patient, PatientDefaultTodo $defaultTodo): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $defaultTodo = $this->resolvePatientDefaultTodo($patient, $defaultTodo);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $defaultTodo->fill([
            'title' => $validated['title'],
            'notes' => $validated['notes'] ?? null,
        ]);
        $defaultTodo->save();
        $defaultTodo->load('createdByUser:id,name,email');

        return response()->json([
            'success' => 1,
            'message' => 'Standard-Todo wurde aktualisiert.',
            'default_todo' => $this->serializeDefaultTodo($defaultTodo),
        ]);
    }

    public function destroyDefaultTodo(Request $request, Patient $patient, PatientDefaultTodo $defaultTodo): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $defaultTodo = $this->resolvePatientDefaultTodo($patient, $defaultTodo);
        $defaultTodo->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Standard-Todo wurde gelöscht.',
        ]);
    }

    public function storeVisit(Request $request, Patient $patient): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);

        $validated = $request->validate([
            'visit_date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'after:start_time'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $visit = DB::transaction(function () use ($patient, $validated, $request) {
            $visit = $patient->visits()->create([
                'created_by_user_id' => $request->user()->id,
                'visit_date' => $validated['visit_date'],
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            $defaults = $patient->defaultTodos()->orderBy('sort_order')->orderBy('id')->get();
            foreach ($defaults as $index => $defaultTodo) {
                $visit->todos()->create([
                    'patient_default_todo_id' => $defaultTodo->id,
                    'created_by_user_id' => $request->user()->id,
                    'title' => $defaultTodo->title,
                    'notes' => $defaultTodo->notes,
                    'sort_order' => $defaultTodo->sort_order ?? $index,
                    'source' => 'default',
                ]);
            }

            $visit->load(['createdByUser:id,name,email', 'todos.createdByUser:id,name,email', 'todos.defaultTodo:id,patient_id']);

            return $visit;
        });

        return response()->json([
            'success' => 1,
            'message' => 'Besuch wurde angelegt.',
            'visit' => $this->serializeVisit($visit),
        ], 201);
    }

    public function updateVisit(Request $request, Patient $patient, PatientVisit $visit): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);

        $validated = $request->validate([
            'visit_date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'after:start_time'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $visit->fill([
            'visit_date' => $validated['visit_date'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);
        $visit->save();
        $visit->load(['createdByUser:id,name,email', 'releasedToAdminByUser:id,name,email', 'todos.createdByUser:id,name,email', 'todos.defaultTodo:id,patient_id']);

        return response()->json([
            'success' => 1,
            'message' => 'Besuch wurde aktualisiert.',
            'visit' => $this->serializeVisit($visit),
        ]);
    }

    public function updateVisitRelease(Request $request, Patient $patient, PatientVisit $visit): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);

        $validated = $request->validate([
            'is_released_to_admin' => ['required', 'boolean'],
        ]);

        $isReleased = (bool) $validated['is_released_to_admin'];
        $visit->fill([
            'released_to_admin_at' => $isReleased ? ($visit->released_to_admin_at ?? Carbon::now()) : null,
            'released_to_admin_by_user_id' => $isReleased ? $request->user()->id : null,
        ]);
        $visit->save();
        $visit->load(['createdByUser:id,name,email', 'releasedToAdminByUser:id,name,email', 'todos.createdByUser:id,name,email', 'todos.defaultTodo:id,patient_id']);

        return response()->json([
            'success' => 1,
            'message' => $isReleased ? 'Besuch wurde für das Admin-Dashboard freigegeben.' : 'Freigabe für das Admin-Dashboard wurde zurückgezogen.',
            'visit' => $this->serializeVisit($visit),
        ]);
    }

    public function destroyVisit(Request $request, Patient $patient, PatientVisit $visit): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);
        $visit->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Besuch wurde gelöscht.',
        ]);
    }

    public function storeVisitTodo(Request $request, Patient $patient, PatientVisit $visit): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_completed' => ['nullable', 'boolean'],
        ]);

        $isCompleted = (bool) ($validated['is_completed'] ?? false);
        $todo = $visit->todos()->create([
            'created_by_user_id' => $request->user()->id,
            'title' => $validated['title'],
            'notes' => $validated['notes'] ?? null,
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? Carbon::now() : null,
            'sort_order' => ((int) $visit->todos()->max('sort_order')) + 1,
            'source' => 'manual',
        ]);
        $todo->load(['createdByUser:id,name,email', 'defaultTodo:id,patient_id']);

        return response()->json([
            'success' => 1,
            'message' => 'Besuchs-Todo wurde hinzugefügt.',
            'todo' => $this->serializeVisitTodo($todo),
        ], 201);
    }

    public function updateVisitTodo(Request $request, Patient $patient, PatientVisit $visit, PatientVisitTodo $todo): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);
        $todo = $this->resolveVisitTodo($visit, $todo);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_completed' => ['required', 'boolean'],
        ]);

        $isCompleted = (bool) $validated['is_completed'];
        $todo->fill([
            'title' => $validated['title'],
            'notes' => $validated['notes'] ?? null,
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? ($todo->completed_at ?? Carbon::now()) : null,
        ]);
        $todo->save();
        $todo->load(['createdByUser:id,name,email', 'defaultTodo:id,patient_id']);

        return response()->json([
            'success' => 1,
            'message' => 'Besuchs-Todo wurde aktualisiert.',
            'todo' => $this->serializeVisitTodo($todo),
        ]);
    }

    public function destroyVisitTodo(Request $request, Patient $patient, PatientVisit $visit, PatientVisitTodo $todo): JsonResponse
    {
        $patient = $this->resolveAccessiblePatient($request, $patient);
        $visit = $this->resolvePatientVisit($patient, $visit);
        $todo = $this->resolveVisitTodo($visit, $todo);
        $todo->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Besuchs-Todo wurde gelöscht.',
        ]);
    }

    private function ensureTablesExist(): ?JsonResponse
    {
        if (
            Schema::hasTable('patients')
            && Schema::hasTable('patient_responsible_users')
            && Schema::hasTable('patient_default_todos')
            && Schema::hasTable('patient_visits')
            && Schema::hasTable('patient_visit_todos')
        ) {
            return null;
        }

        return response()->json([
            'success' => 0,
            'message' => 'Die Pflegekunden-Funktion ist noch nicht aktiv, weil Tabellen oder Migrationen fehlen.',
        ], 503);
    }

    private function serializeListItem(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'patient_number' => $patient->patient_number,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'date_of_birth' => $patient->date_of_birth?->toDateString(),
            'gender' => $patient->gender,
            'status' => $patient->status,
            'care_level' => $patient->care_level,
            'street' => $patient->street,
            'house_number' => $patient->house_number,
            'zip_code' => $patient->zip_code,
            'city' => $patient->city,
            'phone' => $patient->phone,
            'responsible_users' => $patient->responsibleUsers->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])->values(),
            'created_at' => $patient->created_at?->toISOString(),
        ];
    }

    private function serializeFullPatient(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'patient_number' => $patient->patient_number,
            'status' => $patient->status,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'date_of_birth' => $patient->date_of_birth?->toDateString(),
            'gender' => $patient->gender,
            'email' => $patient->email,
            'phone' => $patient->phone,
            'mobile_phone' => $patient->mobile_phone,
            'street' => $patient->street,
            'house_number' => $patient->house_number,
            'zip_code' => $patient->zip_code,
            'city' => $patient->city,
            'insurance_type' => $patient->insurance_type,
            'insurance_provider' => $patient->insurance_provider,
            'insurance_number' => $patient->insurance_number,
            'care_level' => $patient->care_level,
            'care_level_since' => $patient->care_level_since?->toDateString(),
            'diagnoses' => $patient->diagnoses ?? [],
            'allergies' => $patient->allergies ?? [],
            'medications' => $patient->medications ?? [],
            'care_notes' => $patient->care_notes,
            'living_situation' => $patient->living_situation,
            'mobility' => $patient->mobility,
            'nutrition' => $patient->nutrition,
            'communication_ability' => $patient->communication_ability,
            'agreed_services' => $patient->agreed_services ?? [],
            'treating_doctors' => $patient->treating_doctors ?? [],
            'emergency_contacts' => $patient->emergency_contacts ?? [],
            'legal_guardian' => $patient->legal_guardian,
            'has_advance_directive' => $patient->has_advance_directive,
            'advance_directive_notes' => $patient->advance_directive_notes,
            'has_power_of_attorney' => $patient->has_power_of_attorney,
            'power_of_attorney_notes' => $patient->power_of_attorney_notes,
            'has_dnr_order' => $patient->has_dnr_order,
            'responsible_users' => $patient->responsibleUsers->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])->values(),
            'default_todos' => $patient->defaultTodos->map(fn (PatientDefaultTodo $todo) => $this->serializeDefaultTodo($todo))->values(),
            'visits' => $patient->visits->map(fn (PatientVisit $visit) => $this->serializeVisit($visit))->values(),
            'created_at' => $patient->created_at?->toISOString(),
            'updated_at' => $patient->updated_at?->toISOString(),
        ];
    }

    private function serializeDefaultTodo(PatientDefaultTodo $todo): array
    {
        return [
            'id' => $todo->id,
            'title' => $todo->title,
            'notes' => $todo->notes,
            'sort_order' => $todo->sort_order,
            'source' => $todo->source,
            'created_by_user' => $todo->createdByUser ? [
                'id' => $todo->createdByUser->id,
                'name' => $todo->createdByUser->name,
                'email' => $todo->createdByUser->email,
            ] : null,
            'created_at' => $todo->created_at?->toISOString(),
            'updated_at' => $todo->updated_at?->toISOString(),
        ];
    }

    private function serializeVisit(PatientVisit $visit): array
    {
        return [
            'id' => $visit->id,
            'visit_date' => $visit->visit_date?->toDateString(),
            'start_time' => $visit->start_time,
            'end_time' => $visit->end_time,
            'notes' => $visit->notes,
            'is_released_to_admin' => (bool) $visit->released_to_admin_at,
            'released_to_admin_at' => $visit->released_to_admin_at?->toISOString(),
            'released_to_admin_by_user' => $visit->releasedToAdminByUser ? [
                'id' => $visit->releasedToAdminByUser->id,
                'name' => $visit->releasedToAdminByUser->name,
                'email' => $visit->releasedToAdminByUser->email,
            ] : null,
            'created_by_user' => $visit->createdByUser ? [
                'id' => $visit->createdByUser->id,
                'name' => $visit->createdByUser->name,
                'email' => $visit->createdByUser->email,
            ] : null,
            'todos' => $visit->todos->map(fn (PatientVisitTodo $todo) => $this->serializeVisitTodo($todo))->values(),
            'created_at' => $visit->created_at?->toISOString(),
            'updated_at' => $visit->updated_at?->toISOString(),
        ];
    }

    private function serializeVisitTodo(PatientVisitTodo $todo): array
    {
        return [
            'id' => $todo->id,
            'patient_default_todo_id' => $todo->patient_default_todo_id,
            'title' => $todo->title,
            'notes' => $todo->notes,
            'is_completed' => $todo->is_completed,
            'completed_at' => $todo->completed_at?->toISOString(),
            'sort_order' => $todo->sort_order,
            'source' => $todo->source,
            'created_by_user' => $todo->createdByUser ? [
                'id' => $todo->createdByUser->id,
                'name' => $todo->createdByUser->name,
                'email' => $todo->createdByUser->email,
            ] : null,
            'created_at' => $todo->created_at?->toISOString(),
            'updated_at' => $todo->updated_at?->toISOString(),
        ];
    }

    private function resolveAccessiblePatient(Request $request, Patient $patient): Patient
    {
        $accessible = Patient::query()
            ->whereKey($patient->id)
            ->whereHas('responsibleUsers', fn ($builder) => $builder->where('users.id', $request->user()->id))
            ->first();

        if (!$accessible) {
            throw new NotFoundHttpException();
        }

        return $accessible;
    }

    private function resolvePatientDefaultTodo(Patient $patient, PatientDefaultTodo $defaultTodo): PatientDefaultTodo
    {
        if ((int) $defaultTodo->patient_id !== (int) $patient->id) {
            throw new NotFoundHttpException();
        }

        return $defaultTodo;
    }

    private function resolvePatientVisit(Patient $patient, PatientVisit $visit): PatientVisit
    {
        if ((int) $visit->patient_id !== (int) $patient->id) {
            throw new NotFoundHttpException();
        }

        return $visit;
    }

    private function resolveVisitTodo(PatientVisit $visit, PatientVisitTodo $todo): PatientVisitTodo
    {
        if ((int) $todo->patient_visit_id !== (int) $visit->id) {
            throw new NotFoundHttpException();
        }

        return $todo;
    }
}