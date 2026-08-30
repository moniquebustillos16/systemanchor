import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "../lib/queryClient";
import {
  getInventoryList,
  getInventoryStats,
  getCategories,
  type InventoryListParams,
  type InventoryStats,
} from "../api/inventory";

export type UseInventoryListOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  categoryId?: string | number | null;
  warehouseId?: string | number | null;
  sort?: string;
  dir?: "asc" | "desc";
  enabled?: boolean;
};

function toStrId(v: string | number | null | undefined): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}
/* ── Imperative shared cache (Phase 3C) ───────────────────── */

export async function fetchInventoryStatsCached(): Promise<InventoryStats> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.inventory.stats,
    queryFn: () => getInventoryStats(),
    staleTime: 60_000,
  });
}

export async function fetchInventoryProductsCached(
  params: InventoryListParams = { per_page: 200, paginate: false }
): Promise<Record<string, unknown>[]> {
  const data = await queryClient.fetchQuery({
    queryKey: queryKeys.inventory.list(params as Record<string, unknown>),
    queryFn: () => getInventoryList(params),
    staleTime: 60_000,
  });
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = data as { data?: Record<string, unknown>[] };
  return Array.isArray(d?.data) ? d.data : [];
}

export function useInventoryStats(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;

  return useQuery({
    queryKey: queryKeys.inventory.stats,
    queryFn: () => getInventoryStats(),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useInventoryList(options: UseInventoryListOptions = {}) {
  const {
    page = 1,
    perPage = 20,
    search = "",
    status = "",
    categoryId = null,
    warehouseId = null,
    sort = "name",
    dir = "asc",
    enabled = true,
  } = options;

  const params: InventoryListParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status || undefined,
      category_id: toStrId(categoryId),
      warehouse_id: toStrId(warehouseId),
      sort,
      dir,
      paginate: true,
      with_images: true,
    }),
    [page, perPage, search, status, categoryId, warehouseId, sort, dir]
  );

  const query = useQuery({
    queryKey: queryKeys.inventory.list(params as Record<string, unknown>),
    queryFn: () => getInventoryList(params),
    enabled,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => {
    const data = query.data as
      | { data?: Record<string, unknown>[]; current_page?: number; last_page?: number; per_page?: number; total?: number }
      | Record<string, unknown>[]
      | undefined;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [query.data]);

  const meta = useMemo(() => {
    const data = query.data as
      | {
          data?: unknown[];
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
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

export function useInventoryCategories(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;

  return useQuery({
    queryKey: [...queryKeys.inventory.all, "categories"] as const,
    queryFn: () => getCategories(),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** Stats + list for the Inventory page */
export function useInventoryPage(options: UseInventoryListOptions = {}) {
  const stats = useInventoryStats({ enabled: options.enabled });
  const list = useInventoryList(options);

  const statsView = useMemo(() => {
    const s = stats.data as InventoryStats | Record<string, unknown> | undefined;
    if (!s) {
      return {
        inventory_value: 0,
        low_stock: 0,
        out_of_stock: 0,
        total_products: 0,
      };
    }
    const raw =
      (s as { data?: Record<string, unknown> }).data &&
      typeof (s as { data?: unknown }).data === "object" &&
      !Array.isArray((s as { data?: unknown }).data)
        ? ((s as { data: Record<string, unknown> }).data)
        : (s as Record<string, unknown>);

    return {
      inventory_value: Number(raw.inventory_value ?? raw.total_value ?? 0),
      low_stock: Number(raw.low_stock ?? raw.low ?? 0),
      out_of_stock: Number(raw.out_of_stock ?? raw.out ?? 0),
      total_products: Number(raw.total_products ?? raw.products ?? raw.count ?? 0),
    };
  }, [stats.data]);

  return {
    stats: statsView,
    statsQuery: stats,
    list,
    isLoading: stats.isLoading || list.isLoading,
    isFetching: stats.isFetching || list.isFetching,
    refetchAll: async () => {
      await Promise.all([stats.refetch(), list.refetch()]);
    },
  };
}