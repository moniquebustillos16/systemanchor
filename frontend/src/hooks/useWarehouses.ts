import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import api from "../api/axios";

/**
 * Backward-compatible warehouse list hook.
 * - Same return shape: rows = full API objects
 * - Same query key as prefetch
 * - Only improves extraction + fetch fallbacks
 * Safe for Location, Capacity, Receiving, Orders, etc.
 */

function extractArr<T = Record<string, unknown>>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== "object") return [];

  const o = json as Record<string, unknown>;

  if (Array.isArray(o.data)) return o.data as T[];
  if (Array.isArray(o.warehouses)) return o.warehouses as T[];
  if (Array.isArray(o.items)) return o.items as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  if (Array.isArray(o.rows)) return o.rows as T[];

  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data)) return n.data as T[];
    if (Array.isArray(n.warehouses)) return n.warehouses as T[];
    if (Array.isArray(n.items)) return n.items as T[];
    if (Array.isArray(n.results)) return n.results as T[];
    if (Array.isArray(n.rows)) return n.rows as T[];
  }

  return [];
}

async function fetchWarehousesRaw(
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const mod = await import("../api/warehouses");
    if (typeof mod.getWarehouses === "function") {
      const data = await mod.getWarehouses(params);
      if (extractArr(data).length > 0) return data;
    }
  } catch {
    /* fall through */
  }

  const attempts: { params?: Record<string, unknown> }[] = [
    { params: { ...params, paginate: false } },
    { params: { per_page: params.per_page ?? 200, all: 1 } },
    { params: { per_page: params.per_page ?? 200 } },
    { params: undefined },
  ];

  let lastBody: unknown = { data: [] };

  for (const attempt of attempts) {
    try {
      const { data } = await api.get("/warehouses", {
        params: attempt.params,
        timeout: 12000,
      });
      lastBody = data;
      if (extractArr(data).length > 0) return data;
    } catch {
      /* try next */
    }
  }

  return lastBody;
}

export type UseWarehousesOptions = {
  enabled?: boolean;
  perPage?: number;
};

export function useWarehouses(options: UseWarehousesOptions = {}) {
  const { enabled = true, perPage = 200 } = options;

  const params = useMemo(
    () =>
      ({
        per_page: perPage,
        all: 1,
      }) as Record<string, unknown>,
    [perPage]
  );

  const query = useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: () => fetchWarehousesRaw(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // Full records — Location / Capacity keep capacity, utilized, etc.
  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(query.data),
    [query.data]
  );

  return {
    rows,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}