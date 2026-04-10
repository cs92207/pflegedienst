<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Patient – Pflegekunden-Stamm- und Gesundheitsdaten.
 *
 * Alle personenbezogenen Gesundheitsdaten (DSGVO Art. 9) werden über Laravels
 * `encrypted` / `encrypted:*` Cast AES-256-CBC-verschlüsselt in der Datenbank
 * gespeichert. Der Schlüssel ist APP_KEY (config/app.php → key). Nur Name,
 * Geburtsdatum, Geschlecht, Status und interne Patientennummer liegen im
 * Klartext, damit Suche und Sortierung möglich bleiben.
 */
class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        // Verwaltung
        'patient_number',
        'status',

        // Stammdaten (Klartext)
        'first_name',
        'last_name',
        'date_of_birth',
        'gender',

        // Kontakt (verschlüsselt)
        'email',
        'phone',
        'mobile_phone',

        // Adresse (verschlüsselt)
        'street',
        'house_number',
        'zip_code',
        'city',

        // Versicherung (verschlüsselt)
        'insurance_type',
        'insurance_provider',
        'insurance_number',

        // Pflegedaten (verschlüsselt)
        'care_level',
        'care_level_since',
        'diagnoses',
        'allergies',
        'medications',
        'care_notes',
        'living_situation',
        'mobility',
        'nutrition',
        'communication_ability',

        // Ärzte & Kontaktpersonen (verschlüsselt)
        'treating_doctors',
        'emergency_contacts',

        // Rechtliches (verschlüsselt)
        'legal_guardian',
        'has_advance_directive',
        'advance_directive_notes',
        'has_power_of_attorney',
        'power_of_attorney_notes',
        'has_dnr_order',
    ];

    /**
     * Casts – `encrypted` nutzt AES-256-CBC mit APP_KEY.
     * `encrypted:array` entschlüsselt zusätzlich automatisch JSON ↔ Array.
     */
    protected $casts = [
        'date_of_birth'   => 'date',
        'care_level_since' => 'date',

        // Verschlüsselte Skalarfelder
        'email'                   => 'encrypted',
        'phone'                   => 'encrypted',
        'mobile_phone'            => 'encrypted',
        'street'                  => 'encrypted',
        'house_number'            => 'encrypted',
        'zip_code'                => 'encrypted',
        'city'                    => 'encrypted',
        'insurance_type'          => 'encrypted',
        'insurance_provider'      => 'encrypted',
        'insurance_number'        => 'encrypted',
        'care_level'              => 'encrypted',
        'care_notes'              => 'encrypted',
        'living_situation'        => 'encrypted',
        'mobility'                => 'encrypted',
        'nutrition'               => 'encrypted',
        'communication_ability'   => 'encrypted',
        'advance_directive_notes' => 'encrypted',
        'power_of_attorney_notes' => 'encrypted',

        // Verschlüsselte JSON-Felder
        'diagnoses'          => 'encrypted:array',
        'allergies'          => 'encrypted:array',
        'medications'        => 'encrypted:array',
        'treating_doctors'   => 'encrypted:array',
        'emergency_contacts' => 'encrypted:array',
        'legal_guardian'     => 'encrypted:array',

        // Booleans
        'has_advance_directive'  => 'boolean',
        'has_power_of_attorney'  => 'boolean',
        'has_dnr_order'          => 'boolean',
    ];

    protected $hidden = [];

    /**
     * Boot: Automatische Patientennummer beim Anlegen.
     */
    protected static function booted(): void
    {
        static::creating(function (Patient $patient) {
            if (empty($patient->patient_number)) {
                $patient->patient_number = self::generatePatientNumber();
            }
        });
    }

    /**
     * Erzeugt eine eindeutige Patientennummer: PF-JJJJ-XXXXX
     */
    public static function generatePatientNumber(): string
    {
        do {
            $number = 'PF-' . date('Y') . '-' . strtoupper(Str::random(5));
        } while (self::where('patient_number', $number)->exists());

        return $number;
    }

    /**
     * Vollständiger Name.
     */
    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function dailyRouteStops()
    {
        return $this->hasMany(DailyRouteStop::class);
    }

    public function weeklyRouteTemplateStops()
    {
        return $this->hasMany(WeeklyRouteTemplateStop::class);
    }

    public function weeklyRouteOverrideStops()
    {
        return $this->hasMany(WeeklyRouteOverrideStop::class);
    }

    public function responsibleUsers()
    {
        return $this->belongsToMany(User::class, 'patient_responsible_users')
            ->withTimestamps()
            ->orderBy('name');
    }
}
