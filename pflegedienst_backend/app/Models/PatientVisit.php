<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PatientVisit extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'created_by_user_id',
        'visit_date',
        'start_time',
        'end_time',
        'notes',
        'released_to_admin_at',
        'released_to_admin_by_user_id',
    ];

    protected $casts = [
        'visit_date' => 'date',
        'notes' => 'encrypted',
        'released_to_admin_at' => 'datetime',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function releasedToAdminByUser()
    {
        return $this->belongsTo(User::class, 'released_to_admin_by_user_id');
    }

    public function todos()
    {
        return $this->hasMany(PatientVisitTodo::class)->orderBy('sort_order')->orderBy('id');
    }
}