<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Permission extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'permissions';

    protected $fillable = [
        'id',
        'name',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    // =====================================================
    // RELATIONSHIPS
    // =====================================================

    /**
     * Roles that have this permission.
     */
    public function roles()
    {
        return $this->belongsToMany(
            Roles::class,
            'role_permissions',
            'permission_id',
            'role_id'
        );
    }
}
