<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default(User::ROLE_USER)->after('password');
            $table->boolean('must_change_password')->default(false)->after('role');
        });

        DB::table('users')->update([
            'role' => User::ROLE_ADMIN,
            'must_change_password' => false,
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'must_change_password']);
        });
    }
};