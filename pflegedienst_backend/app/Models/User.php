<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Notifications\CustomVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Notifications\CustomResetPassword;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_USER = 'user';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'must_change_password',
        'email_verified_at',
    ];

    public function sendEmailVerificationNotification()
    {
        $this->notify(new CustomVerifyEmail);
    }

    public function sendPasswordResetNotification($token)
    {
        $this->notify(new CustomResetPassword($token, $this->email));
    }

    public function customers()
    {
        return $this->hasMany(Customer::class, 'user');
    }

    public function projects()
    {
        return $this->hasManyThrough(
            Project::class,
            Customer::class,
            'user',      // FK in customers table
            'customer'   // FK in projects table
        );
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function assignedDailyRoutes()
    {
        return $this->hasMany(DailyRoute::class, 'employee_id');
    }

    public function plannedDailyRoutes()
    {
        return $this->hasMany(DailyRoute::class, 'planner_id');
    }

    public function assignedWeeklyRouteTemplates()
    {
        return $this->hasMany(WeeklyRouteTemplate::class, 'employee_id');
    }

    public function plannedWeeklyRouteTemplates()
    {
        return $this->hasMany(WeeklyRouteTemplate::class, 'planner_id');
    }

    public function assignedWeeklyRouteOverrides()
    {
        return $this->hasMany(WeeklyRouteOverride::class, 'employee_id');
    }

    public function plannedWeeklyRouteOverrides()
    {
        return $this->hasMany(WeeklyRouteOverride::class, 'planner_id');
    }

    public function responsiblePatients()
    {
        return $this->belongsToMany(Patient::class, 'patient_responsible_users')
            ->withTimestamps()
            ->orderBy('last_name')
            ->orderBy('first_name');
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'must_change_password' => 'boolean',
    ];
}
