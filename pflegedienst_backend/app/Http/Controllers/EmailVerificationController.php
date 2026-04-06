<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Auth\Events\Verified;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, $id, $hash)
    {
        $user = User::findOrFail($id);

        // Prüfen, ob Hash stimmt
        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return response()->json(['message' => 'Ungültiger Verifizierungslink'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return redirect('http://localhost:4200/sign-up');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return redirect('http://localhost:4200/sign-up');
    }
}
