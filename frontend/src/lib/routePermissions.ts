/**
 * Route → view permission aliases (UI only).
 * Align with Sidebar / Dashboard. Laravel is still authoritative.
 */

export const ROUTE_VIEW: Record<string, string[]> = {
  "/dashboard": ["dashboard.view", "home.view", "overview.view"],
  "/products": [
    "inventory.view",
    "inventories.view",
    "products.view",
    "product.view",
    "stock.view",
    "items.view",
  ],
  "/stock-movements": [
    "stock_movements.view",
    "stock-movements.view",
    "movements.view",
    "movement.view",
    "transfers.view",
    "adjustments.view",
  ],
  "/purchase-orders": [
    "purchase_orders.view",
    "purchase-orders.view",
    "purchases.view",
    "po.view",
  ],
  "/sales-orders": [
    "sales_orders.view",
    "sales-orders.view",
    "sales.view",
    "orders.view",
    "so.view",
  ],
  "/goods-receiving": [
    "receiving.view",
    "goods_receipts.view",
    "goods-receipts.view",
    "receipts.view",
    "inbound.view",
  ],
  "/shipping": [
    "shipping.view",
    "shipments.view",
    "outbound.view",
    "dispatch.view",
  ],
  "/returns": ["returns.view", "rma.view"],
  "/warehouses": [
    "warehouses.view",
    "locations.view",
    "bins.view",
    "zones.view",
  ],
  "/capacity": [
    "capacity.view",
    "warehouses.view",
    "locations.view",
    "utilization.view",
  ],
  "/cycle-count": [
    "cycle_counts.view",
    "cycle-counts.view",
    "cycle_count.view",
    "counts.view",
    "stocktake.view",
  ],
  "/suppliers": ["suppliers.view", "supplier.view", "vendors.view"],
  "/customers": ["customers.view", "customer.view", "clients.view"],
  "/reports": ["reports.view", "report.view", "analytics.view"],
  "/analytics": [
    "analytics.view",
    "insights.view",
    "metrics.view",
    "reports.view",
    "dashboard.view",
  ],
  "/users": ["users.view", "user.view", "accounts.view"],
  "/roles": ["roles.view", "role.view", "permissions.view", "access.view"],
  "/company-settings": [
    "settings.view",
    "setting.view",
    "config.view",
    "company.view",
    "system.view",
  ],
};

export const ADMIN_ONLY_PATHS = new Set([
  "/users",
  "/roles",
  "/company-settings",
]);

export const AUTH_ONLY_PATHS = new Set(["/dashboard", "/profile"]);