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
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    private function currentUser(Request $request): User
    {
        if ($request->user()) {
            return $request->user();
        }

        // Dev fallback — remove in production when auth is always required
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

    /**
     * Append a row to profile_activity if the table exists (optional).
     */
    private function logActivity(User $user, string $type, string $title, ?string $description = null): void
    {
        if (!Schema::hasTable('profile_activity')) {
            return;
        }

        DB::table('profile_activity')->insert([
            'id'          => (string) \Illuminate\Support\Str::uuid(),
            'user_id'     => $user->id,
            'type'        => $type,
            'title'       => $title,
            'description' => $description,
            'ip_address'  => request()->ip(),
            'user_agent'  => substr((string) request()->userAgent(), 0, 500),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    /**
     * GET /api/profile
     */
    public function show(Request $request)
    {
        $user = $this->currentUser($request);
        $user->load('role');
        $settings = $this->ensureSettings($user);

        // Ensure image_url is absolute when path exists
        if ($user->image_path && !$user->image_url) {
            $user->image_url = Storage::disk('public')->url($user->image_path);
        }

        return response()->json([
            'data' => [
                'user'     => $user,
                'settings' => $settings,
            ],
        ]);
    }

    /**
     * PUT /api/profile
     */
    public function update(Request $request)
    {
        $user = $this->currentUser($request);

        $validated = $request->validate([
            'name'       => 'sometimes|required|string|max:255',
            'email'      => [
                'sometimes', 'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'phone'      => 'nullable|string|max:50',
            'job_title'  => 'nullable|string|max:150',
            'department' => 'nullable|string|max:150',
        ]);

        $user->update($validated);
        $user->load('role');
        $settings = $this->ensureSettings($user);

        $this->logActivity($user, 'success', 'Profile updated', 'Account details were saved successfully');

        return response()->json([
            'message' => 'Profile updated successfully',
            'data'    => [
                'user'     => $user->fresh(['role']),
                'settings' => $settings,
            ],
        ]);
    }

    /**
     * PUT /api/profile/password
     */
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

        // Optionally revoke other tokens so password change forces re-login elsewhere
        if (method_exists($user, 'tokens')) {
            $currentTokenId = $request->user()?->currentAccessToken()?->id ?? null;
            $user->tokens()
                ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
                ->delete();
        }

        return response()->json(['message' => 'Password updated successfully']);
    }

    /**
     * PUT /api/profile/settings
     */
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

        // Cast booleans if sent as "true"/"false" strings
        foreach (['email_notifications', 'push_notifications', 'low_stock_alerts', 'order_alerts'] as $boolKey) {
            if (array_key_exists($boolKey, $validated)) {
                $validated[$boolKey] = filter_var($validated[$boolKey], FILTER_VALIDATE_BOOLEAN);
            }
        }

        $settings->update($validated);

        if (isset($validated['theme'])) {
            $this->logActivity($user, 'info', 'Theme preference saved', 'Switched to ' . $validated['theme'] . ' theme');
        } else {
            $this->logActivity($user, 'info', 'Settings updated', 'Preferences were saved');
        }

        return response()->json([
            'message' => 'Settings updated successfully',
            'data'    => $settings->fresh(),
        ]);
    }

    /**
     * POST /api/profile/image
     */
    public function uploadImage(Request $request)
    {
        $user = $this->currentUser($request);

        $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,webp,gif|max:5120',
        ]);

        if ($user->image_path && Storage::disk('public')->exists($user->image_path)) {
            Storage::disk('public')->delete($user->image_path);
        }

        $path = $request->file('image')->store('users/' . $user->id, 'public');
        $url  = Storage::disk('public')->url($path);

        $user->update([
            'image_path' => $path,
            'image_url'  => $url,
        ]);

        $this->logActivity($user, 'success', 'Profile photo updated', 'New avatar uploaded');

        return response()->json([
            'message' => 'Profile image updated',
            'data'    => [
                'image_path' => $path,
                'image_url'  => $url,
                'user'       => $user->fresh()->load('role'),
            ],
        ]);
    }

    /**
     * DELETE /api/profile/image
     */
    public function deleteImage(Request $request)
    {
        $user = $this->currentUser($request);

        if ($user->image_path && Storage::disk('public')->exists($user->image_path)) {
            Storage::disk('public')->delete($user->image_path);
        }

        $user->update([
            'image_path' => null,
            'image_url'  => null,
        ]);

        $this->logActivity($user, 'info', 'Profile photo removed', 'Avatar was deleted');

        return response()->json([
            'message' => 'Profile image removed',
            'data'    => $user->fresh()->load('role'),
        ]);
    }

    /* =====================================================================
     |  Sessions  (Sanctum personal access tokens)
     |  GET    /api/profile/sessions
     |  DELETE /api/profile/sessions/{id}
     |  DELETE /api/profile/sessions  (revoke all others)
     * ===================================================================== */

    /**
     * List active sessions / tokens for the current user.
     */
    public function sessions(Request $request)
    {
        $user = $this->currentUser($request);

        if (!method_exists($user, 'tokens')) {
            return response()->json([
                'data'    => [],
                'message' => 'Token-based sessions not available (install Laravel Sanctum)',
            ]);
        }

        $currentToken = $request->user()?->currentAccessToken();
        $currentId    = $currentToken?->id;

        $tokens = $user->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($token) use ($currentId) {
                $meta = $this->parseTokenName($token->name);

                return [
                    'id'          => (string) $token->id,
                    'device'      => $meta['device'],
                    'browser'     => $meta['browser'],
                    'os'          => $meta['os'],
                    'location'    => $meta['location'] ?? '—',
                    'ip'          => $meta['ip'] ?? '—',
                    'lastActive'  => $token->last_used_at
                        ? $token->last_used_at->diffForHumans()
                        : ($token->created_at?->diffForHumans() ?? '—'),
                    'current'     => $currentId !== null && (int) $token->id === (int) $currentId,
                    'mobile'      => $meta['mobile'] ?? false,
                    'created_at'  => $token->created_at?->toIso8601String(),
                    'last_used_at'=> $token->last_used_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json(['data' => $tokens]);
    }

    /**
     * Revoke one session/token (cannot revoke current session via this endpoint).
     */
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

    /**
     * Revoke all sessions except the current one.
     */
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

    /**
     * Best-effort parse of token name set at login, e.g.
     * "Chrome on Windows 11 | 203.177.x.x | Naga City"
     */
    private function parseTokenName(?string $name): array
    {
        $name = $name ?: 'Unknown device';
        $parts = array_map('trim', explode('|', $name));

        $devicePart = $parts[0] ?? 'Unknown device';
        $ip        = $parts[1] ?? null;
        $location  = $parts[2] ?? null;

        $mobile = (bool) preg_match('/iphone|android|mobile|ipad/i', $devicePart);

        // "Chrome on Windows 11"
        $browser = $devicePart;
        $os      = '';
        if (preg_match('/^(.+?)\s+on\s+(.+)$/i', $devicePart, $m)) {
            $browser = $m[1];
            $os      = $m[2];
        }

        return [
            'device'   => $devicePart,
            'browser'  => $browser,
            'os'       => $os ?: '—',
            'ip'       => $ip,
            'location' => $location,
            'mobile'   => $mobile,
        ];
    }

    /* =====================================================================
     |  Activity
     |  GET /api/profile/activity
     * ===================================================================== */

    public function activity(Request $request)
    {
        $user = $this->currentUser($request);
        $limit = min(max((int) $request->query('limit', 20), 1), 50);

        if (Schema::hasTable('profile_activity')) {
            $rows = DB::table('profile_activity')
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'id'          => $row->id,
                    'type'        => $row->type,
                    'title'       => $row->title,
                    'description' => $row->description,
                    'time'        => \Carbon\Carbon::parse($row->created_at)->diffForHumans(),
                    'created_at'  => $row->created_at,
                ]);

            return response()->json(['data' => $rows]);
        }

        // Fallback when table is missing — synthetic recent events from user fields
        $items = [];

        if ($user->updated_at) {
            $items[] = [
                'id'          => 'profile-updated',
                'type'        => 'success',
                'title'       => 'Profile updated',
                'description' => 'Account details were last saved',
                'time'        => $user->updated_at->diffForHumans(),
                'created_at'  => $user->updated_at->toIso8601String(),
            ];
        }
        if ($user->last_login_at) {
            $items[] = [
                'id'          => 'last-login',
                'type'        => 'info',
                'title'       => 'Signed in',
                'description' => 'Last successful login',
                'time'        => $user->last_login_at->diffForHumans(),
                'created_at'  => $user->last_login_at->toIso8601String(),
            ];
        }
        if ($user->created_at) {
            $items[] = [
                'id'          => 'member-since',
                'type'        => 'info',
                'title'       => 'Account created',
                'description' => 'Member since ' . $user->created_at->toFormattedDateString(),
                'time'        => $user->created_at->diffForHumans(),
                'created_at'  => $user->created_at->toIso8601String(),
            ];
        }

        return response()->json(['data' => array_slice($items, 0, $limit)]);
    }

    /* =====================================================================
     |  Two-factor authentication (status + toggle stubs)
     |  GET  /api/profile/2fa
     |  POST /api/profile/2fa/enable
     |  POST /api/profile/2fa/disable
     |
     |  Requires columns on users: two_factor_secret, two_factor_enabled (bool)
     |  Or use Laravel Fortify / a package for full TOTP.
     * ===================================================================== */

    public function twoFactorStatus(Request $request)
    {
        $user = $this->currentUser($request);

        $enabled = (bool) ($user->two_factor_enabled ?? false);

        return response()->json([
            'data' => [
                'enabled' => $enabled,
                // Never return the raw secret in status
            ],
        ]);
    }

    public function enableTwoFactor(Request $request)
    {
        $user = $this->currentUser($request);

        if (!Schema::hasColumn('users', 'two_factor_enabled')) {
            return response()->json([
                'message' => 'Two-factor columns not migrated yet. Add two_factor_enabled / two_factor_secret to users.',
            ], 501);
        }

        // Minimal enable: flag only. Wire to Fortify/Google2FA for real secrets.
        $user->forceFill([
            'two_factor_enabled' => true,
        ])->save();

        $this->logActivity($user, 'success', 'Two-factor authentication enabled', 'Authenticator app protection is on');

        return response()->json([
            'message' => 'Two-factor authentication enabled',
            'data'    => ['enabled' => true],
        ]);
    }

    public function disableTwoFactor(Request $request)
    {
        $user = $this->currentUser($request);

        $request->validate([
            'password' => 'required|string',
        ]);

        if (!Hash::check($request->input('password'), $user->password)) {
            return response()->json([
                'message' => 'Password is incorrect',
                'errors'  => ['password' => ['Password is incorrect']],
            ], 422);
        }

        if (!Schema::hasColumn('users', 'two_factor_enabled')) {
            return response()->json([
                'message' => 'Two-factor columns not migrated yet.',
            ], 501);
        }

        $user->forceFill([
            'two_factor_enabled' => false,
            'two_factor_secret'  => null,
        ])->save();

        $this->logActivity($user, 'warning', 'Two-factor authentication disabled', 'Authenticator app protection was turned off');

        return response()->json([
            'message' => 'Two-factor authentication disabled',
            'data'    => ['enabled' => false],
        ]);
    }

    /**
     * GET /api/profile/export — optional server-side export
     */
    public function export(Request $request)
    {
        $user = $this->currentUser($request);
        $user->load('role');
        $settings = $this->ensureSettings($user);

        return response()->json([
            'exported_at' => now()->toIso8601String(),
            'user'        => [
                'id'            => $user->id,
                'name'          => $user->name,
                'email'         => $user->email,
                'phone'         => $user->phone,
                'job_title'     => $user->job_title,
                'department'    => $user->department,
                'role'          => $user->role?->name,
                'status'        => $user->status,
                'created_at'    => $user->created_at,
                'last_login_at' => $user->last_login_at,
            ],
            'settings'    => $settings,
        ]);
    }
}