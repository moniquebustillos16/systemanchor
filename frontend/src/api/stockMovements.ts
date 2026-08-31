import api from "./axios";
import { extractArray, extractData } from "./types";

export async function getStockMovements(params: Record<string, unknown> = {}) {
  const { data } = await api.get("/stock-movements", { params });
  return data;
}

export async function createStockMovement(payload: Record<string, unknown>) {
  const { data } = await api.post("/stock-movements", payload);
  return extractData(data) ?? data;
}

/** Product options for movement forms — shared key: stock-movements.products */
export async function getProductOptions() {
  const { data } = await api.get("/inventories", {
    params: { per_page: 200, paginate: false },
  });
  return data;
}

export function extractProductOptions(json: unknown): {
  id: string;
  sku: string;
  name: string;
  qty?: number | string;
  warehouse_id?: string | null;
  warehouse?: { id: string; code: string } | null;
}[] {
  return extractArray<Record<string, unknown>>(json)
    .map((p) => ({
      id: String(p.id ?? ""),
      sku: String(p.sku ?? ""),
      name: String(p.name ?? ""),
      qty: p.qty as number | string | undefined,
      warehouse_id: p.warehouse_id != null ? String(p.warehouse_id) : null,
      warehouse: (p.warehouse as { id: string; code: string } | null) ?? null,
    }))
    .filter((p) => p.id);
}