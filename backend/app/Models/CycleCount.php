<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CycleCount extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'code',
        'warehouse_id',
        'zone',
        'scheduled_date',
        'started_at',
        'ended_at',
        'counted',
        'system_qty',
        'variance',
        'accuracy',
        'counter',
        'status',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'counted'        => 'float',
        'system_qty'     => 'float',
        'accuracy'       => 'float',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (self $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->code)) {
                $last = static::withTrashed()->orderByDesc('created_at')->first();
                $num = 430;
                if ($last && preg_match('/CC-(\d+)/', $last->code, $m)) {
                    $num = (int) $m[1] + 1;
                }
                $model->code = 'CC-' . $num;
            }
        });
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }
}