import api from "./axios";

export async function getWarehouses(params: Record<string, unknown> = {}) {
  const { data } = await api.get("/warehouses", {
    params: {
      per_page: params.per_page ?? 200,
      all: params.all ?? 1,
      ...params,
    },
  });
  return data;
}