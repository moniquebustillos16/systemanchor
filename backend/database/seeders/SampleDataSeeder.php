<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CycleCount;
use App\Models\Customer;
use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Permission;
use App\Models\ReturnModel;
use App\Models\Roles;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\UserWarehouse;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class SampleDataSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            ['code' => 'DEMO-WH-01', 'name' => 'Demo Central Warehouse', 'location' => 'Manila', 'manager' => 'Jordan Reyes', 'capacity' => 12000, 'utilized' => 64, 'zones' => 4, 'bins' => 48],
            ['code' => 'DEMO-WH-02', 'name' => 'Demo North Distribution', 'location' => 'Quezon City', 'manager' => 'Alex Mendoza', 'capacity' => 8500, 'utilized' => 48, 'zones' => 3, 'bins' => 32],
            ['code' => 'DEMO-WH-03', 'name' => 'Demo Cebu Hub', 'location' => 'Cebu City', 'manager' => 'Samira Cruz', 'capacity' => 9200, 'utilized' => 71, 'zones' => 4, 'bins' => 40],
            ['code' => 'DEMO-WH-04', 'name' => 'Demo Davao Depot', 'location' => 'Davao City', 'manager' => 'Rafael Lim', 'capacity' => 7600, 'utilized' => 39, 'zones' => 3, 'bins' => 28],
            ['code' => 'DEMO-WH-05', 'name' => 'Demo Iloilo Store', 'location' => 'Iloilo City', 'manager' => 'Casey Flores', 'capacity' => 6100, 'utilized' => 55, 'zones' => 2, 'bins' => 24],
        ];

        $warehouses = [];
        foreach ($locations as $location) {
            $warehouses[] = Warehouse::firstOrCreate(
                ['code' => $location['code']],
                ['id' => (string) Str::uuid()] + $location + ['status' => 'active']
            );
        }
        $warehouse = $warehouses[0];

        $roleDefinitions = [
            'Admin' => ['description' => 'Full system access', 'permissions' => Permission::pluck('name')->all()],
            'Warehouse Manager' => ['description' => 'Manages warehouse operations and staff', 'permissions' => ['warehouses.view', 'warehouses.create', 'warehouses.update', 'inventory.view', 'inventory.update', 'stock.view', 'stock.transfer', 'users.view']],
            'Inventory Manager' => ['description' => 'Manages products, stock, and inventory accuracy', 'permissions' => ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete', 'stock.view', 'stock.in', 'stock.out', 'stock.transfer', 'stock.adjust', 'reports.view']],
            'Procurement Officer' => ['description' => 'Manages purchasing and replenishment', 'permissions' => ['purchase_orders.view', 'purchase_orders.create', 'purchase_orders.update', 'inventory.view', 'warehouses.view']],
            'Sales Manager' => ['description' => 'Oversees customer orders and fulfillment', 'permissions' => ['orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.cancel', 'inventory.view', 'warehouses.view', 'reports.view']],
            'Receiving Clerk' => ['description' => 'Records inbound goods and receipts', 'permissions' => ['purchase_orders.view', 'inventory.view', 'stock.view', 'stock.in', 'warehouses.view']],
            'Shipping Clerk' => ['description' => 'Prepares outbound orders and shipments', 'permissions' => ['orders.view', 'orders.update', 'inventory.view', 'stock.view', 'stock.out', 'warehouses.view']],
            'Cycle Count Auditor' => ['description' => 'Reviews inventory counts and variances', 'permissions' => ['inventory.view', 'stock.view', 'stock.adjust', 'reports.view', 'warehouses.view']],
            'Viewer' => ['description' => 'Read-only access to operational data', 'permissions' => ['inventory.view', 'stock.view', 'orders.view', 'purchase_orders.view', 'warehouses.view', 'reports.view']],
        ];

        $roles = [];
        foreach ($roleDefinitions as $name => $definition) {
            $role = Roles::updateOrCreate(
                ['name' => $name],
                ['description' => $definition['description']]
            );
            $role->permissions()->sync(
                Permission::whereIn(
                    'name',
                    array_unique([
                        ...$definition['permissions'],
                        'dashboard.view',
                        'capacity.view',
                        'suppliers.view',
                        'customers.view',
                    ])
                )->pluck('id')
            );
            $roles[$name] = $role;
        }

        $admin = User::where('email', 'admin@systemanchor.com')->first();
        if ($admin) {
            foreach ($warehouses as $assignedWarehouse) {
                UserWarehouse::firstOrCreate(
                    [
                        'user_id' => $admin->id,
                        'warehouse_id' => $assignedWarehouse->id,
                    ],
                    ['id' => (string) Str::uuid()]
                );
            }

            if ($admin->warehouse_id !== $warehouse->id || !$admin->access_all_warehouses) {
                $admin->update([
                    'warehouse_id' => $warehouse->id,
                    'access_all_warehouses' => true,
                ]);
            }
        }

        $userDefinitions = [
            ['email' => 'test@example.com', 'name' => 'Test User', 'role' => 'Viewer', 'warehouse' => 4, 'job_title' => 'Read-only User'],
            ['email' => 'demo.warehouse@systemanchor.local', 'name' => 'Alex Mendoza', 'role' => 'Warehouse Manager', 'warehouse' => 0, 'job_title' => 'Warehouse Manager'],
            ['email' => 'demo.inventory@systemanchor.local', 'name' => 'Jamie Tan', 'role' => 'Inventory Manager', 'warehouse' => 1, 'job_title' => 'Inventory Manager'],
            ['email' => 'demo.procurement@systemanchor.local', 'name' => 'Morgan Santos', 'role' => 'Procurement Officer', 'warehouse' => 2, 'job_title' => 'Procurement Officer'],
            ['email' => 'demo.sales@systemanchor.local', 'name' => 'Taylor Reyes', 'role' => 'Sales Manager', 'warehouse' => 3, 'job_title' => 'Sales Manager'],
            ['email' => 'demo.receiving@systemanchor.local', 'name' => 'Samira Cruz', 'role' => 'Receiving Clerk', 'warehouse' => 2, 'job_title' => 'Receiving Clerk'],
            ['email' => 'demo.shipping@systemanchor.local', 'name' => 'Rafael Lim', 'role' => 'Shipping Clerk', 'warehouse' => 3, 'job_title' => 'Shipping Clerk'],
            ['email' => 'demo.auditor@systemanchor.local', 'name' => 'Casey Flores', 'role' => 'Cycle Count Auditor', 'warehouse' => 4, 'job_title' => 'Cycle Count Auditor'],
            ['email' => 'demo.viewer@systemanchor.local', 'name' => 'Drew Navarro', 'role' => 'Viewer', 'warehouse' => 1, 'job_title' => 'Operations Viewer'],
        ];

        foreach ($userDefinitions as $definition) {
            $assignedWarehouse = $warehouses[$definition['warehouse']];
            $user = User::firstOrNew(['email' => $definition['email']]);
            $user->fill([
                'name' => $definition['name'],
                'role_id' => $roles[$definition['role']]->id,
                'warehouse_id' => $assignedWarehouse->id,
                'status' => 'active',
                'job_title' => $definition['job_title'],
                'department' => $definition['role'],
            ]);
            if (!$user->exists) {
                $user->password = 'SystemAnchor@123';
            }
            $user->save();

            UserWarehouse::firstOrCreate(
                [
                    'user_id' => $user->id,
                    'warehouse_id' => $assignedWarehouse->id,
                ],
                ['id' => (string) Str::uuid()]
            );
        }

        $hardware = Category::firstOrCreate(['name' => 'Demo Hardware']);
        $safety = Category::firstOrCreate(['name' => 'Demo Safety']);

        $supplier = Supplier::firstOrCreate(
            ['email' => 'demo-supplier@systemanchor.local'],
            [
                'name' => 'Demo Industrial Supply',
                'contact' => 'Morgan Santos',
                'phone' => '+63 2 8000 0101',
                'city' => 'Manila',
                'product_offers' => 'Fasteners, safety equipment',
                'score' => 92,
                'status' => 'active',
            ]
        );

        $suppliers = [$supplier];
        $supplierProfiles = [
            ['name' => 'Northstar Fasteners', 'contact' => 'Ari Dela Cruz', 'email' => 'demo.supplier01@systemanchor.local', 'phone' => '+63 2 8100 0101', 'city' => 'Quezon City', 'product_offers' => 'Fasteners, bolts, anchors', 'score' => 95],
            ['name' => 'Cebu Industrial Goods', 'contact' => 'Bea Lim', 'email' => 'demo.supplier02@systemanchor.local', 'phone' => '+63 32 8100 0102', 'city' => 'Cebu City', 'product_offers' => 'Tools, packaging', 'score' => 91],
            ['name' => 'Davao Safety Works', 'contact' => 'Carlo Ramos', 'email' => 'demo.supplier03@systemanchor.local', 'phone' => '+63 82 8100 0103', 'city' => 'Davao City', 'product_offers' => 'Protective equipment', 'score' => 88],
            ['name' => 'Island Packaging Co.', 'contact' => 'Dina Flores', 'email' => 'demo.supplier04@systemanchor.local', 'phone' => '+63 33 8100 0104', 'city' => 'Iloilo City', 'product_offers' => 'Cartons, labels, wraps', 'score' => 93],
            ['name' => 'Metro Tool and Supply', 'contact' => 'Enzo Bautista', 'email' => 'demo.supplier05@systemanchor.local', 'phone' => '+63 2 8100 0105', 'city' => 'Pasig', 'product_offers' => 'Hand tools, hardware', 'score' => 86],
            ['name' => 'Pacific Workwear', 'contact' => 'Gia Navarro', 'email' => 'demo.supplier06@systemanchor.local', 'phone' => '+63 2 8100 0106', 'city' => 'Makati', 'product_offers' => 'Gloves, uniforms, footwear', 'score' => 90],
            ['name' => 'Summit Storage Systems', 'contact' => 'Hugo Garcia', 'email' => 'demo.supplier07@systemanchor.local', 'phone' => '+63 32 8100 0107', 'city' => 'Mandaue', 'product_offers' => 'Shelving, bins, pallets', 'score' => 87],
            ['name' => 'Greenline Industrial', 'contact' => 'Ina Mercado', 'email' => 'demo.supplier08@systemanchor.local', 'phone' => '+63 2 8100 0108', 'city' => 'Taguig', 'product_offers' => 'Cleaning and maintenance', 'score' => 94],
            ['name' => 'Eastern Components', 'contact' => 'Jules Aquino', 'email' => 'demo.supplier09@systemanchor.local', 'phone' => '+63 82 8100 0109', 'city' => 'Davao City', 'product_offers' => 'Electrical components', 'score' => 84],
            ['name' => 'Central Logistics Materials', 'contact' => 'Kira Villanueva', 'email' => 'demo.supplier10@systemanchor.local', 'phone' => '+63 2 8100 0110', 'city' => 'Manila', 'product_offers' => 'Shipping and warehouse materials', 'score' => 89],
        ];

        foreach ($supplierProfiles as $profile) {
            $suppliers[] = Supplier::updateOrCreate(
                ['email' => $profile['email']],
                $profile + ['status' => 'active']
            );
        }

        $customer = Customer::firstOrCreate(
            ['email' => 'demo-customer@systemanchor.local'],
            [
                'name' => 'Demo Construction Group',
                'phone' => '+63 2 8000 0202',
            ]
        );

        $customers = [$customer];
        $customerProfiles = [
            ['name' => 'Apex Build Corporation', 'contact' => 'Lara Santos', 'email' => 'demo.customer01@systemanchor.local', 'phone' => '+63 2 8200 0201', 'city' => 'Makati'],
            ['name' => 'Cebu Pacific Contractors', 'contact' => 'Marco Yu', 'email' => 'demo.customer02@systemanchor.local', 'phone' => '+63 32 8200 0202', 'city' => 'Cebu City'],
            ['name' => 'Davao Home Projects', 'contact' => 'Nina Garcia', 'email' => 'demo.customer03@systemanchor.local', 'phone' => '+63 82 8200 0203', 'city' => 'Davao City'],
            ['name' => 'Iloilo Trade Depot', 'contact' => 'Omar Reyes', 'email' => 'demo.customer04@systemanchor.local', 'phone' => '+63 33 8200 0204', 'city' => 'Iloilo City'],
            ['name' => 'Metro Facilities Group', 'contact' => 'Pia Mendoza', 'email' => 'demo.customer05@systemanchor.local', 'phone' => '+63 2 8200 0205', 'city' => 'Quezon City'],
            ['name' => 'Harborview Engineering', 'contact' => 'Quinn Dizon', 'email' => 'demo.customer06@systemanchor.local', 'phone' => '+63 2 8200 0206', 'city' => 'Pasay'],
            ['name' => 'Greenfield Property Services', 'contact' => 'Rina Lopez', 'email' => 'demo.customer07@systemanchor.local', 'phone' => '+63 2 8200 0207', 'city' => 'Taguig'],
            ['name' => 'Summit Retail Fixtures', 'contact' => 'Sean Cruz', 'email' => 'demo.customer08@systemanchor.local', 'phone' => '+63 32 8200 0208', 'city' => 'Mandaue'],
            ['name' => 'Eastern Visayas Supply', 'contact' => 'Tess Navarro', 'email' => 'demo.customer09@systemanchor.local', 'phone' => '+63 53 8200 0209', 'city' => 'Tacloban'],
            ['name' => 'National Works Partnership', 'contact' => 'Uma Castillo', 'email' => 'demo.customer10@systemanchor.local', 'phone' => '+63 2 8200 0210', 'city' => 'Manila'],
        ];

        foreach ($customerProfiles as $profile) {
            $customers[] = Customer::updateOrCreate(
                ['email' => $profile['email']],
                $profile
            );
        }

        $products = [
            Product::updateOrCreate(
                ['sku' => 'DEMO-1001'],
                [
                    'name' => 'Steel Fasteners',
                    'category_id' => $hardware->id,
                    'warehouse_id' => $warehouse->id,
                    'supplier_id' => $supplier->id,
                    'qty' => 120,
                    'min_stock' => 30,
                    'max_stock' => 300,
                    'price' => 2.75,
                    'status' => 'active',
                ]
            ),
            Product::updateOrCreate(
                ['sku' => 'DEMO-1002'],
                [
                    'name' => 'Safety Gloves',
                    'category_id' => $safety->id,
                    'warehouse_id' => $warehouse->id,
                    'supplier_id' => $supplier->id,
                    'qty' => 14,
                    'min_stock' => 20,
                    'max_stock' => 160,
                    'price' => 8.50,
                    'status' => 'active',
                ]
            ),
            Product::updateOrCreate(
                ['sku' => 'DEMO-1003'],
                [
                    'name' => 'Shipping Carton',
                    'category_id' => $hardware->id,
                    'warehouse_id' => $warehouse->id,
                    'supplier_id' => $supplier->id,
                    'qty' => 0,
                    'min_stock' => 40,
                    'max_stock' => 500,
                    'price' => 1.20,
                    'status' => 'active',
                ]
            ),
        ];

        $monthlyMovementCounts = [6, 8, 9, 10, 11, 12, 13, 11, 10, 10];
        $monthlyInboundCounts = [4, 5, 5, 6, 7, 7, 8, 7, 6, 6];
        $historicalProducts = [];
        $historicalProductMonths = [];
        $historicalIndex = 0;
        foreach ($monthlyMovementCounts as $monthIndex => $monthlyCount) {
            $month = $monthIndex + 1;
            for ($positionInMonth = 0; $positionInMonth < $monthlyCount; $positionInMonth++) {
                $index = $historicalIndex++;
                $day = min(2 + ($positionInMonth * 2), $month === 10 ? 8 : 28);
                $category = $index % 2 === 0 ? $hardware : $safety;
                $product = Product::firstOrNew([
                    'sku' => sprintf('HIST-2026-%03d', $index + 1),
                ]);
                $product->fill([
                    'name' => sprintf('%s %03d', $index % 2 === 0 ? 'Industrial Fastener' : 'Protective Work Glove', $index + 1),
                    'barcode' => sprintf('290260%06d', $index + 1),
                    'category_id' => $category->id,
                    'warehouse_id' => $warehouses[$monthIndex % count($warehouses)]->id,
                    'supplier_id' => $suppliers[$index % count($suppliers)]->id,
                    'qty' => 20 + (($index * 13) % 220),
                    'min_stock' => 15 + ($index % 25),
                    'max_stock' => 250 + (($index * 17) % 500),
                    'price' => 5 + (($index * 19) % 950) / 10,
                    'status' => 'active',
                ]);
                $product->created_at = Carbon::create(2026, $month, $day, 8, 0);
                $product->save();
                $historicalProducts[] = $product;
                $historicalProductMonths[] = $month;
            }
        }

        PurchaseOrder::updateOrCreate(
            ['po_number' => 'PO-DEMO-0001'],
            [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'order_date' => now()->subDays(3)->toDateString(),
                'expected_date' => now()->addDays(4)->toDateString(),
                'reference' => 'DEMO-REQ-001',
                'product_name' => 'Safety Gloves',
                'items' => 50,
                'total' => 425,
                'status' => 'pending',
            ]
        );

        PurchaseOrder::updateOrCreate(
            ['po_number' => 'PO-DEMO-0002'],
            [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'order_date' => now()->subDays(10)->toDateString(),
                'expected_date' => now()->subDays(2)->toDateString(),
                'reference' => 'DEMO-REQ-002',
                'product_name' => 'Steel Fasteners',
                'items' => 100,
                'total' => 275,
                'status' => 'received',
            ]
        );

        SalesOrder::updateOrCreate(
            ['so_number' => 'SO-DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'warehouse_id' => $warehouse->id,
                'order_date' => now()->subDays(2)->toDateString(),
                'items' => 12,
                'total' => 386.50,
                'status' => 'processing',
            ]
        );

        $monthlyOperations = [
            ['month' => '04', 'receipt_date' => '2026-04-18', 'shipment_date' => '2026-04-20', 'return_date' => '2026-04-22', 'warehouse' => 0],
            ['month' => '05', 'receipt_date' => '2026-05-12', 'shipment_date' => '2026-05-14', 'return_date' => '2026-05-16', 'warehouse' => 1],
            ['month' => '06', 'receipt_date' => '2026-06-21', 'shipment_date' => '2026-06-23', 'return_date' => '2026-06-25', 'warehouse' => 2],
            ['month' => '07', 'receipt_date' => '2026-07-15', 'shipment_date' => '2026-07-17', 'return_date' => '2026-07-19', 'warehouse' => 3],
            ['month' => '08', 'receipt_date' => '2026-08-24', 'shipment_date' => '2026-08-26', 'return_date' => '2026-08-28', 'warehouse' => 4],
            ['month' => '09', 'receipt_date' => '2026-09-09', 'shipment_date' => '2026-09-11', 'return_date' => '2026-09-13', 'warehouse' => 0],
            ['month' => '10', 'receipt_date' => '2026-10-06', 'shipment_date' => '2026-10-07', 'return_date' => '2026-10-08', 'warehouse' => 1],
        ];

        $receiptStatuses = ['completed', 'received', 'completed', 'partial', 'completed', 'processing', 'pending'];
        $shipmentStatuses = ['completed', 'completed', 'shipped', 'completed', 'shipped', 'processing', 'shipped'];
        $returnStatuses = ['completed', 'processing', 'completed', 'pending', 'completed', 'processing', 'pending'];
        $adminId = User::where('email', 'admin@systemanchor.com')->value('id');

        foreach ($monthlyOperations as $index => $operation) {
            $month = $operation['month'];
            $monthWarehouse = $warehouses[$operation['warehouse']];
            $monthSupplier = $suppliers[$index + 1];
            $monthCustomer = $customers[$index + 1];
            $poNumber = "PO-DEMO-2026-{$month}";
            $soNumber = "SO-DEMO-2026-{$month}";
            $expected = 24 + ($index * 4);
            $received = in_array($receiptStatuses[$index], ['completed', 'received'], true)
                ? $expected
                : ($receiptStatuses[$index] === 'partial' ? (int) floor($expected / 2) : 0);

            $monthlyPurchaseOrder = PurchaseOrder::updateOrCreate(
                ['po_number' => $poNumber],
                [
                    'supplier_id' => $monthSupplier->id,
                    'warehouse_id' => $monthWarehouse->id,
                    'order_date' => date('Y-m-d', strtotime($operation['receipt_date'] . ' -14 days')),
                    'expected_date' => $operation['receipt_date'],
                    'reference' => "DEMO-RECEIPT-{$month}",
                    'product_name' => $products[$index % count($products)]->name,
                    'items' => $expected,
                    'total' => $expected * (float) $products[$index % count($products)]->price,
                    'status' => $received === $expected ? 'received' : 'pending',
                ]
            );

            $monthlySalesOrder = SalesOrder::updateOrCreate(
                ['so_number' => $soNumber],
                [
                    'customer_id' => $monthCustomer->id,
                    'warehouse_id' => $monthWarehouse->id,
                    'order_date' => date('Y-m-d', strtotime($operation['shipment_date'] . ' -3 days')),
                    'items' => 3 + $index,
                    'total' => 145 + ($index * 37.5),
                    'status' => $shipmentStatuses[$index] === 'completed' ? 'completed' : 'processing',
                ]
            );

            GoodsReceipt::updateOrCreate(
                ['receipt_number' => "GR-DEMO-2026-{$month}"],
                [
                    'purchase_order_id' => $monthlyPurchaseOrder->id,
                    'supplier_id' => $monthSupplier->id,
                    'warehouse_id' => $monthWarehouse->id,
                    'receiver_id' => $adminId,
                    'date' => $operation['receipt_date'],
                    'expected' => $expected,
                    'received' => $received,
                    'status' => $receiptStatuses[$index],
                ]
            );

            Shipment::updateOrCreate(
                ['shipment_number' => "SH-DEMO-2026-{$month}"],
                [
                    'sales_order_id' => $monthlySalesOrder->id,
                    'warehouse_id' => $monthWarehouse->id,
                    'carrier' => ['LBC', 'J&T Express', 'Ninja Van', 'DHL', 'Lalamove', 'LBC', 'J&T Express'][$index],
                    'tracking' => "DEMO-TRK-2026-{$month}",
                    'packages' => 1 + ($index % 4),
                    'date' => $operation['shipment_date'],
                    'status' => $shipmentStatuses[$index],
                ]
            );

            ReturnModel::updateOrCreate(
                ['return_number' => "RT-DEMO-2026-{$month}"],
                [
                    'sales_order_id' => $monthlySalesOrder->id,
                    'warehouse_id' => $monthWarehouse->id,
                    'reason' => ['Damaged packaging', 'Incorrect item', 'Customer changed order', 'Transit damage', 'Quality inspection', 'Wrong quantity', 'Customer return'][$index],
                    'disposition' => ['Restock', 'Inspect', 'Restock', 'Quarantine', 'Restock', 'Inspect', 'Quarantine'][$index],
                    'items' => 1 + ($index % 3),
                    'date' => $operation['return_date'],
                    'status' => $returnStatuses[$index],
                ]
            );
        }

        $followUpStatuses = ['pending', 'completed', 'draft', 'completed', 'pending', 'completed', 'draft', 'pending', 'completed', 'pending'];
        $monthlyVariances = [0, 2, -3, 1, -5, 4, 0, -2, 6, -1];
        $counters = ['Jamie Tan', 'Casey Flores', 'Alex Mendoza', 'Drew Navarro'];

        for ($monthIndex = 0; $monthIndex < 10; $monthIndex++) {
            $month = $monthIndex + 1;
            $warehouseForMonth = $warehouses[$monthIndex % count($warehouses)];
            $systemQty = 100 + ($monthIndex * 12);

            for ($countIndex = 0; $countIndex < 2; $countIndex++) {
                $status = $countIndex === 0 ? 'completed' : $followUpStatuses[$monthIndex];
                $variance = $monthlyVariances[$monthIndex] + $countIndex;
                $scheduledDate = Carbon::create(2026, $month, $countIndex === 0 ? 15 : 25);
                $counted = $status === 'completed' ? max(0, $systemQty + $variance) : null;
                $actualVariance = $status === 'completed' ? $counted - $systemQty : null;
                $accuracy = $status === 'completed'
                    ? round((1 - abs($actualVariance) / max(1, $systemQty)) * 100, 1)
                    : null;
                $startedAt = $status === 'completed'
                    ? $scheduledDate->copy()->setTime(8, 0)
                    : null;
                $endedAt = $status === 'completed'
                    ? $scheduledDate->copy()->setTime(11, 30)
                    : null;

                CycleCount::updateOrCreate(
                    ['code' => sprintf('CC-DEMO-2026-%02d-%02d', $month, $countIndex + 1)],
                    [
                        'warehouse_id' => $warehouseForMonth->id,
                        'zone' => $countIndex === 0 ? 'A-01' : 'B-02',
                        'scheduled_date' => $scheduledDate->toDateString(),
                        'started_at' => $startedAt,
                        'ended_at' => $endedAt,
                        'counted' => $counted,
                        'system_qty' => $systemQty,
                        'variance' => $actualVariance,
                        'accuracy' => $accuracy,
                        'counter' => $counters[($monthIndex + $countIndex) % count($counters)],
                        'status' => $status,
                        'created_at' => $scheduledDate,
                        'updated_at' => $scheduledDate,
                    ]
                );
            }
        }

        foreach ([
            [
                'movement_number' => 'SM-DEMO-0001',
                'type' => 'IN',
                'product_id' => $products[0]->id,
                'qty' => 40,
                'quantity' => 40,
                'warehouse_id' => $warehouse->id,
                'to_warehouse_id' => $warehouse->id,
                'reference' => 'PO-DEMO-0002',
                'notes' => 'Demo stock receipt',
                'movement_date' => now()->subDay(),
                'status' => 'COMPLETED',
            ],
            [
                'movement_number' => 'SM-DEMO-0002',
                'type' => 'OUT',
                'product_id' => $products[1]->id,
                'qty' => 6,
                'quantity' => 6,
                'warehouse_id' => $warehouse->id,
                'from_warehouse_id' => $warehouse->id,
                'reference' => 'SO-DEMO-0001',
                'notes' => 'Demo order allocation',
                'movement_date' => now(),
                'status' => 'COMPLETED',
            ],
        ] as $movement) {
            StockMovement::unguarded(function () use ($movement): void {
                StockMovement::updateOrCreate(
                    ['movement_number' => $movement['movement_number']],
                    $movement
                );
            });
        }

        $positionsByMonth = array_fill(1, count($monthlyMovementCounts), 0);
        foreach ($historicalProducts as $index => $product) {
            $month = $historicalProductMonths[$index];
            $positionInMonth = $positionsByMonth[$month]++;
            $monthString = sprintf('%02d', $month);
            $day = min(1 + ($positionInMonth * 3), $month === 10 ? 8 : 28);
            $inboundCount = $monthlyInboundCounts[$month - 1];
            $type = $positionInMonth < $inboundCount ? 'IN' : 'OUT';
            $quantity = $type === 'IN'
                ? 80 + ($positionInMonth * 5)
                : 5 + ($positionInMonth - $inboundCount);
            $warehouseId = (string) $product->warehouse_id;
            $movementDate = Carbon::create(2026, $month, $day, 9 + ($positionInMonth % 8), 0);
            $reference = $type === 'IN'
                ? "PO-DEMO-2026-{$monthString}"
                : "SO-DEMO-2026-{$monthString}";
            $movement = [
                'movement_number' => sprintf('SM-HIST-2026-%03d', $index + 1),
                'type' => $type,
                'product_id' => $product->id,
                'qty' => $quantity,
                'quantity' => $quantity,
                'warehouse_id' => $warehouseId,
                'from_warehouse_id' => $type === 'OUT' ? $warehouseId : null,
                'to_warehouse_id' => $type === 'IN' ? $warehouseId : null,
                'performed_by' => $adminId,
                'reference' => $reference,
                'notes' => sprintf(
                    '%s %s units of %s against %s',
                    $type === 'IN' ? 'Received' : 'Dispatched',
                    $quantity,
                    $product->name,
                    $reference
                ),
                'movement_date' => $movementDate,
                'created_at' => $movementDate,
                'updated_at' => $movementDate,
                'status' => 'COMPLETED',
            ];

            StockMovement::unguarded(function () use ($movement): void {
                StockMovement::updateOrCreate(
                    ['movement_number' => $movement['movement_number']],
                    $movement
                );
            });
        }
    }
}