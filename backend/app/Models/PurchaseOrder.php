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
        'expected_date',
        'reference',
        'notes',
        'items',
        'total',
        'status',
    ];

    protected $casts = [
        'order_date'    => 'date',
        'expected_date' => 'date',
        'total'         => 'float',
        'items'         => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->po_number)) {
                $model->po_number = static::generateUniquePoNumber();
            }

            if (empty($model->order_date)) {
                $model->order_date = now()->toDateString();
            }

            if (empty($model->status)) {
                $model->status = 'pending';
            }

            // Normalize items / total so validation + DB stay happy
            if ($model->items === null || $model->items === '') {
                $model->items = 1;
            } else {
                $model->items = (int) max(1, round((float) $model->items));
            }

            if ($model->total === null || $model->total === '') {
                $model->total = 0;
            }
        });
    }

    /**
     * PO-YYYYMMDD-XXXX  (collision-resistant; retries on rare clash)
     */
    public static function generateUniquePoNumber(): string
    {
        $prefix = 'PO-' . now()->format('Ymd') . '-';

        for ($i = 0; $i < 12; $i++) {
            $candidate = $prefix . strtoupper(Str::random(4));
            if (!static::withTrashed()->where('po_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        // Extremely rare fallback
        return $prefix . strtoupper(Str::random(8));
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