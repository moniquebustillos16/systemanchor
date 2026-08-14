<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'suppliers';

    protected $fillable = [
        'name',
        'contact',
        'email',
        'phone',
        'city',
        'product_offers',
        'score',
        'status',
    ];

    protected $casts = [
        'score' => 'decimal:2',
    ];
}