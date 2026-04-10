<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'openstreetmap' => [
        'nominatim_url' => env('OSM_NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),
        'osrm_url' => env('OSRM_URL', 'https://router.project-osrm.org'),
        'user_agent' => env('OSM_USER_AGENT', env('APP_NAME', 'Pflegedienst') . '/1.0'),
        'verify_ssl' => env('OSM_VERIFY_SSL'),
    ],

];
