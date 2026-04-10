<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WeeklyRouteTemplateStop extends Model
{
    use HasFactory;

    protected $fillable = [
        'weekly_route_template_id',
        'patient_id',
        'stop_order',
        'patient_name',
        'patient_number',
        'address_line',
        'zip_code',
        'city',
        'latitude',
        'longitude',
        'scheduled_for',
        'service_minutes',
        'travel_minutes_from_previous',
        'travel_distance_meters',
        'waiting_minutes',
        'arrival_time',
        'departure_time',
        'fixed_time',
        'notes',
        'meta',
    ];

    protected $casts = [
        'fixed_time' => 'boolean',
        'meta' => 'array',
    ];

    public function weeklyRouteTemplate()
    {
        return $this->belongsTo(WeeklyRouteTemplate::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }
}
