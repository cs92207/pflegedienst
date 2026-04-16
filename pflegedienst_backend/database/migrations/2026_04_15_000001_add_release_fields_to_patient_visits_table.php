<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_visits', function (Blueprint $table) {
            $table->timestamp('released_to_admin_at')->nullable()->after('notes');
            $table->foreignId('released_to_admin_by_user_id')->nullable()->after('released_to_admin_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('patient_visits', function (Blueprint $table) {
            $table->dropConstrainedForeignId('released_to_admin_by_user_id');
            $table->dropColumn('released_to_admin_at');
        });
    }
};