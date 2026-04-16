<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PatientVisitTodo extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_visit_id',
        'patient_default_todo_id',
        'created_by_user_id',
        'title',
        'notes',
        'is_completed',
        'completed_at',
        'sort_order',
        'source',
    ];

    protected $casts = [
        'title' => 'encrypted',
        'notes' => 'encrypted',
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
        'sort_order' => 'integer',
    ];

    public function visit()
    {
        return $this->belongsTo(PatientVisit::class, 'patient_visit_id');
    }

    public function defaultTodo()
    {
        return $this->belongsTo(PatientDefaultTodo::class, 'patient_default_todo_id');
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}