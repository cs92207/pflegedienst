<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminAccountController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => 1,
            'accounts' => User::query()
                ->orderBy('name')
                ->orderBy('email')
                ->get()
                ->map(fn (User $user) => $this->serializeUser($user))
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_USER])],
        ]);

        $temporaryPassword = $this->generateTemporaryPassword();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($temporaryPassword),
            'role' => $validated['role'],
            'must_change_password' => true,
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'success' => 1,
            'message' => 'Account wurde erstellt.',
            'account' => $this->serializeUser($user),
            'temporary_password' => $temporaryPassword,
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_USER])],
        ]);

        $user->fill($validated);
        $user->save();

        return response()->json([
            'success' => 1,
            'message' => 'Account wurde aktualisiert.',
            'account' => $this->serializeUser($user),
        ]);
    }

    public function resetTemporaryPassword(Request $request, User $user): JsonResponse
    {
        $temporaryPassword = $this->generateTemporaryPassword();

        $user->forceFill([
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
        ])->save();

        $user->tokens()->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Ein neues Einmal-Passwort wurde erstellt.',
            'account' => $this->serializeUser($user->fresh()),
            'temporary_password' => $temporaryPassword,
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()?->id === $user->id) {
            return response()->json([
                'success' => 0,
                'message' => 'Der eigene Administrator-Account kann nicht gelöscht werden.',
            ], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Account wurde gelöscht.',
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'must_change_password' => (bool) $user->must_change_password,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }

    private function generateTemporaryPassword(): string
    {
        return Str::upper(Str::random(4)) . '-' . random_int(1000, 9999) . '-' . Str::lower(Str::random(3));
    }
}