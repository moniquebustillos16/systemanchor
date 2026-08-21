<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CORS – Bearer token API (no cookie credentials)
    |--------------------------------------------------------------------------
    |
    | Frontend origin: http://localhost:5173
    | API base URL:    http://localhost:8000/api
    |
    */

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'login',
        'logout',
    ],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // false = Bearer tokens only (matches axios withCredentials: false)
    // set true only if you switch to Sanctum cookie SPA auth
    'supports_credentials' => false,

];