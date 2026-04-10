<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_route_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_route_id')->constrained('daily_routes')->cascadeOnDelete();
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

            $table->unique(['daily_route_id', 'stop_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_route_stops');
    }
};