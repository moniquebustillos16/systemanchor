<?php

namespace Tests\Feature;

use App\Models\CycleCount;
use App\Models\GoodsReceipt;
use App\Models\Inventory;
use App\Models\Notification;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Roles;
use App\Models\SalesOrder;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $warehouseA;

    private Warehouse $warehouseB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouseA = $this->makeWarehouse('WH-A');
        $this->warehouseB = $this->makeWarehouse('WH-B');
    }

    public function test_protected_api_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/products')->assertUnauthorized();
    }

    public function test_authenticated_user_without_required_permission_is_forbidden(): void
    {
        $user = $this->makeUser('Viewer', [], $this->warehouseA);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/products')
            ->assertForbidden();
    }

    public function test_permission_catalog_includes_receiving_shipping_returns_and_settings(): void
    {
        $this->seed(PermissionSeeder::class);

        foreach ([
            'receiving.view',
            'receiving.create',
            'receiving.update',
            'shipping.view',
            'shipping.create',
            'shipping.update',
            'returns.view',
            'returns.create',
            'returns.update',
            'settings.view',
            'settings.update',
        ] as $permission) {
            $this->assertDatabaseHas('permissions', ['name' => $permission]);
        }
    }

    public function test_sales_orders_role_permission_grants_sales_order_api_access(): void
    {
        $user = $this->makeUser(
            'Sales Orders Viewer',
            ['sales_orders.view'],
            $this->warehouseA
        );

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/sales-orders')
            ->assertOk();
    }

    public function test_product_api_hides_products_outside_the_users_warehouses(): void
    {
        $user = $this->makeUser('Inventory Viewer', ['inventory.view'], $this->warehouseA);
        $foreignProduct = $this->makeProduct('FOREIGN-SKU', $this->warehouseB);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/products')
            ->assertOk()
            ->assertJsonMissing(['id' => $foreignProduct->id]);

        $this->getJson('/api/products/'.$foreignProduct->id)->assertNotFound();
    }

    public function test_product_creation_cannot_open_stock_in_an_unassigned_warehouse(): void
    {
        $user = $this->makeUser('Inventory Creator', ['inventory.create'], $this->warehouseA);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/products', [
                'sku' => 'FOREIGN-OPENING',
                'name' => 'Unauthorized opening stock',
                'warehouse_id' => $this->warehouseB->id,
                'qty' => 5,
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('products', ['sku' => 'FOREIGN-OPENING']);
    }

    public function test_scoped_inventory_does_not_return_aggregate_stock_from_other_warehouses(): void
    {
        $user = $this->makeUser('Inventory Viewer', ['inventory.view'], $this->warehouseA);
        $product = $this->makeProduct('SCOPED-SKU', $this->warehouseA, 10);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 4,
        ]);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 6,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson(
            '/api/inventories?warehouse_id='.$this->warehouseA->id
        );

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $product->id);
        $this->assertNotNull($row);
        $this->assertSame(4.0, (float) $row['qty']);
        $this->assertSame(4.0, (float) $row['total_qty']);
        $this->assertCount(1, $row['inventory_balances']);
    }

    public function test_warehouse_inventory_includes_legacy_products_without_balance_rows(): void
    {
        $user = $this->makeUser('Inventory Viewer', ['inventory.view'], $this->warehouseA);
        $product = $this->makeProduct('LEGACY-WAREHOUSE-SKU', $this->warehouseA, 8);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson(
                '/api/inventories?warehouse_id='.$this->warehouseA->id
                .'&search=LEGACY-WAREHOUSE-SKU&status=active'
            );
        $response->assertOk()
            ->assertJsonFragment([
                'id' => $product->id,
                'warehouse_id' => $this->warehouseA->id,
            ]);

        $row = collect($response->json('data'))->firstWhere('id', $product->id);
        $this->assertNotNull($row);
        $this->assertSame(8.0, (float) $row['qty']);
        $this->assertSame(8.0, (float) $row['total_qty']);
        $this->assertSame([], $row['inventory_balances']);
    }

    public function test_today_movement_stats_are_complete_and_warehouse_scoped(): void
    {
        $user = $this->makeUser('Movement Viewer', ['stock.view'], $this->warehouseA);
        $productA = $this->makeProduct('TODAY-MOVEMENT-A', $this->warehouseA);
        $productB = $this->makeProduct('TODAY-MOVEMENT-B', $this->warehouseB);

        foreach ([
            [$productA, $this->warehouseA, now()],
            [$productA, $this->warehouseA, now()->subDay()],
            [$productB, $this->warehouseB, now()],
        ] as [$product, $warehouse, $date]) {
            StockMovement::create([
                'product_id' => $product->id,
                'warehouse_id' => $warehouse->id,
                'type' => 'IN',
                'quantity' => 1,
                'qty' => 1,
                'movement_date' => $date,
                'status' => 'COMPLETED',
            ]);
        }

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/stock-movements/stats')
            ->assertOk()
            ->assertJsonPath('today', 1);
    }

    public function test_all_warehouse_inventory_stats_match_product_totals_without_balance_rows(): void
    {
        $admin = $this->makeUser('Inventory Admin', ['inventory.view'], $this->warehouseA, true);
        Product::create([
            'sku' => 'LOW-STOCK-SKU',
            'name' => 'Low stock item',
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 14,
            'min_stock' => 20,
            'price' => 8.5,
        ]);
        Product::create([
            'sku' => 'OUT-OF-STOCK-SKU',
            'name' => 'Out of stock item',
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 0,
            'min_stock' => 5,
            'price' => 10,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/inventories/stats')
            ->assertOk()
            ->assertJsonPath('total_products', 2)
            ->assertJsonPath('low_stock', 1)
            ->assertJsonPath('out_of_stock', 1)
            ->assertJsonPath('inventory_value', 119);
    }

    public function test_scoped_product_update_does_not_return_the_global_stock_aggregate(): void
    {
        $user = $this->makeUser('Inventory Editor', ['inventory.update'], $this->warehouseA);
        $product = $this->makeProduct('UPDATE-SCOPED-SKU', $this->warehouseA, 10);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 4,
        ]);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 6,
        ]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/products/'.$product->id, ['name' => 'Updated name'])
            ->assertOk()
            ->assertJsonPath('data.qty', '4.0000');
    }

    public function test_notification_endpoint_cannot_create_a_notification_for_another_user(): void
    {
        $user = $this->makeUser('Basic User', [], $this->warehouseA);
        $otherUser = $this->makeUser('Other User', [], $this->warehouseB);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/notifications', [
                'user_id' => $otherUser->id,
                'type' => 'info',
                'title' => 'Injected notification',
                'message' => 'Not mine',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherUser->id,
            'title' => 'Injected notification',
        ]);
    }

    public function test_user_cannot_read_or_modify_another_users_notification(): void
    {
        $user = $this->makeUser('Notification Owner', [], $this->warehouseA);
        $otherUser = $this->makeUser('Notification Stranger', [], $this->warehouseB);
        $notification = Notification::create([
            'user_id' => $otherUser->id,
            'type' => 'info',
            'title' => 'Private',
            'message' => 'Private content',
            'is_read' => false,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications/'.$notification->id)
            ->assertNotFound();
        $this->postJson('/api/notifications/'.$notification->id.'/read')->assertNotFound();
        $this->deleteJson('/api/notifications/'.$notification->id)->assertNotFound();

        $this->assertFalse((bool) $notification->fresh()->is_read);
    }

    public function test_admin_unread_count_is_authenticated_and_scoped_to_the_admin_user(): void
    {
        $admin = $this->makeUser('Admin', [], $this->warehouseA, true);
        $otherUser = $this->makeUser('Notification User', [], $this->warehouseB);
        Notification::create([
            'user_id' => $admin->id,
            'type' => 'info',
            'title' => 'Admin notification',
            'is_read' => false,
        ]);
        Notification::create([
            'user_id' => $otherUser->id,
            'type' => 'info',
            'title' => 'Another user notification',
            'is_read' => false,
        ]);
        Notification::create([
            'user_id' => $admin->id,
            'type' => 'info',
            'title' => 'Read admin notification',
            'is_read' => true,
        ]);

        $this->getJson('/api/notifications/unread-count')
            ->assertUnauthorized();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertExactJson(['data' => ['unread_count' => 1]]);
    }

    public function test_non_administrator_cannot_change_role_permissions_even_with_roles_update_permission(): void
    {
        $user = $this->makeUser('Role Editor', ['roles.update'], $this->warehouseA);
        $targetRole = $this->makeRole('Target Role', []);
        $dangerousPermission = Permission::create(['name' => 'users.delete']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/roles/'.$targetRole->id.'/permissions', [
                'permission_ids' => [$dangerousPermission->id],
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('role_permissions', [
            'role_id' => $targetRole->id,
            'permission_id' => $dangerousPermission->id,
        ]);
    }

    public function test_non_administrator_cannot_change_user_warehouse_assignments(): void
    {
        $user = $this->makeUser('User Manager', ['users.update'], $this->warehouseA);
        $target = $this->makeUser('Target User', [], $this->warehouseA);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/users/'.$target->id.'/warehouses', [
                'warehouse_ids' => [$this->warehouseB->id],
                'access_all_warehouses' => true,
            ])
            ->assertForbidden();

        $this->assertFalse((bool) $target->fresh()->access_all_warehouses);
        $this->assertDatabaseMissing('user_warehouses', [
            'user_id' => $target->id,
            'warehouse_id' => $this->warehouseB->id,
        ]);
    }

    public function test_warehouse_manager_cannot_modify_an_unassigned_warehouse(): void
    {
        $manager = $this->makeUser('Warehouse Manager', ['warehouses.update'], $this->warehouseA);

        $this->actingAs($manager, 'sanctum')
            ->putJson('/api/warehouses/'.$this->warehouseB->id, ['name' => 'Compromised'])
            ->assertForbidden();

        $this->assertDatabaseHas('warehouses', [
            'id' => $this->warehouseB->id,
            'name' => 'WH-B',
        ]);
    }

    public function test_user_cannot_list_or_read_a_goods_receipt_for_an_unassigned_warehouse(): void
    {
        $user = $this->makeUser('Receiving Clerk', ['receiving.view'], $this->warehouseA);
        $receipt = GoodsReceipt::create([
            'purchase_order_id' => (string) Str::uuid(),
            'warehouse_id' => $this->warehouseB->id,
            'date' => now()->toDateString(),
            'expected' => 1,
            'received' => 0,
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/goods-receipts')
            ->assertOk()
            ->assertJsonMissing(['id' => $receipt->id]);
        $this->getJson('/api/goods-receipts/'.$receipt->id)->assertForbidden();
    }

    public function test_cycle_count_reads_are_limited_to_assigned_warehouses(): void
    {
        $user = $this->makeUser('Cycle Count Viewer', ['cycle_counts.view'], $this->warehouseA);
        $foreignCount = CycleCount::create([
            'warehouse_id' => $this->warehouseB->id,
            'zone' => 'Foreign zone',
            'scheduled_date' => now()->toDateString(),
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/cycle-counts')
            ->assertOk()
            ->assertJsonMissing(['id' => $foreignCount->id]);
        $this->getJson('/api/cycle-counts/'.$foreignCount->id)->assertForbidden();
    }

    public function test_cycle_count_system_quantity_is_derived_from_authorized_warehouse_inventory(): void
    {
        $user = $this->makeUser('Cycle Count Creator', ['cycle_counts.create'], $this->warehouseA);
        $productA = $this->makeProduct('COUNT-A', $this->warehouseA);
        $productB = $this->makeProduct('COUNT-B', $this->warehouseB);
        Inventory::create([
            'product_id' => $productA->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 4,
        ]);
        Inventory::create([
            'product_id' => $productB->id,
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 7,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cycle-counts', [
                'warehouse_id' => $this->warehouseA->id,
                'zone' => 'A-01',
                'scheduled_date' => now()->toDateString(),
                'system_qty' => 999,
            ])
            ->assertCreated()
            ->assertJsonPath('system_qty', 4)
            ->assertJsonPath('variance', null);
    }

    public function test_cycle_count_cannot_be_created_or_updated_outside_warehouse_access_or_forge_totals(): void
    {
        $user = $this->makeUser(
            'Cycle Count Editor',
            ['cycle_counts.create', 'cycle_counts.update'],
            $this->warehouseA
        );
        $count = CycleCount::create([
            'warehouse_id' => $this->warehouseA->id,
            'zone' => 'A-01',
            'scheduled_date' => now()->toDateString(),
            'system_qty' => 5,
            'counted' => 5,
            'variance' => '0',
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/cycle-counts', [
                'warehouse_id' => $this->warehouseB->id,
                'zone' => 'B-01',
                'scheduled_date' => now()->toDateString(),
            ])
            ->assertForbidden();
        $this->putJson('/api/cycle-counts/'.$count->id, [
            'counted' => 10,
            'system_qty' => 1,
            'variance' => '+9',
            'accuracy' => 0,
        ])->assertUnprocessable();

        $this->assertSame(5.0, (float) $count->fresh()->system_qty);
        $this->assertSame(5.0, (float) $count->fresh()->counted);
    }

    public function test_stock_movement_requires_the_permission_for_its_type(): void
    {
        $user = $this->makeUser('Read Only Stock', ['stock.view'], $this->warehouseA);
        $product = $this->makeProduct('MOVEMENT-SKU', $this->warehouseA, 5);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/stock-movements', [
                'product_id' => $product->id,
                'type' => 'OUT',
                'qty' => 1,
                'warehouse_id' => $this->warehouseA->id,
                'idempotency_key' => 'unauthorized-stock-out',
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_scoped_user_cannot_discover_transfer_to_an_unassigned_warehouse(): void
    {
        $user = $this->makeUser('Scoped Stock Viewer', ['stock.view'], $this->warehouseA);
        $product = $this->makeProduct('TRANSFER-SKU', $this->warehouseA, 5);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 5,
        ]);
        $movement = app(InventoryService::class)->post([
            'type' => 'TRANSFER',
            'product_id' => $product->id,
            'qty' => 2,
            'from_warehouse_id' => $this->warehouseA->id,
            'to_warehouse_id' => $this->warehouseB->id,
            'idempotency_key' => 'scoped-transfer',
        ])['movement'];

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/stock-movements')
            ->assertOk()
            ->assertJsonMissing(['id' => $movement->id]);
        $this->getJson('/api/stock-movements/'.$movement->id)->assertNotFound();
    }

    public function test_low_stock_notifications_are_limited_to_users_with_warehouse_access(): void
    {
        $operator = $this->makeUser('Stock Operator', ['stock.out'], $this->warehouseA);
        $otherOperator = $this->makeUser('Other Stock Operator', ['stock.out'], $this->warehouseB);
        $product = $this->makeProduct('ALERT-SKU', $this->warehouseA, 1);
        $product->update(['min_stock' => 2]);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseA->id,
            'qty' => 1,
            'min_stock' => 2,
        ]);

        $this->actingAs($operator, 'sanctum')
            ->postJson('/api/stock-movements', [
                'product_id' => $product->id,
                'type' => 'OUT',
                'qty' => 1,
                'warehouse_id' => $this->warehouseA->id,
                'idempotency_key' => 'scoped-low-stock-alert',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $operator->id,
            'title' => 'Out of stock',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherOperator->id,
            'title' => 'Out of stock',
        ]);
    }

    public function test_non_administrator_cannot_create_a_completed_shipment(): void
    {
        $user = $this->makeUser('Shipping Clerk', ['shipping.create'], $this->warehouseA);
        $product = $this->makeProduct('SHIP-SKU', $this->warehouseA);
        $order = SalesOrder::create([
            'so_number' => 'SO-SECURITY-1',
            'warehouse_id' => $this->warehouseA->id,
            'order_date' => now()->toDateString(),
            'items' => 1,
            'lines' => [['product_id' => $product->id, 'qty' => 1]],
            'status' => 'pending',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/shipments', [
                'sales_order_id' => $order->id,
                'carrier' => 'Test carrier',
                'warehouse_id' => $this->warehouseA->id,
                'packages' => 1,
                'date' => now()->toDateString(),
                'lines' => [['product_id' => $product->id, 'qty' => 1]],
                'status' => 'completed',
            ])
            ->assertUnprocessable();

        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_shipment_cannot_issue_stock_from_a_warehouse_different_from_its_sales_order(): void
    {
        $admin = $this->makeUser('Admin', ['shipping.create'], $this->warehouseA, true);
        $product = $this->makeProduct('MISMATCH-SHIPMENT-SKU', $this->warehouseA);
        Inventory::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseB->id,
            'qty' => 5,
        ]);
        $order = SalesOrder::create([
            'so_number' => 'SO-MISMATCH-1',
            'warehouse_id' => $this->warehouseA->id,
            'order_date' => now()->toDateString(),
            'items' => 1,
            'lines' => [['product_id' => $product->id, 'qty' => 2]],
            'status' => 'pending',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/shipments', [
                'sales_order_id' => $order->id,
                'carrier' => 'Test carrier',
                'warehouse_id' => $this->warehouseB->id,
                'packages' => 1,
                'date' => now()->toDateString(),
                'lines' => [['product_id' => $product->id, 'qty' => 2]],
            ])
            ->assertUnprocessable();

        $this->assertDatabaseCount('shipments', 0);
        $this->assertSame('5.0000', (string) Inventory::where('warehouse_id', $this->warehouseB->id)->value('qty'));
    }

    public function test_inactive_users_cannot_log_in_with_valid_credentials(): void
    {
        $role = $this->makeRole('Inactive Role', []);
        $user = User::create([
            'name' => 'Inactive Account',
            'email' => 'inactive@example.test',
            'password' => Hash::make('correct-password'),
            'status' => 'inactive',
            'role_id' => $role->id,
        ]);

        $this->postJson('/api/login', [
            'email' => 'inactive@example.test',
            'password' => 'correct-password',
        ])->assertUnauthorized();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications')
            ->assertForbidden();
    }

    public function test_administrator_retains_cross_warehouse_product_access(): void
    {
        $admin = $this->makeUser('Admin', [], $this->warehouseA, true);
        $foreignProduct = $this->makeProduct('ADMIN-SKU', $this->warehouseB);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/products/'.$foreignProduct->id)
            ->assertOk()
            ->assertJsonPath('id', $foreignProduct->id);
    }

    private function makeWarehouse(string $code): Warehouse
    {
        $warehouse = new Warehouse(['name' => $code, 'code' => $code]);
        $warehouse->id = (string) Str::uuid();
        $warehouse->save();

        return $warehouse;
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

    private function makeRole(string $name, array $permissions): Roles
    {
        $role = Roles::create(['name' => $name, 'description' => $name]);
        if ($permissions !== []) {
            $permissionIds = [];
            foreach ($permissions as $permissionName) {
                $permissionIds[] = Permission::firstOrCreate(['name' => $permissionName])->id;
            }
            $role->permissions()->sync($permissionIds);
        }

        return $role;
    }

    private function makeUser(
        string $roleName,
        array $permissions,
        Warehouse $warehouse,
        bool $accessAllWarehouses = false
    ): User {
        $role = $this->makeRole($roleName, $permissions);

        return User::create([
            'name' => $roleName,
            'email' => Str::slug($roleName).'-'.Str::uuid().'@example.test',
            'password' => 'test-password',
            'role_id' => $role->id,
            'warehouse_id' => $warehouse->id,
            'access_all_warehouses' => $accessAllWarehouses,
            'status' => 'active',
        ]);
    }
}
