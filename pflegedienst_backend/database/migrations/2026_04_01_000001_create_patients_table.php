<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();

            // ── Interne Verwaltung ─────────────────────────
            $table->string('patient_number')->unique();
            $table->enum('status', ['active', 'inactive', 'deceased', 'discharged'])->default('active');

            // ── Stammdaten (Klartext – für Suche/Sortierung) ─
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'diverse'])->default('diverse');

            // ── Kontaktdaten (verschlüsselt → text) ────────
            $table->text('email')->nullable();
            $table->text('phone')->nullable();
            $table->text('mobile_phone')->nullable();

            // ── Adresse (verschlüsselt → text) ─────────────
            $table->text('street')->nullable();
            $table->text('house_number')->nullable();
            $table->text('zip_code')->nullable();
            $table->text('city')->nullable();

            // ── Versicherung (verschlüsselt → text) ────────
            $table->text('insurance_type')->nullable();          // gesetzlich / privat
            $table->text('insurance_provider')->nullable();       // Krankenkasse
            $table->text('insurance_number')->nullable();         // Versichertennummer

            // ── Pflegedaten (verschlüsselt → text) ─────────
            $table->text('care_level')->nullable();               // Pflegegrad 0-5
            $table->date('care_level_since')->nullable();
            $table->text('diagnoses')->nullable();                // JSON array
            $table->text('allergies')->nullable();                // JSON array
            $table->text('medications')->nullable();              // JSON array of objects
            $table->text('care_notes')->nullable();               // Freitext Pflegenotizen
            $table->text('living_situation')->nullable();         // allein, mit Partner, …
            $table->text('mobility')->nullable();                 // mobil, eingeschränkt, …
            $table->text('nutrition')->nullable();                // normal, Sondenkost, …
            $table->text('communication_ability')->nullable();    // normal, eingeschränkt, …

            // ── Ärzte & Kontaktpersonen (verschlüsselt JSON) ─
            $table->text('treating_doctors')->nullable();         // JSON array of objects
            $table->text('emergency_contacts')->nullable();       // JSON array of objects

            // ── Rechtliche Angaben (verschlüsselt) ─────────
            $table->text('legal_guardian')->nullable();           // JSON object (Name, Telefon, …)
            $table->boolean('has_advance_directive')->default(false);  // Patientenverfügung
            $table->text('advance_directive_notes')->nullable();
            $table->boolean('has_power_of_attorney')->default(false);  // Vorsorgevollmacht
            $table->text('power_of_attorney_notes')->nullable();
            $table->boolean('has_dnr_order')->default(false);          // DNR-Verfügung

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
