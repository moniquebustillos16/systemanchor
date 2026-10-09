<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check');
        DB::statement("ALTER TABLE purchase_orders ALTER COLUMN status TYPE VARCHAR(30) USING lower(status::text)");
        DB::statement("ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'pending'");
    }

    public function down(): void
    {
        throw new RuntimeException('Purchase-order statuses cannot be safely converted back to the legacy enum.');
    }
};