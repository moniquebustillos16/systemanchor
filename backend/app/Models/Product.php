<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'products';

    protected $fillable = [
        'sku',
        'name',
        'barcode',
        'serial',
        'category_id',
        'warehouse_id',
        'supplier_id',
        'qty',
        'min_stock',
        'max_stock',
        'price',
        'status',
    ];

    protected $casts = [
        'qty'          => 'decimal:4',
        'min_stock'    => 'decimal:4',
        'max_stock'    => 'decimal:4',
        'price'        => 'decimal:2',
        'category_id'  => 'string',
        'warehouse_id' => 'string',
        'supplier_id'  => 'string',
    ];

    /* ===================== RELATIONS ===================== */

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id', 'id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    /** All images ordered by sort_order */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class, 'product_id', 'id')
                    ->orderBy('sort_order');
    }

    /** Single primary image */
    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class, 'product_id', 'id')
                    ->where('is_primary', true);
    }
}