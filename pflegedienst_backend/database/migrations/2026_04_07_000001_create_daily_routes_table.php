<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_routes', function (Blueprint $table) {
            $table->id();
            $table->string('route_name')->nullable();
            $table->date('route_date');
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

            $table->index(['route_date', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_routes');
    }
};