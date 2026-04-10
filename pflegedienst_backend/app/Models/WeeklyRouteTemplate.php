<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WeeklyRouteTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'weekday',
        'route_name',
        'employee_id',
        'planner_id',
        'shift_start_time',
        'start_address',
        'end_address',
        'total_travel_minutes',
        'total_service_minutes',
        'total_distance_meters',
        'route_geometry',
        'summary',
    ];

    protected $casts = [
        'route_geometry' => 'array',
        'summary' => 'array',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function planner()
    {
        return $this->belongsTo(User::class, 'planner_id');
    }

    public function stops()
    {
        return $this->hasMany(WeeklyRouteTemplateStop::class)->orderBy('stop_order');
    }

    public function overrides()
    {
        return $this->hasMany(WeeklyRouteOverride::class)->orderBy('route_date');
    }
}
