<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuids, Notifiable, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'warehouse_id',
        'access_all_warehouses',
        'status',
        'last_login_at',
        'phone',
        'job_title',
        'department',
        'image_path',
        'image_url',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at'     => 'datetime',
        'last_login_at'         => 'datetime',
        'password'              => 'hashed',
        'deleted_at'            => 'datetime',
        'access_all_warehouses' => 'boolean',
    ];

    // =====================================================
    // ROLE
    // =====================================================

    public function role(): BelongsTo
    {
        return $this->belongsTo(Roles::class, 'role_id');
    }

    /**
     * Check whether the user's role has a specific permission.
     */
    public function hasPermission(string $permission): bool
    {
        // No role = no permission
        if (!$this->role) {
            return false;
        }

        // Check the permission assigned to the user's role
        return $this->role
            ->permissions()
            ->where('name', $permission)
            ->exists();
    }

    // =====================================================
    // WAREHOUSES
    // =====================================================

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function warehouses(): BelongsToMany
    {
        return $this->belongsToMany(
            Warehouse::class,
            'user_warehouses'
        )->withPivot(
            'id',
            'created_at'
        );
    }

    public function userWarehouses(): HasMany
    {
        return $this->hasMany(UserWarehouse::class);
    }

    // =====================================================
    // SETTINGS
    // =====================================================

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }
}

