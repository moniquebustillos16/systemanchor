<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StockMovement extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'movement_number',
        'type',
        'product_id',
        'qty',
        'from_warehouse_id',
        'to_warehouse_id',
        'reference',
        'notes',
        'performed_by',
        'movement_date',
        'status',
    ];

    protected $casts = [
        'qty' => 'float',
        'movement_date' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->movement_number)) {
                $model->movement_number = 'SM-' . strtoupper(Str::random(8));
            }
            if (empty($model->movement_date)) {
                $model->movement_date = now();
            }
            if (empty($model->status)) {
                $model->status = 'posted';
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function fromWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse()
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    public function performedBy()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}   