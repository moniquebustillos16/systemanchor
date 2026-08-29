import api from "./axios";
import {
  extractArray,
  extractData,
  toPaginated,
  type ListParams,
  type Paginated,
} from "./types";

export type InventoryListParams = ListParams & {
  category_id?: string;
  warehouse_id?: string;
  supplier_id?: string;
  status?: string;
  with_images?: boolean;
  paginate?: boolean;
  
  all?: boolean;
};

export type InventoryStats = {
  total_products: number;
  low_stock: number;
  out_of_stock: number;
  inventory_value: number;
  active_skus?: number;
};

/** GET /inventories/stats */
export async function getInventoryStats(): Promise<InventoryStats> {
  const { data } = await api.get("/inventories/stats");
  return data as InventoryStats;
}

/** GET /inventories — paginated product/inventory list */
export async function getInventoryList(
  params: InventoryListParams = {}
): Promise<Paginated<Record<string, unknown>>> {
  const { data } = await api.get("/inventories", {
    params: {
      paginate: true,
      per_page: params.per_page ?? 15,
      page: params.page ?? 1,
      ...params,
    },
  });
  return toPaginated<Record<string, unknown>>(data);
}

/** GET /inventories/{id} */
export async function getInventoryItem(id: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/inventories/${id}`);
  return (extractData(data) ?? data) as Record<string, unknown>;
}

/** POST /inventories (fallback POST /products handled by caller if needed) */
export async function createInventory(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await api.post("/inventories", payload);
  return (extractData(data) ?? data) as Record<string, unknown>;
}

/** PUT /inventories/{id} */
export async function updateInventory(
  id: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await api.put(`/inventories/${id}`, payload);
  return (extractData(data) ?? data) as Record<string, unknown>;
}

/** DELETE /inventories/{id} */
export async function deleteInventory(id: string): Promise<void> {
  await api.delete(`/inventories/${id}`);
}

/** GET /categories — filter meta */
export async function getCategories(): Promise<{ id: string; name: string }[]> {
  const { data } = await api.get("/categories");
  return extractArray<{ id: string; name: string }>(data).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
  }));
}