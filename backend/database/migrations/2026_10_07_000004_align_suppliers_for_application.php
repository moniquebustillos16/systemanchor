<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'contact')) {
                $table->string('contact', 150)->nullable();
            }
            if (!Schema::hasColumn('suppliers', 'city')) {
                $table->string('city', 100)->nullable();
            }
            if (!Schema::hasColumn('suppliers', 'product_offers')) {
                $table->text('product_offers')->nullable();
            }
            if (!Schema::hasColumn('suppliers', 'score')) {
                $table->decimal('score', 5, 2)->default(80);
            }
            if (!Schema::hasColumn('suppliers', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        DB::statement("ALTER TABLE suppliers ALTER COLUMN status TYPE VARCHAR(30) USING CASE WHEN status THEN 'active' ELSE 'inactive' END");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE suppliers ALTER COLUMN status TYPE BOOLEAN USING status = 'active'");

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['contact', 'city', 'product_offers', 'score']);
        });
    }
};