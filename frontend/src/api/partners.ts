import api from "./axios";

export type PartnerListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  sort?: string;
  dir?: string;
};

export async function getCustomers(params: PartnerListParams = {}) {
  const { data } = await api.get("/customers", { params });
  return data;
}

export async function createCustomer(payload: Record<string, unknown>) {
  const { data } = await api.post("/customers", payload);
  return data;
}

export async function updateCustomer(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(id: string) {
  const { data } = await api.delete(`/customers/${id}`);
  return data;
}

export async function getSuppliers(params: PartnerListParams = {}) {
  const { data } = await api.get("/suppliers", { params });
  return data;
}

export async function createSupplier(payload: Record<string, unknown>) {
  const { data } = await api.post("/suppliers", payload);
  return data;
}

export async function updateSupplier(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/suppliers/${id}`, payload);
  return data;
}

export async function deleteSupplier(id: string) {
  const { data } = await api.delete(`/suppliers/${id}`);
  return data;
}