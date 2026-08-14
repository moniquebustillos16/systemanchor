<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class GoodsReceipt extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'goods_receipts';

    protected $fillable = [
        'id',
        'receipt_number',
        'purchase_order_id',
        'supplier_id',
        'warehouse_id',
        'receiver_id',
        'date',
        'expected',
        'received',
        'status',
    ];

    protected $casts = [
        'date'       => 'date',
        'expected'   => 'decimal:4',
        'received'   => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $attributes = [
        'status'   => 'pending',
        'expected' => 0,
        'received' => 0,
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->receipt_number)) {
                $model->receipt_number = 'GR-' . strtoupper(Str::random(8));
            }
        });
    }

    // ================== Relationships ==================

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }
}