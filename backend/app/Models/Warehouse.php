<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes; // only if you use soft deletes

class Warehouse extends Model
{
    // use SoftDeletes; // uncomment if your table has deleted_at

    protected $fillable = [
        'name',
        'code',
        'location',
        'manager',
        'capacity',
        'utilized',
        'zones',
        'bins',
        'status',
    ];

    // If your IDs are UUIDs:
    public $incrementing = false;
    protected $keyType = 'string';

    protected $casts = [
        'capacity'  => 'float',
        'utilized'  => 'float',
        'zones'     => 'integer',
        'bins'      => 'integer',
    ];
}