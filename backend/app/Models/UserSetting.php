<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSetting extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'user_settings';

    protected $fillable = [
        'user_id',
        'language',
        'timezone',
        'date_format',
        'theme',
        'email_notifications',
        'push_notifications',
        'low_stock_alerts',
        'order_alerts',
        'digest_frequency',
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'push_notifications'  => 'boolean',
        'low_stock_alerts'    => 'boolean',
        'order_alerts'        => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}