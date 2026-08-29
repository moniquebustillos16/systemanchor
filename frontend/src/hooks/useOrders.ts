import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import {
  getPurchaseOrders,
  getPurchaseOrderStats,
  getSalesOrders,
  getSalesOrderStats,
  getGoodsReceipts,
  getGoodsReceiptStats,
  getShipments,
  getShipmentStats,
  getReturns,
  getReturnStats,
} from "../api/orders";

/* ── Shared options ────────────────────────────────────────── */
export type OrderListOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  warehouseId?: string | null;
  supplierId?: string | null;
  customerId?: string | null;
  enabled?: boolean;
};

/* ── Shared helpers ────────────────────────────────────────── */
function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  const o = json as { data?: unknown };
  if (Array.isArray(o.data)) return o.data as T[];
  const nested = o.data as { data?: unknown } | undefined;
  if (nested && Array.isArray(nested.data)) return nested.data as T[];
  return [];
}

function extractOrderStats(json: unknown) {
  const raw =
    json &&
    typeof json === "object" &&
    "data" in (json as object) &&
    typeof (json as { data: unknown }).data === "object" &&
    !Array.isArray((json as { data: unknown }).data)
      ? (json as { data: Record<string, unknown> }).data
      : ((json as Record<string, unknown>) ?? {});

  return {
    all: Number(raw.all ?? raw.total ?? 0),
    pending: Number(raw.pending ?? 0),
    done: Number(raw.done ?? raw.completed ?? 0),
    total_value: Number(raw.total_value ?? raw.value ?? 0),
  };
}

function extractReceiptStats(json: unknown) {
  const raw =
    json &&
    typeof json === "object" &&
    "data" in (json as object) &&
    typeof (json as { data: unknown }).data === "object" &&
    !Array.isArray((json as { data: unknown }).data)
      ? (json as { data: Record<string, unknown> }).data
      : ((json as Record<string, unknown>) ?? {});

  return {
    all: Number(raw.all ?? raw.total ?? 0),
    open: Number(raw.open ?? raw.pending ?? 0),
    done: Number(raw.done ?? raw.completed ?? 0),
    lines: Number(raw.lines ?? raw.lines_received ?? 0),
  };
}

function extractShipmentStats(json: unknown) {
  const raw =
    json &&
    typeof json === "object" &&
    "data" in (json as object) &&
    typeof (json as { data: unknown }).data === "object" &&
    !Array.isArray((json as { data: unknown }).data)
      ? (json as { data: Record<string, unknown> }).data
      : ((json as Record<string, unknown>) ?? {});

  return {
    all: Number(raw.all ?? 0),
    open: Number(raw.open ?? 0),
    delivered: Number(raw.delivered ?? 0),
    packages: Number(raw.packages ?? 0),
  };
}

