import api from "./axios";

export async function getStockMovements(params: Record<string, unknown> = {}) {
  const { data } = await api.get("/stock-movements", { params });
  return data;
}

export async function createStockMovement(payload: Record<string, unknown>) {
  const { data } = await api.post("/stock-movements", payload);
  return data;
}

export async function getProductOptions() {
  const { data } = await api.get("/inventories", {
    params: { per_page: 200, paginate: false },
  });
  return data;
}