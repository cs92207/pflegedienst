<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_default_todos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('title');
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->enum('source', ['admin', 'caregiver'])->default('caregiver');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_default_todos');
    }
};