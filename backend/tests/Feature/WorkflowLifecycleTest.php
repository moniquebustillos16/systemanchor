<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\GoodsReceipt;
use App\Models\Inventory;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\ReturnModel;
use App\Models\Roles;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkflowLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $warehouseA;

    private Warehouse $warehouseB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouseA = $this->makeWarehouse('LIFE-A');
        $this->warehouseB = $this->makeWarehouse('LIFE-B');
    }

    public function test_login_issues_a_token_and_rejects_invalid_credentials_or_input(): void
    {
        $user = $this->makeUser('Login User', [], $this->warehouseA);
        $user->update(['password' => Hash::make('correct-password')]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ])->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email']]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'incorrect-password',
        ])->assertUnauthorized();

        $this->postJson('/api/login', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_admin_can_assign_warehouses_and_user_access_follows_the_assignment(): void
    {
        $admin = $this->makeUser('Admin', [], $this->warehouseA);
        $user = $this->makeUser('Assigned Operator', ['inventory.view'], $this->warehouseA);
        $this->makeProduct('ASSIGN-A', $this->warehouseA, 2);
        $this->makeProduct('ASSIGN-B', $this->warehouseB, 5);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/users/'.$user->id.'/warehouses', [
                'warehouse_ids' => [$this->warehouseB->id],
                'access_all_warehouses' => false,
            ])
            ->assertOk();

        $this->assertFalse($user->fresh()->canAccessAllWarehouses());
        $this->assertDatabaseHas('user_warehouses', [
            'user_id' => $user->id,
            'warehouse_id' => $this->warehouseB->id,
        ]);
        $this->assertDatabaseMissing('user_warehouses', [
            'user_id' => $user->id,
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->assertSame($this->warehouseB->id, $user->fresh()->warehouse_id);
    }

    public function test_supplier_and_product_creation_validate_and_product_posts_opening_stock(): void
    {
        $user = $this->makeUser(
            'Catalog Operator',
            ['suppliers.create', 'inventory.create'],
            $this->warehouseA
        );

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/suppliers', [
                'name' => 'Invalid supplier email',
                'email' => 'not-an-email',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->postJson('/api/products', [
            'sku' => 'OPENING-001',
            'name' => 'Opening balance product',
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 8,
            'price' => 2.5,
        ])->assertCreated()
            ->assertJsonPath('data.qty', '8.0000');

        $product = Product::query()->where('sku', 'OPENING-001')->firstOrFail();
        $this->assertSame(8.0, (float) Inventory::where('product_id', $product->id)->value('qty'));
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'reason' => 'opening-balance',
        ]);

        $this->postJson('/api/products', [
            'sku' => 'NO-WAREHOUSE-STOCK',
            'name' => 'Invalid opening stock',
            'qty' => 3,
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('products', ['sku' => 'NO-WAREHOUSE-STOCK']);
    }

    public function test_deleted_product_sku_can_be_reused_through_both_product_creation_apis(): void
    {
        $user = $this->makeUser(
            'SKU Reuse Operator',
            ['inventory.create'],
            $this->warehouseA
        );
        $deletedProduct = $this->makeProduct('DEMO-1004', $this->warehouseA);
        $deletedProduct->delete();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/products', [
                'sku' => 'DEMO-1004',
                'name' => 'Replacement demo item',
            ])
            ->assertCreated()
            ->assertJsonPath('data.sku', 'DEMO-1004');

        $replacement = Product::query()->where('sku', 'DEMO-1004')->firstOrFail();
        $this->assertNotSame($deletedProduct->id, $replacement->id);
        $this->assertTrue($deletedProduct->trashed());

        $this->postJson('/api/products', [
            'sku' => 'DEMO-1004',
            'name' => 'Duplicate active SKU',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['sku']);

        $replacement->delete();
        $this->postJson('/api/inventories', [
            'sku' => 'DEMO-1004',
            'name' => 'Replacement inventory item',
            'warehouse_id' => $this->warehouseA->id,
        ])->assertCreated()
            ->assertJsonPath('data.sku', 'DEMO-1004');
    }

    public function test_purchase_and_sales_order_creation_require_valid_product_lines(): void
    {
        $user = $this->makeUser(
            'Order Operator',
            ['purchase_orders.create', 'sales_orders.create'],
            $this->warehouseA
        );
        $supplier = Supplier::create([
            'id' => (string) Str::uuid(),
            'name' => 'Order Supplier',
            'status' => 'active',
        ]);
        $customer = Customer::create([
            'id' => (string) Str::uuid(),
            'name' => 'Order Customer',
            'status' => 'active',
        ]);
        $product = $this->makeProduct('ORDER-LINE-001', $this->warehouseA);

        $this->actingAs($user, 'sanctum');

        $purchaseOrder = [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseA->id,
        ];
        $this->postJson('/api/purchase-orders', $purchaseOrder)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines']);
        $this->postJson('/api/purchase-orders', $purchaseOrder + ['lines' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines']);
        $this->postJson('/api/purchase-orders', $purchaseOrder + [
            'lines' => [['qty' => 1, 'unit_price' => 2.5]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['lines.0.product_id']);
        $this->postJson('/api/purchase-orders', $purchaseOrder + [
            'lines' => [[
                'product_id' => (string) Str::uuid(),
                'qty' => 1,
                'unit_price' => 2.5,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['lines.0.product_id']);

        $createdPurchaseOrder = $this->postJson('/api/purchase-orders', $purchaseOrder + [
            'lines' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty' => 2,
                'unit_price' => 2.5,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.lines.0.product_id', $product->id)
            ->json('data');

        $salesOrder = [
            'customer_id' => $customer->id,
            'warehouse_id' => $this->warehouseA->id,
        ];
        $this->postJson('/api/sales-orders', $salesOrder)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines']);
        $this->postJson('/api/sales-orders', $salesOrder + ['lines' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines']);
        $this->postJson('/api/sales-orders', $salesOrder + [
            'lines' => [['qty' => 1, 'unit_price' => 2.5]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['lines.0.product_id']);
        $this->postJson('/api/sales-orders', $salesOrder + [
            'lines' => [[
                'product_id' => (string) Str::uuid(),
                'qty' => 1,
                'unit_price' => 2.5,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['lines.0.product_id']);

        $createdSalesOrder = $this->postJson('/api/sales-orders', $salesOrder + [
            'lines' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty' => 2,
                'unit_price' => 2.5,
            ]],
        ])->assertCreated()
            ->assertJsonPath('data.lines.0.product_id', $product->id)
            ->json('data');

        $this->assertDatabaseHas('purchase_orders', ['id' => $createdPurchaseOrder['id']]);
        $this->assertDatabaseHas('sales_orders', ['id' => $createdSalesOrder['id']]);
    }

    public function test_product_lookup_returns_only_allowed_warehouse_balances_for_shipping_stock_checks(): void
    {
        $user = $this->makeUser(
            'Shipping Stock Viewer',
            ['inventory.view'],
            $this->warehouseA
        );
        $product = $this->makeProduct('SHIPPING-STOCK-SCOPE', $this->warehouseB, 20);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 0,
        ]);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 20,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/products')
            ->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $product->id);
        $this->assertNotNull($row);
        $this->assertSame([
            [
                'product_id' => $product->id,
                'warehouse_id' => $this->warehouseA->id,
                'qty' => '0.0000',
            ],
        ], array_map(
            fn (array $balance) => [
                'product_id' => $balance['product_id'],
                'warehouse_id' => $balance['warehouse_id'],
                'qty' => $balance['qty'],
            ],
            $row['inventory_balances']
        ));
    }

    public function test_customer_list_includes_sales_order_counts_revenue_and_open_orders(): void
    {
        $user = $this->makeUser('Customer Metrics Viewer', ['customers.view'], $this->warehouseA);
        $customer = Customer::create([
            'name' => 'Metrics Customer',
            'status' => 'active',
        ]);

        foreach ([
            ['pending', 100],
            ['processing', 50],
            ['shipped', 25],
            ['completed', 75],
            ['cancelled', 10],
        ] as [$status, $total]) {
            SalesOrder::create([
                'customer_id' => $customer->id,
                'warehouse_id' => $this->warehouseA->id,
                'order_date' => now()->toDateString(),
                'product_name' => 'Customer metrics product',
                'items' => 1,
                'total' => $total,
                'lines' => [['product_id' => (string) Str::uuid(), 'qty' => 1, 'unit_price' => $total]],
                'status' => $status,
            ]);
        }

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/customers?search=Metrics%20Customer')
            ->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $customer->id);
        $this->assertNotNull($row);
        $this->assertSame(5, (int) $row['orders']);
        $this->assertSame(260.0, (float) $row['revenue']);
        $this->assertSame(3, (int) $row['open']);
    }

    public function test_receiving_posts_once_and_duplicate_completion_is_idempotent(): void
    {
        [$user, $supplier, $product] = $this->receivingFixture();
        $purchaseOrder = $this->makePurchaseOrder($supplier, $product, $this->warehouseA, 4);

        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $purchaseOrder->id,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseA->id,
            'date' => now()->toDateString(),
            'expected' => 4,
            'received' => 4,
            'lines' => [[
                'product_id' => $product->id,
                'expected' => 4,
                'received' => 4,
                'unit_price' => 2.5,
            ]],
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/goods-receipts/'.$receipt->id.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->postJson('/api/goods-receipts/'.$receipt->id.'/complete')
            ->assertOk()
            ->assertJsonPath('message', 'Goods receipt already completed');

        $this->assertSame(4.0, (float) Inventory::where('product_id', $product->id)->value('qty'));
        $this->assertSame(4.0, (float) $product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 1);
        $this->assertSame('completed', GoodsReceipt::findOrFail($receipt->id)->status);
    }

    public function test_legacy_receipt_without_lines_uses_its_single_purchase_order_line(): void
    {
        [$user, $supplier, $product] = $this->receivingFixture();
        $purchaseOrder = $this->makePurchaseOrder($supplier, $product, $this->warehouseA, 4);
        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $purchaseOrder->id,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseA->id,
            'date' => now()->toDateString(),
            'expected' => 4,
            'received' => 0,
            'lines' => null,
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/goods-receipts/'.$receipt->id.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.received', '4.0000')
            ->assertJsonPath('data.lines.0.product_id', $product->id)
            ->assertJsonPath('data.lines.0.received', 4);

        $this->assertSame(4.0, (float) Inventory::where('product_id', $product->id)->value('qty'));
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_receipt_can_use_replacement_product_with_the_deleted_po_product_sku(): void
    {
        [$user, $supplier, $deletedProduct] = $this->receivingFixture();
        $purchaseOrder = $this->makePurchaseOrder($supplier, $deletedProduct, $this->warehouseA, 4);
        $deletedProduct->delete();
        $replacementProduct = $this->makeProduct('RECEIVE-001', $this->warehouseA);

        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $purchaseOrder->id,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseA->id,
            'date' => now()->toDateString(),
            'expected' => 4,
            'received' => 4,
            'lines' => [[
                'product_id' => $replacementProduct->id,
                'expected' => 4,
                'received' => 4,
                'unit_price' => 2.5,
            ]],
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/goods-receipts/'.$receipt->id.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertSame(4.0, (float) Inventory::where('product_id', $replacementProduct->id)->value('qty'));
        $this->assertSame(0.0, (float) Inventory::where('product_id', $deletedProduct->id)->sum('qty'));
    }

    public function test_invalid_receipt_quantity_rolls_back_posting_and_preserves_pending_document(): void
    {
        [$user, $supplier, $product] = $this->receivingFixture();
        $purchaseOrder = $this->makePurchaseOrder($supplier, $product, $this->warehouseA, 2);

        $receipt = GoodsReceipt::create([
            'purchase_order_id' => $purchaseOrder->id,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseA->id,
            'date' => now()->toDateString(),
            'expected' => 2,
            'received' => 3,
            'lines' => [[
                'product_id' => $product->id,
                'expected' => 2,
                'received' => 3,
            ]],
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/goods-receipts/'.$receipt->id.'/complete')
            ->assertUnprocessable();

        $this->assertSame('pending', GoodsReceipt::findOrFail($receipt->id)->status);
        $this->assertSame(0.0, (float) Inventory::where('product_id', $product->id)->sum('qty'));
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_transfer_and_adjustment_api_keep_balances_and_ledger_consistent_on_retry(): void
    {
        $user = $this->makeUser('Admin', [], $this->warehouseA);
        $product = $this->makeProduct('API-MOVEMENT', $this->warehouseA, 10);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 10,
        ]);
        $this->actingAs($user, 'sanctum');
        $transfer = [
            'product_id' => $product->id,
            'type' => 'TRANSFER',
            'qty' => 4,
            'from_warehouse_id' => $this->warehouseA->id,
            'to_warehouse_id' => $this->warehouseB->id,
            'idempotency_key' => 'api-transfer-once',
        ];

        $this->postJson('/api/stock-movements', $transfer)
            ->assertCreated()
            ->assertJsonPath('duplicate', false);
        $this->postJson('/api/stock-movements', $transfer)
            ->assertOk()
            ->assertJsonPath('duplicate', true);

        $this->postJson('/api/stock-movements', [
            'product_id' => $product->id,
            'type' => 'ADJUSTMENT',
            'qty' => 3,
            'warehouse_id' => $this->warehouseB->id,
            'reason' => 'cycle-count',
            'idempotency_key' => 'api-adjust-once',
        ])->assertCreated();

        $this->assertSame(6.0, (float) Inventory::where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouseA->id)->value('qty'));
        $this->assertSame(3.0, (float) Inventory::where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouseB->id)->value('qty'));
        $this->assertSame(9.0, (float) $product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 2);
    }

    public function test_sale_shipment_and_restock_return_follow_valid_transitions_once(): void
    {
        $user = $this->makeUser(
            'Fulfillment Operator',
            ['sales_orders.create', 'shipping.create', 'shipping.update', 'returns.create', 'returns.update'],
            $this->warehouseA
        );
        $customer = Customer::create(['name' => 'Local Customer', 'status' => 'active']);
        $product = $this->makeProduct('FULFILL-001', $this->warehouseA, 3);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 3,
        ]);
        $order = $this->actingAs($user, 'sanctum')
            ->postJson('/api/sales-orders', [
                'customer_id' => $customer->id,
                'warehouse_id' => $this->warehouseA->id,
                'order_date' => now()->toDateString(),
                'lines' => [['product_id' => $product->id, 'qty' => 3, 'unit_price' => 4]],
            ])
            ->assertCreated()
            ->json('data');

        $this->postJson('/api/shipments', [
            'sales_order_id' => $order['id'],
            'carrier' => 'Local carrier',
            'warehouse_id' => $this->warehouseA->id,
            'packages' => 1,
            'date' => now()->toDateString(),
            'status' => 'completed',
            'lines' => [['product_id' => $product->id, 'qty' => 1]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $shipment = $this->postJson('/api/shipments', [
            'sales_order_id' => $order['id'],
            'carrier' => 'Local carrier',
            'warehouse_id' => $this->warehouseA->id,
            'packages' => 1,
            'date' => now()->toDateString(),
            'lines' => [['product_id' => $product->id, 'qty' => 3]],
        ])->assertCreated()->json();

        $this->postJson('/api/shipments/'.$shipment['id'].'/deliver')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->postJson('/api/shipments/'.$shipment['id'].'/deliver')
            ->assertOk()
            ->assertJsonPath('message', 'Shipment already delivered');

        $return = $this->postJson('/api/returns', [
            'sales_order_id' => $order['id'],
            'warehouse_id' => $this->warehouseA->id,
            'reason' => 'Customer return',
            'disposition' => 'Inspect & restock',
            'items' => 1,
            'date' => now()->toDateString(),
            'lines' => [['product_id' => $product->id, 'qty' => 1]],
        ])->assertCreated()->json();

        $this->postJson('/api/returns/'.$return['id'].'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->postJson('/api/returns/'.$return['id'].'/complete')
            ->assertOk()
            ->assertJsonPath('message', 'RMA already closed');

        $this->assertSame(1.0, (float) Inventory::where('product_id', $product->id)->value('qty'));
        $this->assertSame(1.0, (float) $product->fresh()->qty);
        $this->assertDatabaseCount('stock_movements', 2);
        $this->assertSame('completed', ReturnModel::findOrFail($return['id'])->status);
        $this->assertSame('completed', Shipment::findOrFail($shipment['id'])->status);
        $this->assertSame('completed', SalesOrder::findOrFail($order['id'])->status);

        $this->postJson('/api/shipments', [
            'sales_order_id' => $order['id'],
            'carrier' => 'Duplicate carrier',
            'warehouse_id' => $this->warehouseA->id,
            'packages' => 1,
            'date' => now()->toDateString(),
            'lines' => [['product_id' => $product->id, 'qty' => 1]],
        ])->assertUnprocessable();
    }

    public function test_return_can_reconstruct_lines_for_a_single_legacy_shipment(): void
    {
        $user = $this->makeUser(
            'Legacy Return Operator',
            ['returns.create', 'sales_orders.view'],
            $this->warehouseA
        );
        $customer = Customer::create(['name' => 'Legacy Return Customer', 'status' => 'active']);
        $product = $this->makeProduct('LEGACY-SHIPMENT-LINE', $this->warehouseA);
        $order = SalesOrder::create([
            'customer_id' => $customer->id,
            'warehouse_id' => $this->warehouseA->id,
            'order_date' => now()->toDateString(),
            'items' => 3,
            'total' => 30,
            'lines' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'qty' => 3,
                'unit_price' => 10,
            ]],
            'status' => 'completed',
        ]);
        Shipment::create([
            'shipment_number' => 'SH-LEGACY-LINES',
            'sales_order_id' => $order->id,
            'carrier' => 'Legacy carrier',
            'warehouse_id' => $this->warehouseA->id,
            'packages' => 1,
            'date' => now()->toDateString(),
            'lines' => null,
            'status' => 'completed',
        ]);

        $salesOrdersResponse = $this->actingAs($user, 'sanctum')
            ->getJson('/api/sales-orders?per_page=100')
            ->assertOk();
        $orderData = collect($salesOrdersResponse->json('data'))
            ->firstWhere('id', $order->id);
        $this->assertSame(3.0, (float) $orderData['transaction_lines'][0]['shipped_qty']);
        $this->assertSame(3.0, (float) $orderData['transaction_lines'][0]['remaining_to_return']);

        $response = $this
            ->postJson('/api/returns', [
                'sales_order_id' => $order->id,
                'warehouse_id' => $this->warehouseA->id,
                'reason' => 'Customer return',
                'disposition' => 'Inspect & restock',
                'items' => 1,
                'date' => now()->toDateString(),
                'lines' => [['product_id' => $product->id, 'qty' => 1]],
            ])
            ->assertCreated();

        $createdReturn = ReturnModel::findOrFail($response->json('id'));
        $this->assertSame($order->id, $createdReturn->sales_order_id);
        $this->assertSame($product->id, $createdReturn->lines[0]['product_id']);
    }

    public function test_notification_owner_can_read_and_dismiss_only_their_own_notification(): void
    {
        $owner = $this->makeUser('Notification Owner', [], $this->warehouseA);
        $other = $this->makeUser('Notification Other', [], $this->warehouseB);
        $ownedNotification = Notification::create([
            'user_id' => $owner->id,
            'type' => 'info',
            'title' => 'Owned',
            'message' => 'Visible to owner',
            'is_read' => false,
        ]);
        $foreignNotification = Notification::create([
            'user_id' => $other->id,
            'type' => 'info',
            'title' => 'Private',
            'message' => 'Not visible to owner',
            'is_read' => false,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonFragment(['id' => $ownedNotification->id])
            ->assertJsonMissing(['id' => $foreignNotification->id]);
        $this->postJson('/api/notifications/'.$ownedNotification->id.'/read')
            ->assertOk()
            ->assertJsonPath('data.is_read', true);
        $this->deleteJson('/api/notifications/'.$ownedNotification->id)->assertOk();

        $this->assertDatabaseMissing('notifications', ['id' => $ownedNotification->id]);
        $this->assertDatabaseHas('notifications', [
            'id' => $foreignNotification->id,
            'is_read' => false,
        ]);
    }

    private function makeWarehouse(string $code): Warehouse
    {
        $warehouse = new Warehouse(['name' => $code, 'code' => $code]);
        $warehouse->id = (string) Str::uuid();
        $warehouse->save();

        return $warehouse;
    }

    private function makeUser(string $roleName, array $permissions, Warehouse $warehouse): User
    {
        $role = Roles::create(['name' => $roleName, 'description' => $roleName]);
        if ($permissions !== []) {
            $ids = [];
            foreach ($permissions as $permissionName) {
                $ids[] = Permission::firstOrCreate(['name' => $permissionName])->id;
            }
            $role->permissions()->sync($ids);
        }

        return User::create([
            'name' => $roleName,
            'email' => Str::slug($roleName).'-'.Str::uuid().'@example.test',
            'password' => 'test-password',
            'role_id' => $role->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'active',
        ]);
    }

    private function makeProduct(string $sku, Warehouse $warehouse, float $qty = 0): Product
    {
        return Product::create([
            'sku' => $sku,
            'name' => $sku,
            'warehouse_id' => $warehouse->id,
            'qty' => $qty,
        ]);
    }

    private function receivingFixture(): array
    {
        $user = $this->makeUser(
            'Receiving Operator',
            ['purchase_orders.create', 'receiving.create', 'receiving.update'],
            $this->warehouseA
        );

        return [
            $user,
            Supplier::create([
                'id' => (string) Str::uuid(),
                'name' => 'Receiving Supplier',
                'status' => 'active',
            ]),
            $this->makeProduct('RECEIVE-001', $this->warehouseA),
        ];
    }

    private function makePurchaseOrder(
        Supplier $supplier,
        Product $product,
        Warehouse $warehouse,
        float $quantity
    ): PurchaseOrder {
        return PurchaseOrder::create([
            'id' => (string) Str::uuid(),
            'po_number' => 'PO-'.Str::upper(Str::random(10)),
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'order_date' => now()->toDateString(),
            'product_name' => $product->name,
            'items' => 1,
            'total' => 0,
            'lines' => [['product_id' => $product->id, 'qty' => $quantity, 'unit_price' => 2.5]],
            'status' => 'pending',
        ]);
    }
}
