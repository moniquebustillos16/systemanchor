import { queryClient, queryKeys } from "./queryClient";

/** All dashboard ranges (dashboard is a key factory, not an array). */
async function invalidateDashboard() {
  await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export async function invalidateInventory() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    // Product options used by Stock Movements forms
    queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.products }),
    invalidateDashboard(),
  ]);
}

export async function invalidateStockMovements() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidatePurchaseOrders() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidateSalesOrders() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidateWarehouses() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidateGoodsReceipts() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.goodsReceipts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidateShipments() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.shipments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    invalidateDashboard(),
  ]);
}

export async function invalidateReturns() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.returns.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    invalidateDashboard(),
  ]);
}

// ── Partners ────────────────────────────────────────────────

/** After create / update / delete customer */
export async function invalidateCustomers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
    // Sales orders may show customer names / filters
    queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all }),
    invalidateDashboard(),
  ]);
}

/** After create / update / delete supplier */
export async function invalidateSuppliers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
    // Purchase orders / meta depend on suppliers
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }),
    invalidateDashboard(),
  ]);
}

// ── System: Users ───────────────────────────────────────────

/** After create / update / delete user (or warehouse access change) */
export async function invalidateUsers() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  ]);
}
/** After create / update / delete role, or permission sync */
export async function invalidateRoles() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all }),
    // Users page role filter / form may show role names
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    // Current user's effective permissions may have changed
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  ]);
}

/** After login / logout / token change — refresh auth user cache */
export async function invalidateCurrentUser() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.me });
}

export function clearCurrentUser() {
  queryClient.removeQueries({ queryKey: queryKeys.me });
}

export async function invalidateProfile() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
}