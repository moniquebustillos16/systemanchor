<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class PurchaseOrder extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'po_number',
        'supplier_id',
        'warehouse_id',
        'order_date',
        'items',
        'total',
        'status',
    ];

    protected $casts = [
        'order_date' => 'date',
        'total'      => 'float',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->po_number)) {
                $model->po_number = 'PO-' . date('Y') . '-' . str_pad(
                    (string) random_int(1, 9999),
                    4,
                    '0',
                    STR_PAD_LEFT
                );
            }
            if (empty($model->order_date)) {
                $model->order_date = now()->toDateString();
            }
            if (empty($model->status)) {
                $model->status = 'pending';
            }
        });
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }
}