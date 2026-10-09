<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE suppliers ADD COLUMN id_uuid UUID');
        DB::statement('UPDATE suppliers SET id_uuid = gen_random_uuid()');
        DB::statement('ALTER TABLE purchase_orders ADD COLUMN supplier_uuid UUID');
        DB::statement('UPDATE purchase_orders AS po SET supplier_uuid = suppliers.id_uuid FROM suppliers WHERE po.supplier_id = suppliers.id');
        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_supplier_id_foreign');
        DB::statement('ALTER TABLE purchase_orders DROP COLUMN supplier_id');
        DB::statement('ALTER TABLE purchase_orders RENAME COLUMN supplier_uuid TO supplier_id');
        DB::statement('ALTER TABLE purchase_orders ALTER COLUMN supplier_id SET NOT NULL');

        DB::statement('ALTER TABLE suppliers DROP CONSTRAINT suppliers_pkey');
        DB::statement('ALTER TABLE suppliers DROP COLUMN id');
        DB::statement('ALTER TABLE suppliers RENAME COLUMN id_uuid TO id');
        DB::statement('ALTER TABLE suppliers ALTER COLUMN id SET NOT NULL');
        DB::statement('ALTER TABLE suppliers ADD PRIMARY KEY (id)');
        DB::statement('ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_foreign FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE');

        DB::statement('ALTER TABLE purchase_orders ADD COLUMN id_uuid UUID');
        DB::statement('UPDATE purchase_orders SET id_uuid = gen_random_uuid()');
        DB::statement('ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_pkey');
        DB::statement('ALTER TABLE purchase_orders DROP COLUMN id');
        DB::statement('ALTER TABLE purchase_orders RENAME COLUMN id_uuid TO id');
        DB::statement('ALTER TABLE purchase_orders ALTER COLUMN id SET NOT NULL');
        DB::statement('ALTER TABLE purchase_orders ADD PRIMARY KEY (id)');
    }

    public function down(): void
    {
        throw new RuntimeException('UUID identifiers cannot be safely converted back to numeric IDs.');
    }
};