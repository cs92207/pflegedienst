<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_route_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_route_template_id')->constrained('weekly_route_templates')->cascadeOnDelete();
            $table->date('route_date');
            $table->string('route_name')->nullable();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('planner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('shift_start_time', 5)->nullable();
            $table->string('start_address')->nullable();
            $table->string('end_address')->nullable();
            $table->unsignedInteger('total_travel_minutes')->default(0);
            $table->unsignedInteger('total_service_minutes')->default(0);
            $table->unsignedInteger('total_distance_meters')->default(0);
            $table->json('route_geometry')->nullable();
            $table->json('summary')->nullable();
            $table->timestamps();

            $table->unique(['weekly_route_template_id', 'route_date'], 'weekly_route_overrides_unique_date');
            $table->index(['route_date', 'employee_id']);
        });

        Schema::create('weekly_route_override_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_route_override_id')->constrained('weekly_route_overrides')->cascadeOnDelete();
            $table->foreignId('patient_id')->nullable()->constrained('patients')->nullOnDelete();
            $table->unsignedInteger('stop_order');
            $table->string('patient_name');
            $table->string('patient_number')->nullable();
            $table->string('address_line');
            $table->string('zip_code')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('scheduled_for', 5)->nullable();
            $table->unsignedInteger('service_minutes')->default(30);
            $table->unsignedInteger('travel_minutes_from_previous')->default(0);
            $table->unsignedInteger('travel_distance_meters')->default(0);
            $table->unsignedInteger('waiting_minutes')->default(0);
            $table->string('arrival_time', 5)->nullable();
            $table->string('departure_time', 5)->nullable();
            $table->boolean('fixed_time')->default(false);
            $table->string('notes')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['weekly_route_override_id', 'stop_order'], 'weekly_route_override_stops_unique_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_route_override_stops');
        Schema::dropIfExists('weekly_route_overrides');
    }
};
