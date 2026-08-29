<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserWarehouseController;
use App\Http\Controllers\Api\RolesController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\SalesOrderController;
use App\Http\Controllers\Api\GoodsReceiptController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\ReturnController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\ProductImageController;
use App\Http\Controllers\Api\CycleCountController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ProductTransactionController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\RolePermissionController;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/
Route::post('/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Protected routes (auth:sanctum)
|--------------------------------------------------------------------------
| Every route below requires a valid logged-in user (auth:sanctum).
| Routes that touch shared/company data ALSO require a specific
| ->middleware('permission:module.action') so that only roles granted
| that permission can use them. Admins bypass all permission checks
| automatically (see PermissionMiddleware).
|
| Routes left WITHOUT a permission lock are self-service: a user
| managing their own profile, their own sessions, their own
| notifications. Those only need to know you're logged in.
*/
Route::middleware('auth:sanctum')->group(function () {

    // ---------- Auth ----------
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    // Alias so clients that call /user still work
    Route::get('/user', [AuthController::class, 'me']);

    // ---------- Dashboard ----------
    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->middleware('permission:dashboard.view');

    // ---------- Users ----------
    Route::get('/users/stats', [UserController::class, 'stats'])
        ->middleware('permission:users.view');
    Route::get('/users', [UserController::class, 'index'])
        ->middleware('permission:users.view');
    Route::get('/users/{id}', [UserController::class, 'show'])
        ->middleware('permission:users.view');
    Route::post('/users', [UserController::class, 'store'])
        ->middleware('permission:users.create');
    Route::put('/users/{id}', [UserController::class, 'update'])
        ->middleware('permission:users.update');
    Route::patch('/users/{id}', [UserController::class, 'update'])
        ->middleware('permission:users.update');
    Route::delete('/users/{id}', [UserController::class, 'destroy'])
        ->middleware('permission:users.delete');

    // ---------- User ↔ Warehouses ----------
    Route::get('/user-warehouses', [UserWarehouseController::class, 'index'])
        ->middleware('permission:users.view');
    Route::get('/user-warehouses/{id}', [UserWarehouseController::class, 'show'])
        ->middleware('permission:users.view');
    Route::post('/user-warehouses', [UserWarehouseController::class, 'store'])
        ->middleware('permission:users.update');
    Route::delete('/user-warehouses/{id}', [UserWarehouseController::class, 'destroy'])
        ->middleware('permission:users.update');

    Route::get('/users/{user}/warehouses', [UserWarehouseController::class, 'forUser'])
        ->middleware('permission:users.view');
    Route::put('/users/{user}/warehouses', [UserWarehouseController::class, 'sync'])
        ->middleware('permission:users.update');
    Route::delete('/users/{user}/warehouses/{warehouse}', [UserWarehouseController::class, 'detach'])
        ->middleware('permission:users.update');

    // ---------- Roles ----------
    Route::get('/roles/stats', [RolesController::class, 'stats'])
        ->middleware('permission:roles.view');
    Route::get('/roles', [RolesController::class, 'index'])
        ->middleware('permission:roles.view');
    Route::get('/roles/{id}', [RolesController::class, 'show'])
        ->middleware('permission:roles.view');
    Route::post('/roles', [RolesController::class, 'store'])
        ->middleware('permission:roles.create');
    Route::put('/roles/{id}', [RolesController::class, 'update'])
        ->middleware('permission:roles.update');
    Route::patch('/roles/{id}', [RolesController::class, 'update'])
        ->middleware('permission:roles.update');
    Route::delete('/roles/{id}', [RolesController::class, 'destroy'])
        ->middleware('permission:roles.delete');

    // ---------- Profile (self-service — no permission lock) ----------
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::put('/profile/settings', [ProfileController::class, 'updateSettings']);
    Route::patch('/profile/settings', [ProfileController::class, 'updateSettings']);
    Route::post('/profile/image', [ProfileController::class, 'uploadImage']);
    Route::delete('/profile/image', [ProfileController::class, 'deleteImage']);
    Route::post('/profile/avatar', [ProfileController::class, 'uploadImage']);
    Route::delete('/profile/avatar', [ProfileController::class, 'deleteImage']);

    Route::get('/profile/sessions', [ProfileController::class, 'sessions']);
    Route::delete('/profile/sessions/{id}', [ProfileController::class, 'revokeSession']);
    Route::delete('/profile/sessions', [ProfileController::class, 'revokeOtherSessions']);

    Route::get('/profile/activity', [ProfileController::class, 'activity']);

    Route::get('/profile/2fa', [ProfileController::class, 'twoFactorStatus']);
    Route::post('/profile/2fa', [ProfileController::class, 'enableTwoFactor']);
    Route::post('/profile/2fa/enable', [ProfileController::class, 'enableTwoFactor']);
    Route::post('/profile/2fa/disable', [ProfileController::class, 'disableTwoFactor']);
    Route::delete('/profile/2fa', [ProfileController::class, 'disableTwoFactor']);

    Route::get('/sessions', [ProfileController::class, 'sessions']);
    Route::delete('/sessions/{id}', [ProfileController::class, 'revokeSession']);
    Route::delete('/sessions', [ProfileController::class, 'revokeOtherSessions']);

    // ---------- Permissions ----------
    Route::get('/permissions/stats', [PermissionController::class, 'stats'])
        ->middleware('permission:roles.view');
    Route::get('/permissions', [PermissionController::class, 'index'])
        ->middleware('permission:roles.view');
    Route::get('/permissions/{id}', [PermissionController::class, 'show'])
        ->middleware('permission:roles.view');
    Route::post('/permissions', [PermissionController::class, 'store'])
        ->middleware('permission:roles.create');
    Route::put('/permissions/{id}', [PermissionController::class, 'update'])
        ->middleware('permission:roles.update');
    Route::patch('/permissions/{id}', [PermissionController::class, 'update'])
        ->middleware('permission:roles.update');
    Route::delete('/permissions/{id}', [PermissionController::class, 'destroy'])
        ->middleware('permission:roles.delete');

    // ---------- Role ↔ Permissions ----------
    Route::get('/role-permissions', [RolePermissionController::class, 'index'])
        ->middleware('permission:roles.view');
    Route::post('/role-permissions', [RolePermissionController::class, 'store'])
        ->middleware('permission:roles.update');
    Route::delete('/role-permissions', [RolePermissionController::class, 'destroy'])
        ->middleware('permission:roles.update');

    // Load permissions for a role
    Route::get('/roles/{role}/permissions', [RolePermissionController::class, 'forRole'])
        ->middleware('permission:roles.view');

    // Sync full set (primary + aliases for frontend compatibility)
    Route::put('/roles/{role}/permissions', [RolePermissionController::class, 'sync'])
        ->middleware('permission:roles.update');
    Route::post('/roles/{role}/permissions', [RolePermissionController::class, 'sync'])
        ->middleware('permission:roles.update');
    Route::put('/roles/{role}/permissions/sync', [RolePermissionController::class, 'sync'])
        ->middleware('permission:roles.update');
    Route::post('/roles/{role}/permissions/sync', [RolePermissionController::class, 'sync'])
        ->middleware('permission:roles.update');

    // Detach single permission
    Route::delete('/roles/{role}/permissions/{permission}', [RolePermissionController::class, 'detach'])
        ->middleware('permission:roles.update');

    // ---------- Suppliers ----------
    Route::get('/suppliers', [SupplierController::class, 'index'])
        ->middleware('permission:suppliers.view');
    Route::get('/suppliers/{id}', [SupplierController::class, 'show'])
        ->middleware('permission:suppliers.view');
    Route::post('/suppliers', [SupplierController::class, 'store'])
        ->middleware('permission:suppliers.create');
    Route::put('/suppliers/{id}', [SupplierController::class, 'update'])
        ->middleware('permission:suppliers.update');
    Route::patch('/suppliers/{id}', [SupplierController::class, 'update'])
        ->middleware('permission:suppliers.update');
    Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy'])
        ->middleware('permission:suppliers.delete');

    // ---------- Customers ----------
    Route::get('/customers', [CustomerController::class, 'index'])
        ->middleware('permission:customers.view');
    Route::get('/customers/{id}', [CustomerController::class, 'show'])
        ->middleware('permission:customers.view');
    Route::post('/customers', [CustomerController::class, 'store'])
        ->middleware('permission:customers.create');
    Route::put('/customers/{id}', [CustomerController::class, 'update'])
        ->middleware('permission:customers.update');
    Route::patch('/customers/{id}', [CustomerController::class, 'update'])
        ->middleware('permission:customers.update');
    Route::delete('/customers/{id}', [CustomerController::class, 'destroy'])
        ->middleware('permission:customers.delete');

    // ---------- Warehouses ----------
    Route::get('/warehouses', [WarehouseController::class, 'index'])
        ->middleware('permission:locations.view');
    Route::get('/warehouses/{id}', [WarehouseController::class, 'show'])
        ->middleware('permission:locations.view');
    Route::post('/warehouses', [WarehouseController::class, 'store'])
        ->middleware('permission:locations.create');
    Route::put('/warehouses/{id}', [WarehouseController::class, 'update'])
        ->middleware('permission:locations.update');
    Route::patch('/warehouses/{id}', [WarehouseController::class, 'update'])
        ->middleware('permission:locations.update');
    Route::delete('/warehouses/{id}', [WarehouseController::class, 'destroy'])
        ->middleware('permission:locations.delete');

    // ---------- Cycle Counts ----------
    Route::get('/cycle-counts', [CycleCountController::class, 'index'])
        ->middleware('permission:cycle_count.view');
    Route::get('/cycle-counts/stats', [CycleCountController::class, 'stats'])
        ->middleware('permission:cycle_count.view');
    Route::get('/cycle-counts/{id}', [CycleCountController::class, 'show'])
        ->middleware('permission:cycle_count.view');
    Route::post('/cycle-counts', [CycleCountController::class, 'store'])
        ->middleware('permission:cycle_count.create');
    Route::put('/cycle-counts/{id}', [CycleCountController::class, 'update'])
        ->middleware('permission:cycle_count.update');
    Route::patch('/cycle-counts/{id}', [CycleCountController::class, 'update'])
        ->middleware('permission:cycle_count.update');
    Route::delete('/cycle-counts/{id}', [CycleCountController::class, 'destroy'])
        ->middleware('permission:cycle_count.delete');

    // ---------- Inventory ----------
    Route::get('/inventories', [InventoryController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('/inventories/stats', [InventoryController::class, 'stats'])
        ->middleware('permission:inventory.view');
    Route::get('/inventories/{id}', [InventoryController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::post('/inventories', [InventoryController::class, 'store'])
        ->middleware('permission:inventory.create');
    Route::put('/inventories/{id}', [InventoryController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::patch('/inventories/{id}', [InventoryController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::delete('/inventories/{id}', [InventoryController::class, 'destroy'])
        ->middleware('permission:inventory.delete');

    // ---------- Stock Movements ----------
    Route::get('/stock-movements', [StockMovementController::class, 'index'])
        ->middleware('permission:stock_movements.view');
    Route::get('/stock-movements/{id}', [StockMovementController::class, 'show'])
        ->middleware('permission:stock_movements.view');
    Route::post('/stock-movements', [StockMovementController::class, 'store'])
        ->middleware('permission:stock_movements.create');
    Route::put('/stock-movements/{id}', [StockMovementController::class, 'update'])
        ->middleware('permission:stock_movements.update');
    Route::patch('/stock-movements/{id}', [StockMovementController::class, 'update'])
        ->middleware('permission:stock_movements.update');
    Route::delete('/stock-movements/{id}', [StockMovementController::class, 'destroy'])
        ->middleware('permission:stock_movements.delete');

    // ---------- Purchase Orders ----------
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])
        ->middleware('permission:purchase_orders.view');
    Route::get('/purchase-orders/stats', [PurchaseOrderController::class, 'stats'])
        ->middleware('permission:purchase_orders.view');
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show'])
        ->middleware('permission:purchase_orders.view');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])
        ->middleware('permission:purchase_orders.create');
    Route::put('/purchase-orders/{id}', [PurchaseOrderController::class, 'update'])
        ->middleware('permission:purchase_orders.update');
    Route::patch('/purchase-orders/{id}', [PurchaseOrderController::class, 'update'])
        ->middleware('permission:purchase_orders.update');
    Route::delete('/purchase-orders/{id}', [PurchaseOrderController::class, 'destroy'])
        ->middleware('permission:purchase_orders.delete');

    // ---------- Sales Orders ----------
    Route::get('/sales-orders', [SalesOrderController::class, 'index'])
        ->middleware('permission:sales_orders.view');
    Route::get('/sales-orders/stats', [SalesOrderController::class, 'stats'])
        ->middleware('permission:sales_orders.view');
    Route::get('/sales-orders/{id}', [SalesOrderController::class, 'show'])
        ->middleware('permission:sales_orders.view');
    Route::post('/sales-orders', [SalesOrderController::class, 'store'])
        ->middleware('permission:sales_orders.create');
    Route::put('/sales-orders/{id}', [SalesOrderController::class, 'update'])
        ->middleware('permission:sales_orders.update');
    Route::patch('/sales-orders/{id}', [SalesOrderController::class, 'update'])
        ->middleware('permission:sales_orders.update');
    Route::delete('/sales-orders/{id}', [SalesOrderController::class, 'destroy'])
        ->middleware('permission:sales_orders.delete');

    // ---------- Goods Receipts ----------
    Route::get('/goods-receipts', [GoodsReceiptController::class, 'index'])
        ->middleware('permission:receiving.view');
    Route::get('/goods-receipts/stats', [GoodsReceiptController::class, 'stats'])
        ->middleware('permission:receiving.view');
    Route::get('/goods-receipts/{id}', [GoodsReceiptController::class, 'show'])
        ->middleware('permission:receiving.view');
    Route::post('/goods-receipts', [GoodsReceiptController::class, 'store'])
        ->middleware('permission:receiving.create');
    Route::post('/goods-receipts/{id}/complete', [GoodsReceiptController::class, 'complete'])
        ->middleware('permission:receiving.update');
    Route::put('/goods-receipts/{id}', [GoodsReceiptController::class, 'update'])
        ->middleware('permission:receiving.update');
    Route::patch('/goods-receipts/{id}', [GoodsReceiptController::class, 'update'])
        ->middleware('permission:receiving.update');
    Route::delete('/goods-receipts/{id}', [GoodsReceiptController::class, 'destroy'])
        ->middleware('permission:receiving.delete');

    // ---------- Shipments ----------
    Route::get('/shipments', [ShipmentController::class, 'index'])
        ->middleware('permission:shipping.view');
    Route::get('/shipments/stats', [ShipmentController::class, 'stats'])
        ->middleware('permission:shipping.view');
    Route::get('/shipments/{id}', [ShipmentController::class, 'show'])
        ->middleware('permission:shipping.view');
    Route::post('/shipments', [ShipmentController::class, 'store'])
        ->middleware('permission:shipping.create');
    Route::post('/shipments/{id}/deliver', [ShipmentController::class, 'deliver'])
        ->middleware('permission:shipping.update');
    Route::put('/shipments/{id}', [ShipmentController::class, 'update'])
        ->middleware('permission:shipping.update');
    Route::patch('/shipments/{id}', [ShipmentController::class, 'update'])
        ->middleware('permission:shipping.update');
    Route::delete('/shipments/{id}', [ShipmentController::class, 'destroy'])
        ->middleware('permission:shipping.delete');

    // ---------- Returns (RMA) ----------
    Route::get('/returns', [ReturnController::class, 'index'])
        ->middleware('permission:returns.view');
    Route::get('/returns/stats', [ReturnController::class, 'stats'])
        ->middleware('permission:returns.view');
    Route::get('/returns/{id}', [ReturnController::class, 'show'])
        ->middleware('permission:returns.view');
    Route::post('/returns', [ReturnController::class, 'store'])
        ->middleware('permission:returns.create');
    Route::put('/returns/{id}', [ReturnController::class, 'update'])
        ->middleware('permission:returns.update');
    Route::patch('/returns/{id}', [ReturnController::class, 'update'])
        ->middleware('permission:returns.update');
    Route::post('/returns/{id}/complete', [ReturnController::class, 'complete'])
        ->middleware('permission:returns.update');
    Route::delete('/returns/{id}', [ReturnController::class, 'destroy'])
        ->middleware('permission:returns.delete');

    // ---------- Product Images ----------
    Route::get('/product-images', [ProductImageController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::post('/product-images', [ProductImageController::class, 'store'])
        ->middleware('permission:inventory.update');
    Route::get('/product-images/{id}', [ProductImageController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::put('/product-images/{id}', [ProductImageController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::patch('/product-images/{id}', [ProductImageController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::delete('/product-images/{id}', [ProductImageController::class, 'destroy'])
        ->middleware('permission:inventory.update');
    Route::post('/product-images/{id}/primary', [ProductImageController::class, 'setPrimary'])
        ->middleware('permission:inventory.update');
    Route::post('/product-images/reorder', [ProductImageController::class, 'reorder'])
        ->middleware('permission:inventory.update');

    // ---------- Company Settings (Admin-only in practice) ----------
    Route::get('/settings', [SettingsController::class, 'show'])
        ->middleware('permission:settings.view');
    Route::put('/settings', [SettingsController::class, 'update'])
        ->middleware('permission:settings.update');
    Route::patch('/settings', [SettingsController::class, 'update'])
        ->middleware('permission:settings.update');

    // ---------- Products ----------
    // (Split out from apiResource so each verb gets its own permission.)
    Route::get('/products', [ProductController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('/products/{product}', [ProductController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::post('/products', [ProductController::class, 'store'])
        ->middleware('permission:inventory.create');
    Route::put('/products/{product}', [ProductController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::patch('/products/{product}', [ProductController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])
        ->middleware('permission:inventory.delete');

    // ---------- Categories ----------
    Route::get('/categories', [CategoryController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('/categories/{category}', [CategoryController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::post('/categories', [CategoryController::class, 'store'])
        ->middleware('permission:inventory.create');
    Route::put('/categories/{category}', [CategoryController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::patch('/categories/{category}', [CategoryController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])
        ->middleware('permission:inventory.delete');

    // ---------- Product Transactions ----------
    Route::get('/product-transactions', [ProductTransactionController::class, 'index'])
        ->middleware('permission:inventory.view');
    Route::get('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'show'])
        ->middleware('permission:inventory.view');
    Route::post('/product-transactions', [ProductTransactionController::class, 'store'])
        ->middleware('permission:inventory.create');
    Route::put('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::patch('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'update'])
        ->middleware('permission:inventory.update');
    Route::delete('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'destroy'])
        ->middleware('permission:inventory.delete');

    // ---------- Notifications (self-service — no permission lock) ----------
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::get('/notifications/{id}', [NotificationController::class, 'show']);
    Route::post('/notifications', [NotificationController::class, 'store']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    Route::delete('/notifications', [NotificationController::class, 'destroyAll']);
});