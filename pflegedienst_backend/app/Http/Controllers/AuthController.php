<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function getUserByID(Request $request, int $userid) {
        $user = User::findOrFail($userid);
        return response()->json([
            'success' => 1,
            'user' => $this->serializeUser($user)
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        return $status === Password::RESET_LINK_SENT
            ? response()->json(['success' => 1, 'message' => __($status)])
            : response()->json(['success' => 0, 'message' => __($status)], 400);
    }

    public function checkResetToken(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email'
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            return response()->json(['success' => 0, 'message' => 'User not found'], 404);
        }

        // Token prüfen (korrekte Laravel-Methode)
        $tokenRepo = Password::getRepository();

        if ($tokenRepo->exists($user, $request->token)) {
            return response()->json(['success' => 1, 'message' => 'Token gültig']);
        }

        return response()->json(['success' => 0, 'message' => 'Token ungültig'], 400);
    }


    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:6'
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user) use ($request) {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                    'must_change_password' => false,
                ])->setRememberToken(Str::random(60));

                $user->save();
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['success' => 1, 'message' => __($status)])
            : response()->json(['success' => 0, 'message' => __($status)], 400);
    }

    public function signin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => 0,
                'message' => "Email oder Passwort falsch."
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => 0,
                'message' => 'Email oder Passwort falsch.'
            ]);
        }

        $user->tokens()->delete();
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => 1,
            'user' => $this->serializeUser($user),
            'token' => $token,
            'message' => 'Erfolgreich angemeldet.'
        ]);
    }

    public function automaticSignIn(Request $request)
    {
        return response()->json([
            'success' => 1,
            'user' => $this->serializeUser($request->user()),
        ]);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required',
            'password' => 'required|min:8|confirmed',
        ]);

        $user = $request->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => 0,
                'message' => 'Das aktuelle Passwort ist nicht korrekt.',
            ], 422);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => false,
        ])->save();

        $user->tokens()->delete();
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => 1,
            'message' => 'Passwort wurde aktualisiert.',
            'token' => $token,
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'success' => 1,
            'message' => 'Abgemeldet',
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
        ];
    }
}
