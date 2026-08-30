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

    /**
     * Primary/default warehouse.
     *
     * This is kept for compatibility with the existing
     * warehouse_id column on the users table.
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    /**
     * Warehouses assigned to this user.
     *
     * The user_warehouses table contains the assignments.
     */
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

    /**
     * Direct relationship to user_warehouses records.
     */
    public function userWarehouses(): HasMany
    {
        return $this->hasMany(UserWarehouse::class);
    }

    /**
     * Check whether this user has been given access
     * to every warehouse.
     *
     * This value should be controlled by an administrator.
     */
    public function canAccessAllWarehouses(): bool
    {
        return $this->access_all_warehouses === true;
    }

    /**
     * Check whether this user can access a specific warehouse.
     *
     * Rules:
     *
     * 1. If access_all_warehouses = true,
     *    the user can access any warehouse.
     *
     * 2. Otherwise, the warehouse must be assigned
     *    to the user through user_warehouses.
     */
    public function canAccessWarehouse(string $warehouseId): bool
    {
        // Administrator has granted access to all warehouses.
        if ($this->canAccessAllWarehouses()) {
            return true;
        }

        // Otherwise, check the user's assigned warehouses.
        return $this->warehouses()
            ->where('warehouses.id', $warehouseId)
            ->exists();
    }

    /**
     * Get the IDs of all warehouses this user can access.
     *
     * If access_all_warehouses is true:
     *     return every warehouse ID.
     *
     * Otherwise:
     *     return only the IDs from user_warehouses.
     */
    public function accessibleWarehouseIds()
    {
        // User has access to every warehouse.
        if ($this->canAccessAllWarehouses()) {
            return Warehouse::query()->pluck('id');
        }

        // User only has access to assigned warehouses.
        return $this->warehouses()
            ->pluck('warehouses.id');
    }

    // =====================================================
    // SETTINGS
    // =====================================================

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }
}