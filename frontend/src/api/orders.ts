import api from "./axios";

/** Shared list query params for order-related endpoints. */
export type OrderListParams = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════
   Purchase orders
═══════════════════════════════════════════════════════════ */

export async function getPurchaseOrders(params: OrderListParams = {}) {
  const { data } = await api.get("/purchase-orders", { params });
  return data;
}

export async function getPurchaseOrderStats() {
  const { data } = await api.get("/purchase-orders/stats");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   Sales orders
═══════════════════════════════════════════════════════════ */

export async function getSalesOrders(params: OrderListParams = {}) {
  const { data } = await api.get("/sales-orders", { params });
  return data;
}

export async function getSalesOrderStats() {
  const { data } = await api.get("/sales-orders/stats");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   Goods receipts (Receiving)
═══════════════════════════════════════════════════════════ */

export async function getGoodsReceipts(params: OrderListParams = {}) {
  const { data } = await api.get("/goods-receipts", { params });
  return data;
}

export async function getGoodsReceiptStats() {
  const { data } = await api.get("/goods-receipts/stats");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   Shipments
═══════════════════════════════════════════════════════════ */

export async function getShipments(params: OrderListParams = {}) {
  const { data } = await api.get("/shipments", { params });
  return data;
}

export async function getShipmentStats() {
  const { data } = await api.get("/shipments/stats");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   Returns (RMA)
═══════════════════════════════════════════════════════════ */

export async function getReturns(params: OrderListParams = {}) {
  const { data } = await api.get("/returns", { params });
  return data;
}

export async function getReturnStats() {
  const { data } = await api.get("/returns/stats");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   Form lookups (dropdown options)
   Same params Inventory / Shipping / Receiving use for speed.
═══════════════════════════════════════════════════════════ */

const LOOKUP_PARAMS = { per_page: 200, all: 1 } as const;

/** Warehouses for create-form dropdowns */
export async function getWarehousesLookup(
  params: OrderListParams = LOOKUP_PARAMS
) {
  const { data } = await api.get("/warehouses", { params });
  return data;
}

/** Suppliers for receiving / PO forms */
export async function getSuppliersLookup(
  params: OrderListParams = LOOKUP_PARAMS
) {
  const { data } = await api.get("/suppliers", { params });
  return data;
}

/** Products for shipping / returns line items */
export async function getProductsLookup(
  params: OrderListParams = { per_page: 200 }
) {
  const { data } = await api.get("/products", { params });
  return data;
}

/** Users (receivers, etc.) */
export async function getUsersLookup(
  params: OrderListParams = { per_page: 100 }
) {
  const { data } = await api.get("/users", { params });
  return data;
}

/**
 * Parallel load for Shipping create modal.
 * Prefer this over three separate calls in the page.
 */
export async function getShippingFormLookups() {
  const [salesOrders, products, warehouses] = await Promise.all([
    getSalesOrders(LOOKUP_PARAMS),
    getProductsLookup(),
    getWarehousesLookup(),
  ]);
  return { salesOrders, products, warehouses };
}

/**
 * Parallel load for Receiving create modal.
 */
export async function getReceivingFormLookups() {
  const [purchaseOrders, suppliers, users, warehouses] = await Promise.all([
    getPurchaseOrders(LOOKUP_PARAMS),
    getSuppliersLookup(),
    getUsersLookup(),
    getWarehousesLookup(),
  ]);
  return { purchaseOrders, suppliers, users, warehouses };
}

/**
 * Parallel load for Returns create modal.
 */
export async function getReturnsFormLookups() {
  const [salesOrders, products, warehouses] = await Promise.all([
    getSalesOrders(LOOKUP_PARAMS),
    getProductsLookup(),
    getWarehousesLookup(),
  ]);
  return { salesOrders, products, warehouses };
}