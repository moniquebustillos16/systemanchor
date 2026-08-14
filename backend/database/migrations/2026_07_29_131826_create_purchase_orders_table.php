<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {

            $table->id();


            /*
            |--------------------------------------------------------------------------
            | Supplier Relationship
            |--------------------------------------------------------------------------
            */

            $table->foreignId('supplier_id')
                ->constrained()
                ->cascadeOnDelete();


            /*
            |--------------------------------------------------------------------------
            | Purchase Order Information
            |--------------------------------------------------------------------------
            */

            $table->string('po_number')
                ->unique();


            $table->date('order_date');


            $table->enum('status', [

                'PENDING',
                'APPROVED',
                'RECEIVED',
                'CANCELLED'

            ])
            ->default('PENDING');


            /*
            |--------------------------------------------------------------------------
            | Financial Information
            |--------------------------------------------------------------------------
            */

            $table->decimal('total_amount', 12, 2)
                ->default(0);


            $table->text('notes')
                ->nullable();


            $table->timestamps();

        });
    }


    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};