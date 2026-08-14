<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductTransaction extends Model
{
    use SoftDeletes;

    protected $table = 'product_transactions';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'product_id',
        'product_name',
        'transaction_type',
        'reference_id',
        'reference_number',
        'partner_id',
        'partner_type',
        'quantity',
        'unit_price',
        'status',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Helper Methods
    |--------------------------------------------------------------------------
    */

    public function isPurchase(): bool
    {
        return $this->transaction_type === 'purchase';
    }

    public function isSale(): bool
    {
        return $this->transaction_type === 'sale';
    }

    public function isReceiving(): bool
    {
        return $this->transaction_type === 'receiving';
    }

    public function isShipment(): bool
    {
        return $this->transaction_type === 'shipment';
    }

    public function isReturn(): bool
    {
        return $this->transaction_type === 'return';
    }
}