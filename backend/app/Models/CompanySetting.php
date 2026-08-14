<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySetting extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'company_settings';

    protected $fillable = [
        'company_name',
        'trading_name',
        'tin',
        'industry',
        'street_address',
        'city',
        'province',
        'region',
        'zip_code',
        'country',
        'landmark',
        'phone',
        'email',
        'website',
        'timezone',
        'currency',
        'date_format',
        'language',
        'default_warehouse_id',
        'fiscal_year_start',
        'low_stock_threshold',
        'auto_reorder',
    ];

    protected $casts = [
        'low_stock_threshold' => 'decimal:4',
    ];

    public function defaultWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'default_warehouse_id');
    }
}