<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Zone extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'warehouse_id', 'name', 'type', 'bins_count', 'capacity_pct',
    ];

    protected $casts = [
        'bins_count'   => 'integer',
        'capacity_pct' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(fn ($m) => $m->id ??= (string) Str::uuid());
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function bins()
    {
        return $this->hasMany(Bin::class);
    }
}