function extractReturnStats(json: unknown) {
  const raw =
    json &&
    typeof json === "object" &&
    "data" in (json as object) &&
    typeof (json as { data: unknown }).data === "object" &&
    !Array.isArray((json as { data: unknown }).data)
      ? (json as { data: Record<string, unknown> }).data
      : ((json as Record<string, unknown>) ?? {});

  return {
    all: Number(raw.all ?? 0),
    open: Number(raw.open ?? 0),
    closed: Number(raw.closed ?? 0),
    items: Number(raw.items ?? 0),
  };
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

/* ── Purchase orders ───────────────────────────────────────── */
export function usePurchaseOrders(options: OrderListOptions = {}) {
  const {
    page = 1,
    perPage = 15,
    search = "",
    status = "",
    warehouseId = null,
    supplierId = null,
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
      warehouse_id: warehouseId || undefined,
      supplier_id: supplierId || undefined,
      sort: "order_date",
      dir: "desc",
    }),
    [page, perPage, search, status, warehouseId, supplierId]
  );

  const list = useQuery({
    queryKey: queryKeys.purchaseOrders.list(params as Record<string, unknown>),
    queryFn: () => getPurchaseOrders(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({
    queryKey: queryKeys.purchaseOrders.stats,
    queryFn: () => getPurchaseOrderStats(),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );
  const stats = useMemo(() => extractOrderStats(statsQ.data), [statsQ.data]);

  return {
    rows,
    meta,
    stats,
    data: list.data,
    isLoading: (list.isLoading || statsQ.isLoading) && !list.data,
    isFetching: list.isFetching || statsQ.isFetching,
    isError: list.isError || statsQ.isError,
    error: list.error ?? statsQ.error,
    refetchAll: async () => {
      await Promise.all([list.refetch(), statsQ.refetch()]);
    },
  };
}

/* ── Sales orders ──────────────────────────────────────────── */
export function useSalesOrders(options: OrderListOptions = {}) {
  const {
    page = 1,
    perPage = 15,
    search = "",
    status = "",
    warehouseId = null,
    customerId = null,
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
      warehouse_id: warehouseId || undefined,
      customer_id: customerId || undefined,
      sort: "order_date",
      dir: "desc",
    }),
    [page, perPage, search, status, warehouseId, customerId]
  );

  const list = useQuery({
    queryKey: queryKeys.salesOrders.list(params as Record<string, unknown>),
    queryFn: () => getSalesOrders(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({
    queryKey: queryKeys.salesOrders.stats,
    queryFn: () => getSalesOrderStats(),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );
  const stats = useMemo(() => extractOrderStats(statsQ.data), [statsQ.data]);

  return {
    rows,
    meta,
    stats,
    data: list.data,
    isLoading: (list.isLoading || statsQ.isLoading) && !list.data,
    isFetching: list.isFetching || statsQ.isFetching,
    isError: list.isError || statsQ.isError,
    error: list.error ?? statsQ.error,
    refetchAll: async () => {
      await Promise.all([list.refetch(), statsQ.refetch()]);
    },
  };
}

/* ── Goods receipts (Receiving) ────────────────────────────── */
export function useGoodsReceipts(options: OrderListOptions = {}) {
  const {
    page = 1,
    perPage = 15,
    search = "",
    status = "",
    warehouseId = null,
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
      warehouse_id: warehouseId || undefined,
      sort: "date",
      dir: "desc",
    }),
    [page, perPage, search, status, warehouseId]
  );

  const list = useQuery({
    queryKey: queryKeys.goodsReceipts.list(params as Record<string, unknown>),
    queryFn: () => getGoodsReceipts(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({
    queryKey: queryKeys.goodsReceipts.stats,
    queryFn: () => getGoodsReceiptStats(),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );
  const stats = useMemo(() => extractReceiptStats(statsQ.data), [statsQ.data]);

  return {
    rows,
    meta,
    stats,
    data: list.data,
    isLoading: (list.isLoading || statsQ.isLoading) && !list.data,
    isFetching: list.isFetching || statsQ.isFetching,
    isError: list.isError || statsQ.isError,
    error: list.error ?? statsQ.error,
    refetchAll: async () => {
      await Promise.all([list.refetch(), statsQ.refetch()]);
    },
  };
}

/* ── Shipments ─────────────────────────────────────────────── */
export function useShipments(options: OrderListOptions = {}) {
  const {
    page = 1,
    perPage = 15,
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
    queryKey: queryKeys.shipments.list(params as Record<string, unknown>),
    queryFn: () => getShipments(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({
    queryKey: queryKeys.shipments.stats,
    queryFn: () => getShipmentStats(),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );
  const stats = useMemo(
    () => extractShipmentStats(statsQ.data),
    [statsQ.data]
  );

  return {
    rows,
    meta,
    stats,
    data: list.data,
    isLoading: (list.isLoading || statsQ.isLoading) && !list.data,
    isFetching: list.isFetching || statsQ.isFetching,
    isError: list.isError || statsQ.isError,
    error: list.error ?? statsQ.error,
    refetchAll: async () => {
      await Promise.all([list.refetch(), statsQ.refetch()]);
    },
  };
}

/* ── Returns (RMA) ─────────────────────────────────────────── */
export function useReturns(options: OrderListOptions = {}) {
  const {
    page = 1,
    perPage = 15,
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
    queryKey: queryKeys.returns.list(params as Record<string, unknown>),
    queryFn: () => getReturns(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({
    queryKey: queryKeys.returns.stats,
    queryFn: () => getReturnStats(),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );
  const stats = useMemo(() => extractReturnStats(statsQ.data), [statsQ.data]);

  return {
    rows,
    meta,
    stats,
    data: list.data,
    isLoading: (list.isLoading || statsQ.isLoading) && !list.data,
    isFetching: list.isFetching || statsQ.isFetching,
    isError: list.isError || statsQ.isError,
    error: list.error ?? statsQ.error,
    refetchAll: async () => {
      await Promise.all([list.refetch(), statsQ.refetch()]);
    },
  };
}