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
*/
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    // Alias so clients that call /user still work
    Route::get('/user', [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // ---------- Users ----------
    Route::get('/users/stats', [UserController::class, 'stats']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::patch('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // ---------- User ↔ Warehouses ----------
    Route::get('/user-warehouses', [UserWarehouseController::class, 'index']);
    Route::get('/user-warehouses/{id}', [UserWarehouseController::class, 'show']);
    Route::post('/user-warehouses', [UserWarehouseController::class, 'store']);
    Route::delete('/user-warehouses/{id}', [UserWarehouseController::class, 'destroy']);

    Route::get('/users/{user}/warehouses', [UserWarehouseController::class, 'forUser']);
    Route::put('/users/{user}/warehouses', [UserWarehouseController::class, 'sync']);
    Route::delete('/users/{user}/warehouses/{warehouse}', [UserWarehouseController::class, 'detach']);

    // ---------- Roles ----------
    Route::get('/roles/stats', [RolesController::class, 'stats']);
    Route::get('/roles', [RolesController::class, 'index']);
    Route::get('/roles/{id}', [RolesController::class, 'show']);
    Route::post('/roles', [RolesController::class, 'store']);
    Route::put('/roles/{id}', [RolesController::class, 'update']);
    Route::patch('/roles/{id}', [RolesController::class, 'update']);
    Route::delete('/roles/{id}', [RolesController::class, 'destroy']);

    // ---------- Profile ----------
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::put('/profile/settings', [ProfileController::class, 'updateSettings']);
    Route::patch('/profile/settings', [ProfileController::class, 'updateSettings']);
    Route::post('/profile/image', [ProfileController::class, 'uploadImage']);
    Route::delete('/profile/image', [ProfileController::class, 'deleteImage']);

    // ---------- Permissions ----------
    Route::get('/permissions/stats', [PermissionController::class, 'stats']);
    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::get('/permissions/{id}', [PermissionController::class, 'show']);
    Route::post('/permissions', [PermissionController::class, 'store']);
    Route::put('/permissions/{id}', [PermissionController::class, 'update']);
    Route::patch('/permissions/{id}', [PermissionController::class, 'update']);
    Route::delete('/permissions/{id}', [PermissionController::class, 'destroy']);

    // ---------- Role ↔ Permissions ----------
    Route::get('/role-permissions', [RolePermissionController::class, 'index']);
    Route::post('/role-permissions', [RolePermissionController::class, 'store']);
    Route::delete('/role-permissions', [RolePermissionController::class, 'destroy']);

    // Load permissions for a role
    Route::get('/roles/{role}/permissions', [RolePermissionController::class, 'forRole']);

    // Sync full set (primary + aliases for frontend compatibility)
    Route::put('/roles/{role}/permissions', [RolePermissionController::class, 'sync']);
    Route::post('/roles/{role}/permissions', [RolePermissionController::class, 'sync']);
    Route::put('/roles/{role}/permissions/sync', [RolePermissionController::class, 'sync']);
    Route::post('/roles/{role}/permissions/sync', [RolePermissionController::class, 'sync']);

    // Detach single permission
    Route::delete('/roles/{role}/permissions/{permission}', [RolePermissionController::class, 'detach']);

    // ---------- Suppliers ----------
    Route::get('/suppliers', [SupplierController::class, 'index']);
    Route::get('/suppliers/{id}', [SupplierController::class, 'show']);
    Route::post('/suppliers', [SupplierController::class, 'store']);
    Route::put('/suppliers/{id}', [SupplierController::class, 'update']);
    Route::patch('/suppliers/{id}', [SupplierController::class, 'update']);
    Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy']);

    // ---------- Customers ----------
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{id}', [CustomerController::class, 'update']);
    Route::patch('/customers/{id}', [CustomerController::class, 'update']);
    Route::delete('/customers/{id}', [CustomerController::class, 'destroy']);

    // ---------- Warehouses ----------
    Route::get('/warehouses', [WarehouseController::class, 'index']);
    Route::get('/warehouses/{id}', [WarehouseController::class, 'show']);
    Route::post('/warehouses', [WarehouseController::class, 'store']);
    Route::put('/warehouses/{id}', [WarehouseController::class, 'update']);
    Route::patch('/warehouses/{id}', [WarehouseController::class, 'update']);
    Route::delete('/warehouses/{id}', [WarehouseController::class, 'destroy']);

    // ---------- Cycle Counts ----------
    Route::get('/cycle-counts', [CycleCountController::class, 'index']);
    Route::get('/cycle-counts/stats', [CycleCountController::class, 'stats']);
    Route::get('/cycle-counts/{id}', [CycleCountController::class, 'show']);
    Route::post('/cycle-counts', [CycleCountController::class, 'store']);
    Route::put('/cycle-counts/{id}', [CycleCountController::class, 'update']);
    Route::patch('/cycle-counts/{id}', [CycleCountController::class, 'update']);
    Route::delete('/cycle-counts/{id}', [CycleCountController::class, 'destroy']);

    // ---------- Inventory ----------
    Route::get('/inventories', [InventoryController::class, 'index']);
    Route::get('/inventories/stats', [InventoryController::class, 'stats']);
    Route::get('/inventories/{id}', [InventoryController::class, 'show']);
    Route::post('/inventories', [InventoryController::class, 'store']);
    Route::put('/inventories/{id}', [InventoryController::class, 'update']);
    Route::patch('/inventories/{id}', [InventoryController::class, 'update']);
    Route::delete('/inventories/{id}', [InventoryController::class, 'destroy']);

    // ---------- Stock Movements ----------
    Route::get('/stock-movements', [StockMovementController::class, 'index']);
    Route::get('/stock-movements/{id}', [StockMovementController::class, 'show']);
    Route::post('/stock-movements', [StockMovementController::class, 'store']);
    Route::put('/stock-movements/{id}', [StockMovementController::class, 'update']);
    Route::patch('/stock-movements/{id}', [StockMovementController::class, 'update']);
    Route::delete('/stock-movements/{id}', [StockMovementController::class, 'destroy']);

    // ---------- Purchase Orders ----------
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::get('/purchase-orders/stats', [PurchaseOrderController::class, 'stats']);
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::put('/purchase-orders/{id}', [PurchaseOrderController::class, 'update']);
    Route::patch('/purchase-orders/{id}', [PurchaseOrderController::class, 'update']);
    Route::delete('/purchase-orders/{id}', [PurchaseOrderController::class, 'destroy']);

    // ---------- Sales Orders ----------
    Route::get('/sales-orders', [SalesOrderController::class, 'index']);
    Route::get('/sales-orders/stats', [SalesOrderController::class, 'stats']);
    Route::get('/sales-orders/{id}', [SalesOrderController::class, 'show']);
    Route::post('/sales-orders', [SalesOrderController::class, 'store']);
    Route::put('/sales-orders/{id}', [SalesOrderController::class, 'update']);
    Route::patch('/sales-orders/{id}', [SalesOrderController::class, 'update']);
    Route::delete('/sales-orders/{id}', [SalesOrderController::class, 'destroy']);

    // ---------- Goods Receipts ----------
    Route::get('/goods-receipts', [GoodsReceiptController::class, 'index']);
    Route::get('/goods-receipts/stats', [GoodsReceiptController::class, 'stats']);
    Route::get('/goods-receipts/{id}', [GoodsReceiptController::class, 'show']);
    Route::post('/goods-receipts', [GoodsReceiptController::class, 'store']);
    Route::post('/goods-receipts/{id}/complete', [GoodsReceiptController::class, 'complete']);
    Route::put('/goods-receipts/{id}', [GoodsReceiptController::class, 'update']);
    Route::patch('/goods-receipts/{id}', [GoodsReceiptController::class, 'update']);
    Route::delete('/goods-receipts/{id}', [GoodsReceiptController::class, 'destroy']);

    // ---------- Shipments ----------
    Route::get('/shipments', [ShipmentController::class, 'index']);
    Route::get('/shipments/stats', [ShipmentController::class, 'stats']);
    Route::get('/shipments/{id}', [ShipmentController::class, 'show']);
    Route::post('/shipments', [ShipmentController::class, 'store']);
    Route::post('/shipments/{id}/deliver', [ShipmentController::class, 'deliver']);
    Route::put('/shipments/{id}', [ShipmentController::class, 'update']);
    Route::patch('/shipments/{id}', [ShipmentController::class, 'update']);
    Route::delete('/shipments/{id}', [ShipmentController::class, 'destroy']);

    // ---------- Returns (RMA) ----------
    Route::get('/returns', [ReturnController::class, 'index']);
    Route::get('/returns/stats', [ReturnController::class, 'stats']);
    Route::get('/returns/{id}', [ReturnController::class, 'show']);
    Route::post('/returns', [ReturnController::class, 'store']);
    Route::put('/returns/{id}', [ReturnController::class, 'update']);
    Route::patch('/returns/{id}', [ReturnController::class, 'update']);
    Route::post('/returns/{id}/complete', [ReturnController::class, 'complete']);
    Route::delete('/returns/{id}', [ReturnController::class, 'destroy']);

    // ---------- Product Images ----------
    Route::get('/product-images', [ProductImageController::class, 'index']);
    Route::post('/product-images', [ProductImageController::class, 'store']);
    Route::get('/product-images/{id}', [ProductImageController::class, 'show']);
    Route::put('/product-images/{id}', [ProductImageController::class, 'update']);
    Route::patch('/product-images/{id}', [ProductImageController::class, 'update']);
    Route::delete('/product-images/{id}', [ProductImageController::class, 'destroy']);
    Route::post('/product-images/{id}/primary', [ProductImageController::class, 'setPrimary']);
    Route::post('/product-images/reorder', [ProductImageController::class, 'reorder']);

    // ---------- Company Settings ----------
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::patch('/settings', [SettingsController::class, 'update']);

    // ---------- Products & Categories ----------
    Route::apiResource('products', ProductController::class);
    Route::apiResource('categories', CategoryController::class);

    // ---------- Product Transactions ----------
    Route::get('/product-transactions', [ProductTransactionController::class, 'index']);
    Route::get('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'show']);
    Route::post('/product-transactions', [ProductTransactionController::class, 'store']);
    Route::put('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'update']);
    Route::patch('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'update']);
    Route::delete('/product-transactions/{productTransaction}', [ProductTransactionController::class, 'destroy']);

    // ---------- Notifications ----------
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::get('/notifications/{id}', [NotificationController::class, 'show']);
    Route::post('/notifications', [NotificationController::class, 'store']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    Route::delete('/notifications', [NotificationController::class, 'destroyAll']);
});
