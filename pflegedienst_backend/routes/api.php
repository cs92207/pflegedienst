<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AppointmentRequestController;
use App\Http\Controllers\AppointmentScriptController;
use App\Http\Controllers\AdminAccountController;
use App\Http\Controllers\DailyRouteController;
use App\Http\Controllers\WeeklyRoutePlanController;
use App\Http\Controllers\PatientController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TransportRequestController;
use App\Http\Controllers\ProjectRequestController;
use App\Http\Controllers\TodoController;
use App\Http\Controllers\LeadsController;
use App\Mail\GenericMail;
use Illuminate\Support\Facades\Mail;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::post('/signin', [AuthController::class, 'signin']);
Route::middleware('auth:sanctum')->get('/autosignin', [AuthController::class, 'automaticSignIn']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);

Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('/password/reset', [AuthController::class, 'resetPassword']);
Route::post('/check-reset-token', [AuthController::class, 'checkResetToken']);

Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware(['signed'])
    ->name('verification.verify');

// resend E-Mail
Route::post('/email/resend', function (Request $request) {
    if ($request->user()->hasVerifiedEmail()) {
        return response()->json(['message' => 'Bereits bestätigt']);
    }

    $request->user()->sendEmailVerificationNotification();

    return response()->json(['message' => 'Bestätigungs-E-Mail wurde gesendet']);
})->middleware(['auth:sanctum'])->name('verification.send');

Route::get('/user-by-id/{userid}', [AuthController::class, 'getUserByID']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/password/change', [AuthController::class, 'changePassword']);
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/accounts', [AdminAccountController::class, 'index']);
    Route::post('/accounts', [AdminAccountController::class, 'store']);
    Route::put('/accounts/{user}', [AdminAccountController::class, 'update']);
    Route::post('/accounts/{user}/temporary-password', [AdminAccountController::class, 'resetTemporaryPassword']);
    Route::delete('/accounts/{user}', [AdminAccountController::class, 'destroy']);

    // Patienten (Pflegekunden)
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::get('/patients/{patient}', [PatientController::class, 'show']);
    Route::put('/patients/{patient}', [PatientController::class, 'update']);
    Route::delete('/patients/{patient}', [PatientController::class, 'destroy']);

    Route::get('/daily-routes', [DailyRouteController::class, 'index']);
    Route::post('/daily-routes', [DailyRouteController::class, 'store']);
    Route::get('/daily-routes/{dailyRoute}', [DailyRouteController::class, 'show']);
    Route::put('/daily-routes/{dailyRoute}', [DailyRouteController::class, 'update']);
    Route::delete('/daily-routes/{dailyRoute}', [DailyRouteController::class, 'destroy']);

    Route::get('/weekly-route-plan', [WeeklyRoutePlanController::class, 'index']);
    Route::post('/weekly-route-plan/templates', [WeeklyRoutePlanController::class, 'storeTemplate']);
    Route::put('/weekly-route-plan/templates/{weeklyRouteTemplate}', [WeeklyRoutePlanController::class, 'updateTemplate']);
    Route::delete('/weekly-route-plan/templates/{weeklyRouteTemplate}', [WeeklyRoutePlanController::class, 'destroyTemplate']);
    Route::put('/weekly-route-plan/templates/{weeklyRouteTemplate}/overrides/{date}', [WeeklyRoutePlanController::class, 'saveOverride']);
    Route::delete('/weekly-route-plan/templates/{weeklyRouteTemplate}/overrides/{date}', [WeeklyRoutePlanController::class, 'destroyOverride']);
});
