import { queryClient, queryKeys } from "./queryClient";
import api from "../api/axios";

export function fetchCachedLookup(
  path: string,
  queryKey: readonly unknown[],
  params: Record<string, unknown>
): Promise<unknown> {
  return queryClient.fetchQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(path, { params });
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export const lookupKeys = {
  purchaseOrders: queryKeys.purchaseOrders.list({ per_page: 200, all: 1 }),
  salesOrders: queryKeys.salesOrders.list({ per_page: 200, all: 1 }),
  products: queryKeys.inventory.list({ per_page: 200, paginate: false }),
  suppliers: queryKeys.suppliers.list({ page: 1, per_page: 200 }),
  users: queryKeys.users.list({ page: 1, per_page: 100 }),
  warehouses: queryKeys.warehouses.list({ per_page: 200, all: 1 }),
};
