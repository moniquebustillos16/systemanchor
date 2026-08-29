<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    private function currentUser(Request $request): User
    {
        if ($request->user()) {
            return $request->user()->loadMissing('role');
        }

        $user = User::with('role')->whereNull('deleted_at')->orderBy('created_at')->first();
        if (!$user) {
            abort(401, 'No authenticated user');
        }

        return $user;
    }

    private function ensureSettings(User $user): UserSetting
    {
        return UserSetting::firstOrCreate(
            ['user_id' => $user->id],
            [
                'language'            => 'English',
                'timezone'            => 'Asia/Manila',
                'date_format'         => 'YYYY-MM-DD',
                'theme'               => 'system',
                'email_notifications' => true,
                'push_notifications'  => true,
                'low_stock_alerts'    => true,
                'order_alerts'        => true,
                'digest_frequency'    => 'daily',
            ]
        );
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('role');

        $imageUrl = $user->image_url;
        if (!$imageUrl && $user->image_path) {
            $imageUrl = Storage::disk('public')->url($user->image_path);
        }

        $role = null;
        if ($user->relationLoaded('role') && $user->role) {
            $role = [
                'id'   => (string) $user->role->id,
                'name' => (string) $user->role->name,
            ];
        }

        return [
            'id'                 => (string) $user->id,
            'name'               => (string) ($user->name ?? ''),
            'email'              => (string) ($user->email ?? ''),
            'status'             => (string) ($user->status ?? 'active'),
            'phone'              => $user->phone,
            'job_title'          => $user->job_title,
            'department'         => $user->department,
            'image_path'         => $user->image_path,
            'image_url'          => $imageUrl,
            'role'               => $role,
            'role_id'            => $user->role_id ? (string) $user->role_id : null,
            'last_login_at'      => $user->last_login_at?->toIso8601String(),
            'created_at'         => $user->created_at?->toIso8601String(),
            'email_verified_at'  => $user->email_verified_at?->toIso8601String(),
            'two_factor_enabled' => (bool) ($user->two_factor_enabled ?? false),
        ];
    }

    private function settingsPayload(UserSetting $settings): array
    {
        return [
            'language'            => $settings->language ?? 'English',
            'timezone'            => $settings->timezone ?? 'Asia/Manila',
            'date_format'         => $settings->date_format ?? 'YYYY-MM-DD',
            'theme'               => $settings->theme ?? 'system',
            'email_notifications' => (bool) $settings->email_notifications,
            'push_notifications'  => (bool) $settings->push_notifications,
            'low_stock_alerts'    => (bool) $settings->low_stock_alerts,
            'order_alerts'        => (bool) $settings->order_alerts,
            'digest_frequency'    => $settings->digest_frequency ?? 'daily',
        ];
    }

    private function logActivity(User $user, string $type, string $title, ?string $description = null): void
    {
        if (!Schema::hasTable('profile_activity')) {
            return;
        }

        try {
            DB::table('profile_activity')->insert([
                'id'          => (string) Str::uuid(),
                'user_id'     => $user->id,
                'type'        => $type,
                'title'       => $title,
                'description' => $description,
                'ip_address'  => request()->ip(),
                'user_agent'  => substr((string) request()->userAgent(), 0, 500),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function parseTokenName(?string $name): array
    {
        $defaults = [
            'device'   => 'Unknown device',
            'browser'  => '—',
            'os'       => '—',
            'location' => '—',
            'ip'       => '—',
            'mobile'   => false,
        ];

        if (!$name) {
            return $defaults;
        }

        $parts = array_map('trim', explode('|', $name));
        $devicePart = $parts[0] ?? $name;
        $ip = $parts[1] ?? null;
        $location = $parts[2] ?? null;

        $browser = $devicePart;
        $os = '—';
        if (preg_match('/^(.+?)\s+on\s+(.+)$/i', $devicePart, $m)) {
            $browser = $m[1];
            $os = $m[2];
        }

        $mobile = (bool) preg_match('/iphone|android|mobile/i', $devicePart);

        return [
            'device'   => $devicePart,
            'browser'  => $browser,
            'os'       => $os,
            'location' => $location ?: '—',
            'ip'       => $ip ?: '—',
            'mobile'   => $mobile,
        ];
    }

    /** GET /api/profile */
    public function show(Request $request)
    {
        $user = $this->currentUser($request);
        $settings = $this->ensureSettings($user);

        return response()->json([
            'data' => [
                'user'     => $this->userPayload($user),
                'settings' => $this->settingsPayload($settings),
            ],
        ]);
    }

    /** PUT /api/profile */
    public function update(Request $request)
    {
        $user = $this->currentUser($request);

        $validated = $request->validate([
            'name'  => 'sometimes|required|string|max:255',
            'email' => [
                'sometimes', 'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'phone'      => 'nullable|string|max:50',
            'job_title'  => 'nullable|string|max:150',
            'department' => 'nullable|string|max:150',
        ]);

        $user->update($validated);
        $user->refresh()->load('role');
        $settings = $this->ensureSettings($user);

        $this->logActivity($user, 'success', 'Profile updated', 'Account details were saved successfully');

        return response()->json([
            'message' => 'Profile updated successfully',
            'data'    => [
                'user'     => $this->userPayload($user),
                'settings' => $this->settingsPayload($settings),
            ],
        ]);
    }

    /** PUT /api/profile/password */
    public function updatePassword(Request $request)
    {
        $user = $this->currentUser($request);

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', Password::defaults()],
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect',
                'errors'  => ['current_password' => ['Current password is incorrect']],
            ], 422);
        }

        $user->update(['password' => Hash::make($validated['password'])]);
        $this->logActivity($user, 'warning', 'Password changed', 'Your account password was updated');

        if (method_exists($user, 'tokens')) {
            $currentTokenId = $request->user()?->currentAccessToken()?->id ?? null;
            $user->tokens()
                ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
                ->delete();
        }

        return response()->json(['message' => 'Password updated successfully']);
    }

    /** PUT /api/profile/settings */
    public function updateSettings(Request $request)
    {
        $user = $this->currentUser($request);
        $settings = $this->ensureSettings($user);

        $validated = $request->validate([
            'language'            => 'nullable|string|max:50',
            'timezone'            => 'nullable|string|max:80',
            'date_format'         => ['nullable', 'string', Rule::in(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'])],
            'theme'               => ['nullable', 'string', Rule::in(['light', 'dark', 'system'])],
            'email_notifications' => 'nullable|boolean',
            'push_notifications'  => 'nullable|boolean',
            'low_stock_alerts'    => 'nullable|boolean',
            'order_alerts'        => 'nullable|boolean',
            'digest_frequency'    => ['nullable', 'string', Rule::in(['off', 'daily', 'weekly'])],
        ]);

        foreach (['email_notifications', 'push_notifications', 'low_stock_alerts', 'order_alerts'] as $boolKey) {
            if (array_key_exists($boolKey, $validated)) {
                $validated[$boolKey] = filter_var($validated[$boolKey], FILTER_VALIDATE_BOOLEAN);
            }
        }

        $settings->update($validated);

        $this->logActivity(
            $user,
            'info',
            isset($validated['theme']) ? 'Theme preference saved' : 'Settings updated',
            isset($validated['theme'])
                ? 'Switched to '.$validated['theme'].' theme'
                : 'Preferences were saved'
        );

        return response()->json([
            'message' => 'Settings updated successfully',
            'data'    => $this->settingsPayload($settings->fresh()),
        ]);
    }

    /** POST /api/profile/image */
    public function uploadImage(Request $request)
    {
        $user = $this->currentUser($request);

        $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,webp,gif|max:5120',
        ]);

        if ($user->image_path && Storage::disk('public')->exists($user->image_path)) {
            Storage::disk('public')->delete($user->image_path);
        }

        $path = $request->file('image')->store('users/'.$user->id, 'public');
        $url  = Storage::disk('public')->url($path);

        $user->update([
            'image_path' => $path,
            'image_url'  => $url,
        ]);
        $user->refresh()->load('role');

        $this->logActivity($user, 'success', 'Profile photo updated', 'New avatar uploaded');

        return response()->json([
            'message' => 'Profile image updated',
            'data'    => [
                'image_path' => $path,
                'image_url'  => $url,
                'user'       => $this->userPayload($user),
            ],
        ]);
    }

    /** DELETE /api/profile/image */
    public function deleteImage(Request $request)
    {
        $user = $this->currentUser($request);

        if ($user->image_path && Storage::disk('public')->exists($user->image_path)) {
            Storage::disk('public')->delete($user->image_path);
        }

        $user->update(['image_path' => null, 'image_url' => null]);
        $user->refresh()->load('role');

        $this->logActivity($user, 'info', 'Profile photo removed', 'Avatar was deleted');

        return response()->json([
            'message' => 'Profile image removed',
            'data'    => $this->userPayload($user),
        ]);
    }

    /** GET /api/profile/sessions */
    public function sessions(Request $request)
    {
        $user = $this->currentUser($request);

        if (!method_exists($user, 'tokens')) {
            return response()->json(['data' => []]);
        }

        $currentId = $request->user()?->currentAccessToken()?->id;

        $tokens = $user->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($token) use ($currentId) {
                $meta = $this->parseTokenName($token->name);

                return [
                    'id'         => (string) $token->id,
                    'device'     => $meta['device'],
                    'browser'    => $meta['browser'],
                    'os'         => $meta['os'],
                    'location'   => $meta['location'] ?? '—',
                    'ip'         => $meta['ip'] ?? '—',
                    'lastActive' => $token->last_used_at
                        ? $token->last_used_at->diffForHumans()
                        : ($token->created_at?->diffForHumans() ?? '—'),
                    'current'    => $currentId !== null && (int) $token->id === (int) $currentId,
                    'mobile'     => $meta['mobile'] ?? false,
                ];
            })
            ->values();

        return response()->json(['data' => $tokens]);
    }

    /** DELETE /api/profile/sessions/{id} */
    public function revokeSession(Request $request, string $id)
    {
        $user = $this->currentUser($request);

        if (!method_exists($user, 'tokens')) {
            return response()->json(['message' => 'Sessions not available'], 501);
        }

        $currentId = $request->user()?->currentAccessToken()?->id;

        if ($currentId !== null && (string) $currentId === (string) $id) {
            return response()->json([
                'message' => 'Cannot revoke the current session. Sign out instead.',
            ], 422);
        }

        $deleted = $user->tokens()->where('id', $id)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        $this->logActivity($user, 'warning', 'Session revoked', 'A device was signed out remotely');

        return response()->json(['message' => 'Session revoked']);
    }

    /** DELETE /api/profile/sessions */
    public function revokeOtherSessions(Request $request)
    {
        $user = $this->currentUser($request);

        if (!method_exists($user, 'tokens')) {
            return response()->json(['message' => 'Sessions not available'], 501);
        }

        $currentId = $request->user()?->currentAccessToken()?->id;
        $query = $user->tokens();
        if ($currentId !== null) {
            $query->where('id', '!=', $currentId);
        }
        $count = $query->delete();

        $this->logActivity($user, 'warning', 'Other sessions signed out', "{$count} session(s) revoked");

        return response()->json([
            'message' => 'All other sessions signed out',
            'revoked' => $count,
        ]);
    }

    /** GET /api/profile/activity */
    public function activity(Request $request)
    {
        $user = $this->currentUser($request);

        if (!Schema::hasTable('profile_activity')) {
            return response()->json(['data' => []]);
        }

        try {
            $rows = DB::table('profile_activity')
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
                ->map(function ($row) {
                    return [
                        'id'          => (string) $row->id,
                        'type'        => $row->type ?? 'info',
                        'title'       => $row->title ?? '',
                        'description' => $row->description ?? '',
                        'time'        => $row->created_at
                            ? \Carbon\Carbon::parse($row->created_at)->diffForHumans()
                            : '',
                    ];
                })
                ->values();

            return response()->json(['data' => $rows]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['data' => []]);
        }
    }

    /** GET /api/profile/2fa */
    public function twoFactorStatus(Request $request)
    {
        $user = $this->currentUser($request);

        $enabled = false;
        try {
            if (Schema::hasColumn('users', 'two_factor_enabled')) {
                $enabled = (bool) $user->two_factor_enabled;
            } elseif (Schema::hasColumn('users', 'two_factor_secret')) {
                $enabled = !empty($user->two_factor_secret);
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'data' => ['enabled' => $enabled],
        ]);
    }

    /** POST /api/profile/2fa/enable */
    public function enableTwoFactor(Request $request)
    {
        $user = $this->currentUser($request);

        try {
            if (!Schema::hasColumn('users', 'two_factor_enabled')) {
                return response()->json(['message' => '2FA column missing — run migration'], 501);
            }
            $user->update(['two_factor_enabled' => true]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => '2FA not available'], 501);
        }

        $this->logActivity($user, 'success', '2FA enabled', 'Two-factor authentication was enabled');

        return response()->json([
            'message' => 'Two-factor authentication enabled',
            'data'    => ['enabled' => true],
        ]);
    }

    /** POST /api/profile/2fa/disable */
    public function disableTwoFactor(Request $request)
    {
        $user = $this->currentUser($request);

        $validated = $request->validate([
            'password' => 'required|string',
        ]);

        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Password is incorrect',
                'errors'  => ['password' => ['Password is incorrect']],
            ], 422);
        }

        try {
            $updates = [];
            if (Schema::hasColumn('users', 'two_factor_enabled')) {
                $updates['two_factor_enabled'] = false;
            }
            if (Schema::hasColumn('users', 'two_factor_secret')) {
                $updates['two_factor_secret'] = null;
            }
            if ($updates) {
                $user->update($updates);
            }
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => '2FA not available'], 501);
        }

        $this->logActivity($user, 'warning', '2FA disabled', 'Two-factor authentication was disabled');

        return response()->json([
            'message' => 'Two-factor authentication disabled',
            'data'    => ['enabled' => false],
        ]);
    }
}