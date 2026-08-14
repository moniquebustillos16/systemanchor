<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RolePermissions extends Model
{
    protected $table = 'role_permissions';

    public $timestamps = false;

    protected $fillable = [
        'role_id',
        'permission_id',
    ];

    // =====================================================
    // RELATIONSHIPS
    // =====================================================

    /**
     * Role assigned to this permission record.
     */
    public function role()
    {
        return $this->belongsTo(
            Roles::class,
            'role_id'
        );
    }

    /**
     * Permission assigned to this role.
     */
    public function permission()
    {
        return $this->belongsTo(
            Permission::class,
            'permission_id'
        );
    }
}

