<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReturnModel extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'returns';

    protected $fillable = [
        'return_number',
        'sales_order_id',
        'warehouse_id',
        'reason',
        'disposition',
        'items',
        'date',
        'status',
    ];

    protected $casts = [
        'items' => 'integer',
        'date'  => 'date',
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