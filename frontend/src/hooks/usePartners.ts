import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import { getCustomers, getSuppliers } from "../api/partners";

/* ── Options ───────────────────────────────────────────────── */
export type PartnerListOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  enabled?: boolean;
};

/* ── List extraction (Laravel-safe) ────────────────────────── */
function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== "object") return [];

  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as T[];
  if (Array.isArray(o.items)) return o.items as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  if (Array.isArray(o.rows)) return o.rows as T[];

  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data)) return n.data as T[];
    if (Array.isArray(n.items)) return n.items as T[];
    if (Array.isArray(n.results)) return n.results as T[];
    if (Array.isArray(n.rows)) return n.rows as T[];
  }

  return [];
}

function buildMeta(
  data: unknown,
  page: number,
  perPage: number,
  rowsLen: number
) {
  if (!data || Array.isArray(data)) {
    return {
      current_page: page,
      last_page: 1,
      per_page: perPage,
      total: rowsLen,
    };
  }
  const d = data as {
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
  };
  return {
    current_page: d.current_page ?? d.meta?.current_page ?? page,
    last_page: d.last_page ?? d.meta?.last_page ?? 1,
    per_page: d.per_page ?? d.meta?.per_page ?? perPage,
    total: d.total ?? d.meta?.total ?? rowsLen,
  };
}

const STALE_MS = 60_000;

const partnerKeys = {
  customers: {
    all: ["customers"] as const,
    list: (params: Record<string, unknown>) =>
      ["customers", "list", params] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (params: Record<string, unknown>) =>
      ["suppliers", "list", params] as const,
  },
};

function customersListKey(params: Record<string, unknown>) {
  const qk = queryKeys as typeof queryKeys & {
    customers?: { list: (p: Record<string, unknown>) => readonly unknown[] };
  };
  return qk.customers?.list?.(params) ?? partnerKeys.customers.list(params);
}

function suppliersListKey(params: Record<string, unknown>) {
  const qk = queryKeys as typeof queryKeys & {
    suppliers?: { list: (p?: Record<string, unknown>) => readonly unknown[] };
  };
  return qk.suppliers?.list?.(params) ?? partnerKeys.suppliers.list(params);
}

/* ── Customers ─────────────────────────────────────────────── */
export function useCustomers(options: PartnerListOptions = {}) {
  const {
    page = 1,
    perPage = 100,
    search = "",
    status = "",
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
    }),
    [page, perPage, search, status]
  );

  const list = useQuery({
    queryKey: customersListKey(params as Record<string, unknown>),
    queryFn: () => getCustomers(params),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );

  return {
    rows,
    meta,
    data: list.data,
    isLoading: list.isLoading && !list.data,
    isFetching: list.isFetching,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
  };
}

/* ── Suppliers ─────────────────────────────────────────────── */
export function useSuppliers(options: PartnerListOptions = {}) {
  const {
    page = 1,
    perPage = 100,
    search = "",
    status = "",
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
    }),
    [page, perPage, search, status]
  );

  const list = useQuery({
    queryKey: suppliersListKey(params as Record<string, unknown>),
    queryFn: () => getSuppliers(params),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );

  return {
    rows,
    meta,
    data: list.data,
    isLoading: list.isLoading && !list.data,
    isFetching: list.isFetching,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
  };
}