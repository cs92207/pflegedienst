<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PatientController extends Controller
{
    /**
     * Alle Patienten auflisten (nur Stammdaten, keine Gesundheitsdaten).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Patient::query()
            ->with('responsibleUsers:id,name,email')
            ->orderBy('last_name')
            ->orderBy('first_name');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('patient_number', 'like', "%{$search}%");
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $patients = $query->get()->map(fn (Patient $p) => $this->serializeListItem($p));

        return response()->json([
            'success' => 1,
            'patients' => $patients,
        ]);
    }

    /**
     * Einzelnen Patienten mit allen entschlüsselten Daten laden.
     */
    public function show(Patient $patient): JsonResponse
    {
        $patient->loadMissing('responsibleUsers:id,name,email');

        return response()->json([
            'success' => 1,
            'patient' => $this->serializeFull($patient),
        ]);
    }

    /**
     * Neuen Patienten anlegen.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePatient($request);

        $patient = Patient::create($this->extractPatientAttributes($validated));
        $patient->responsibleUsers()->sync($validated['responsible_employee_ids'] ?? []);
        $patient->load('responsibleUsers:id,name,email');

        return response()->json([
            'success' => 1,
            'message' => 'Patient wurde angelegt.',
            'patient' => $this->serializeFull($patient),
        ], 201);
    }

    /**
     * Patienten aktualisieren.
     */
    public function update(Request $request, Patient $patient): JsonResponse
    {
        $validated = $this->validatePatient($request, $patient);

        $patient->fill($this->extractPatientAttributes($validated));
        $patient->save();
        $patient->responsibleUsers()->sync($validated['responsible_employee_ids'] ?? []);
        $patient->load('responsibleUsers:id,name,email');

        return response()->json([
            'success' => 1,
            'message' => 'Patient wurde aktualisiert.',
            'patient' => $this->serializeFull($patient),
        ]);
    }

    /**
     * Patienten löschen.
     */
    public function destroy(Patient $patient): JsonResponse
    {
        $patient->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Patient wurde gelöscht.',
        ]);
    }

    // ── Validierung ─────────────────────────────────────

    private function validatePatient(Request $request, ?Patient $existing = null): array
    {
        return $request->validate([
            // Stammdaten
            'first_name'      => ['required', 'string', 'max:255'],
            'last_name'       => ['required', 'string', 'max:255'],
            'date_of_birth'   => ['required', 'date', 'before:today'],
            'gender'          => ['required', Rule::in(['male', 'female', 'diverse'])],
            'status'          => ['sometimes', Rule::in(['active', 'inactive', 'deceased', 'discharged'])],

            // Kontakt
            'email'        => ['nullable', 'email', 'max:255'],
            'phone'        => ['nullable', 'string', 'max:50'],
            'mobile_phone' => ['nullable', 'string', 'max:50'],

            // Adresse
            'street'       => ['nullable', 'string', 'max:255'],
            'house_number' => ['nullable', 'string', 'max:20'],
            'zip_code'     => ['nullable', 'string', 'max:10'],
            'city'         => ['nullable', 'string', 'max:255'],

            // Versicherung
            'insurance_type'     => ['nullable', Rule::in(['gesetzlich', 'privat'])],
            'insurance_provider' => ['nullable', 'string', 'max:255'],
            'insurance_number'   => ['nullable', 'string', 'max:100'],

            // Pflegedaten
            'care_level'              => ['nullable', Rule::in(['0', '1', '2', '3', '4', '5'])],
            'care_level_since'        => ['nullable', 'date'],
            'diagnoses'               => ['nullable', 'array'],
            'diagnoses.*'             => ['string', 'max:500'],
            'allergies'               => ['nullable', 'array'],
            'allergies.*'             => ['string', 'max:500'],
            'medications'             => ['nullable', 'array'],
            'medications.*.name'      => ['required_with:medications', 'string', 'max:255'],
            'medications.*.dosage'    => ['nullable', 'string', 'max:255'],
            'medications.*.frequency' => ['nullable', 'string', 'max:255'],
            'medications.*.notes'     => ['nullable', 'string', 'max:1000'],
            'care_notes'              => ['nullable', 'string', 'max:10000'],
            'living_situation'        => ['nullable', 'string', 'max:255'],
            'mobility'                => ['nullable', 'string', 'max:255'],
            'nutrition'               => ['nullable', 'string', 'max:255'],
            'communication_ability'   => ['nullable', 'string', 'max:255'],

            // Ärzte
            'treating_doctors'             => ['nullable', 'array'],
            'treating_doctors.*.name'      => ['required_with:treating_doctors', 'string', 'max:255'],
            'treating_doctors.*.specialty' => ['nullable', 'string', 'max:255'],
            'treating_doctors.*.phone'     => ['nullable', 'string', 'max:50'],

            // Notfallkontakte
            'emergency_contacts'                => ['nullable', 'array'],
            'emergency_contacts.*.name'         => ['required_with:emergency_contacts', 'string', 'max:255'],
            'emergency_contacts.*.relationship' => ['nullable', 'string', 'max:255'],
            'emergency_contacts.*.phone'        => ['nullable', 'string', 'max:50'],

            // Rechtliches
            'legal_guardian'            => ['nullable', 'array'],
            'legal_guardian.name'       => ['nullable', 'string', 'max:255'],
            'legal_guardian.phone'      => ['nullable', 'string', 'max:50'],
            'legal_guardian.relationship' => ['nullable', 'string', 'max:255'],
            'has_advance_directive'     => ['sometimes', 'boolean'],
            'advance_directive_notes'   => ['nullable', 'string', 'max:2000'],
            'has_power_of_attorney'     => ['sometimes', 'boolean'],
            'power_of_attorney_notes'   => ['nullable', 'string', 'max:2000'],
            'has_dnr_order'             => ['sometimes', 'boolean'],

            // Zuständige Pfleger
            'responsible_employee_ids'   => ['sometimes', 'array'],
            'responsible_employee_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);
    }

    private function extractPatientAttributes(array $validated): array
    {
        unset($validated['responsible_employee_ids']);

        return $validated;
    }

    // ── Serialisierung ──────────────────────────────────

    /**
     * Listenansicht – nur Stammdaten, kein Gesundheitsdetail.
     */
    private function serializeListItem(Patient $p): array
    {
        return [
            'id'             => $p->id,
            'patient_number' => $p->patient_number,
            'first_name'     => $p->first_name,
            'last_name'      => $p->last_name,
            'date_of_birth'  => $p->date_of_birth?->toDateString(),
            'gender'         => $p->gender,
            'status'         => $p->status,
            'care_level'     => $p->care_level,
            'street'         => $p->street,
            'house_number'   => $p->house_number,
            'zip_code'       => $p->zip_code,
            'city'           => $p->city,
            'phone'          => $p->phone,
            'responsible_users' => $p->responsibleUsers->map(fn ($user) => $this->serializeResponsibleUser($user))->values(),
            'created_at'     => $p->created_at?->toISOString(),
        ];
    }

    /**
     * Detailansicht – alle entschlüsselten Felder.
     */
    private function serializeFull(Patient $p): array
    {
        return [
            'id'             => $p->id,
            'patient_number' => $p->patient_number,
            'status'         => $p->status,

            // Stammdaten
            'first_name'    => $p->first_name,
            'last_name'     => $p->last_name,
            'date_of_birth' => $p->date_of_birth?->toDateString(),
            'gender'        => $p->gender,

            // Kontakt
            'email'        => $p->email,
            'phone'        => $p->phone,
            'mobile_phone' => $p->mobile_phone,

            // Adresse
            'street'       => $p->street,
            'house_number' => $p->house_number,
            'zip_code'     => $p->zip_code,
            'city'         => $p->city,

            // Versicherung
            'insurance_type'     => $p->insurance_type,
            'insurance_provider' => $p->insurance_provider,
            'insurance_number'   => $p->insurance_number,

            // Pflegedaten
            'care_level'            => $p->care_level,
            'care_level_since'      => $p->care_level_since?->toDateString(),
            'diagnoses'             => $p->diagnoses ?? [],
            'allergies'             => $p->allergies ?? [],
            'medications'           => $p->medications ?? [],
            'care_notes'            => $p->care_notes,
            'living_situation'      => $p->living_situation,
            'mobility'              => $p->mobility,
            'nutrition'             => $p->nutrition,
            'communication_ability' => $p->communication_ability,

            // Ärzte & Kontakte
            'treating_doctors'   => $p->treating_doctors ?? [],
            'emergency_contacts' => $p->emergency_contacts ?? [],

            // Rechtliches
            'legal_guardian'          => $p->legal_guardian,
            'has_advance_directive'   => $p->has_advance_directive,
            'advance_directive_notes' => $p->advance_directive_notes,
            'has_power_of_attorney'   => $p->has_power_of_attorney,
            'power_of_attorney_notes' => $p->power_of_attorney_notes,
            'has_dnr_order'           => $p->has_dnr_order,
            'responsible_users'       => $p->responsibleUsers->map(fn ($user) => $this->serializeResponsibleUser($user))->values(),

            'created_at' => $p->created_at?->toISOString(),
            'updated_at' => $p->updated_at?->toISOString(),
        ];
    }

    private function serializeResponsibleUser($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
