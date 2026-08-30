import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "../lib/queryClient";
import { getStockMovements, getProductOptions } from "../api/stockMovements";
import api from "../api/axios";


export type UseStockMovementsListOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  type?: string;
  enabled?: boolean;
};

function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  const o = json as { data?: unknown };
  if (Array.isArray(o.data)) return o.data as T[];
  const nested = o.data as { data?: unknown } | undefined;
  if (nested && Array.isArray(nested.data)) return nested.data as T[];
  return [];
}
export async function fetchStockProductOptionsCached(): Promise<unknown> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.stockMovements.products,
    queryFn: async () => {
      try {
        return await getProductOptions();
      } catch {
        const { data } = await api.get("/inventories", {
          params: { per_page: 200, paginate: false },
        });
        return data;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useStockMovementsList(options: UseStockMovementsListOptions = {}) {
  const {
    page = 1,
    perPage = 50,
    search = "",
    type = "",
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      type: type && type !== "all" ? type : undefined,
      paginate: true,
    }),
    [page, perPage, search, type]
  );

  const query = useQuery({
    queryKey: queryKeys.stockMovements.list(params as Record<string, unknown>),
    queryFn: async () => {
      try {
        return await getStockMovements(params);
      } catch {
        const { data } = await api.get("/stock-movements", { params });
        return data;
      }
    },
    enabled,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(query.data),
    [query.data]
  );

  const meta = useMemo(() => {
    const data = query.data as
      | {
          current_page?: number;
          last_page?: number;
          per_page?: number;
          total?: number;
          meta?: {
            current_page?: number;
            last_page?: number;
            per_page?: number;
            total?: number;
          };
        }
      | undefined;

    if (!data || Array.isArray(data)) {
      return {
        current_page: page,
        last_page: 1,
        per_page: perPage,
        total: rows.length,
      };
    }

    return {
      current_page: data.current_page ?? data.meta?.current_page ?? page,
      last_page: data.last_page ?? data.meta?.last_page ?? 1,
      per_page: data.per_page ?? data.meta?.per_page ?? perPage,
      total: data.total ?? data.meta?.total ?? rows.length,
    };
  }, [query.data, page, perPage, rows.length]);

  return {
    data: query.data,
    rows,
    meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useStockProductOptions(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;

  return useQuery({
    queryKey: queryKeys.stockMovements.products,
    queryFn: async () => {
      try {
        return await getProductOptions();
      } catch {
        const { data } = await api.get("/inventories", {
          params: { per_page: 200, paginate: false },
        });
        return data;
      }
    },
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useStockWarehouseOptions(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;

  return useQuery({
    queryKey: queryKeys.stockMovements.warehouses,
    queryFn: async () => {
      const paths = [
        "/warehouses?paginate=false&per_page=100",
        "/warehouses?all=1&per_page=100",
        "/warehouses",
      ];
      for (const path of paths) {
        try {
          const { data } = await api.get(path);
          const list = extractArr<{ id: string; code?: string; name?: string }>(data);
          if (list.length) return list;
        } catch {
          /* try next */
        }
      }
      return [];
    },
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}