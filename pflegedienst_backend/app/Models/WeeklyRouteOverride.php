<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WeeklyRouteOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'weekly_route_template_id',
        'route_date',
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
        'route_date' => 'date',
        'route_geometry' => 'array',
        'summary' => 'array',
    ];

    public function template()
    {
        return $this->belongsTo(WeeklyRouteTemplate::class, 'weekly_route_template_id');
    }

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
        return $this->hasMany(WeeklyRouteOverrideStop::class)->orderBy('stop_order');
    }
}
