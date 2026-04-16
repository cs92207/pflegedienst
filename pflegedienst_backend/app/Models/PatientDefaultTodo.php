<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PatientDefaultTodo extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'created_by_user_id',
        'title',
        'notes',
        'sort_order',
        'source',
    ];

    protected $casts = [
        'title' => 'encrypted',
        'notes' => 'encrypted',
        'sort_order' => 'integer',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function visitTodos()
    {
        return $this->hasMany(PatientVisitTodo::class);
    }
}