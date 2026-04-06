<?php

namespace App\Providers;
use Illuminate\Auth\Notifications\ResetPassword;

// use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        // 'App\Models\Model' => 'App\Policies\ModelPolicy',
        \App\Models\Customer::class => \App\Policies\CustomerPolicy::class,
        \App\Models\Project::class => \App\Policies\ProjectPolicy::class
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return env('FRONTEND_URL') . '/reset-password?token=' . $token . '&email=' . $user->email;
        });
    }
}
