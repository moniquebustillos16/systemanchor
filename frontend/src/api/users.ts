import api from "./axios";

export type UserListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  role_id?: string;
  warehouse_id?: string;
  sort?: string;
  dir?: string;
};

export async function getUsers(params: UserListParams = {}) {
  const { data } = await api.get("/users", { params });
  return data;
}

export async function getUserStats() {
  const { data } = await api.get("/users/stats");
  return data;
}

export async function createUser(payload: Record<string, unknown>) {
  const { data } = await api.post("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete(`/users/${id}`);
  return data;
}

export async function getUserWarehouses(id: string) {
  const { data } = await api.get(`/users/${id}/warehouses`);
  return data;
}

export async function updateUserWarehouses(
  id: string,
  payload: { access_all_warehouses: boolean; warehouse_ids: string[] }
) {
  const { data } = await api.put(`/users/${id}/warehouses`, payload);
  return data;
}

export async function getRoles(params: Record<string, unknown> = {}) {
  const { data } = await api.get("/roles", {
    params: {
      per_page: 200,
      all: 1,
      sort: "name",
      dir: "asc",
      ...params,
    },
  });
  return data;
}