<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shipment extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'shipment_number',
        'sales_order_id',
        'carrier',
        'tracking',
        'warehouse_id',
        'packages',
        'date',
        'status',
    ];

    protected $casts = [
        'packages' => 'integer',
        'date'     => 'date',
    ];

    // Relationships

    public function salesOrder()
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }
}