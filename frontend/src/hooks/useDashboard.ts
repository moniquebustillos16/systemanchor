import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import { getDashboard, type DashboardRange } from "../api/dashboard";

export type DashWarehouse = {
  id: string;
  code: string;
  name?: string;
  location?: string;
  capacity?: number;
  utilized?: number;
  status?: string;
};

export type DashOrderRow = {
  id: string;
  kind: "SO" | "PO";
  party: string;
  total: number;
  status: string;
  date: string;
};

export type DashAlertItem = {
  type: "danger" | "warning" | "info";
  title: string;
  msg: string;
  path?: string;
  sku?: string;
};

export type DashOpsStats = Record<string, number | null | undefined>;

export type DashboardViewModel = {
  invValue: number;
  lowStock: number;
  outStock: number;
  skuCount: number;
  soPending: number;
  soAll: number;
  soDone: number;
  poPending: number;
  poAll: number;
  soValue: number;
  poValue: number;
  warehouses: DashWarehouse[];
  recentOrders: DashOrderRow[];
  alerts: DashAlertItem[];
  categories: { label: string; value: number; color: string }[];
  pipeline: { label: string; count: number; color: string }[];
  moveStats: DashOpsStats;
  cycleStats: DashOpsStats;
  receiptStats: DashOpsStats;
  returnStats: DashOpsStats;
  recentMoves: Record<string, unknown>[];
  activityFeed: Record<string, unknown>[];
  serverTrend: number[] | null;
  serverTrendLabels: string[] | null;
  serverStockIn: number[] | null;
  serverStockOut: number[] | null;
  usingUnified: boolean;
  generatedAt: string | null;
};

const CAT_COLORS = ["#9A6B45", "#C4A07A", "#6B9B7A", "#C49A5A", "#A89880", "#5A9A6E"];

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function mapUnifiedDashboard(payload: Record<string, unknown>): DashboardViewModel {
  const so = asRecord(payload.sales_orders);
  const po = asRecord(payload.purchase_orders);
  const moves = asRecord(payload.stock_movements);
  const cycle = asRecord(payload.cycle_counts);
  const receipts = asRecord(payload.goods_receipts);
  const returns = asRecord(payload.returns);

  const warehouses: DashWarehouse[] = (
    Array.isArray(payload.warehouses) ? payload.warehouses : []
  ).map((w) => {
    const r = asRecord(w);
    return {
      id: String(r.id ?? ""),
      code: String(r.code ?? r.name ?? r.id ?? ""),
      name: r.name != null ? String(r.name) : undefined,
      location: r.location != null ? String(r.location) : undefined,
      capacity: r.capacity != null ? num(r.capacity) : undefined,
      utilized: r.utilized != null ? num(r.utilized) : undefined,
      status: r.status != null ? String(r.status) : undefined,
    };
  });

  const categories = (
    Array.isArray(payload.category_mix) ? payload.category_mix : []
  ).map((c, i) => {
    const r = asRecord(c);
    return {
      label: String(r.label ?? r.name ?? "Other"),
      value: num(r.value ?? r.count ?? r.cnt, 0),
      color: String(r.color ?? CAT_COLORS[i % CAT_COLORS.length]),
    };
  });

  const pipeline = (
    Array.isArray(payload.pipeline) ? payload.pipeline : []
  ).map((p) => {
    const r = asRecord(p);
    return {
      label: String(r.label ?? ""),
      count: num(r.count),
      color: String(r.color ?? "#9A6B45"),
    };
  });

  const recentOrders: DashOrderRow[] = (
    Array.isArray(payload.recent_orders) ? payload.recent_orders : []
  ).map((o) => {
    const r = asRecord(o);
    const kindRaw = String(r.kind ?? r.type ?? "SO").toUpperCase();
    return {
      id: String(r.id ?? ""),
      kind: kindRaw === "PO" ? "PO" : "SO",
      party: String(r.party ?? r.customer ?? r.supplier ?? r.name ?? "—"),
      total: num(r.total),
      status: String(r.status ?? "pending"),
      date: String(r.date ?? r.order_date ?? "").slice(0, 10),
    };
  });

  const alerts: DashAlertItem[] = (
    Array.isArray(payload.stock_alerts) ? payload.stock_alerts : []
  ).map((a) => {
    const r = asRecord(a);
    const t = String(r.type ?? "warning");
    return {
      type: t === "danger" || t === "error" ? "danger" : t === "info" ? "info" : "warning",
      title: String(r.title ?? "Alert"),
      msg: String(r.msg ?? r.message ?? ""),
      path: r.path != null ? String(r.path) : "/products",
      sku: r.sku != null ? String(r.sku) : undefined,
    };
  });

  return {
    invValue: num(payload.inventory_value),
    lowStock: num(payload.low_stock),
    outStock: num(payload.out_of_stock),
    skuCount: num(payload.total_products ?? payload.active_skus),
    soPending: num(so.pending),
    soAll: num(so.all),
    soDone: num(so.done),
    poPending: num(po.pending),
    poAll: num(po.all),
    soValue: num(so.total_value),
    poValue: num(po.total_value),
    warehouses,
    recentOrders,
    alerts,
    categories,
    pipeline,
    moveStats: moves as unknown as DashOpsStats,
    cycleStats: cycle as unknown as DashOpsStats,
    receiptStats: receipts as unknown as DashOpsStats,
    returnStats: returns as unknown as DashOpsStats,
    recentMoves: Array.isArray(payload.recent_movements)
      ? (payload.recent_movements as Record<string, unknown>[])
      : [],
    activityFeed: Array.isArray(payload.activity_feed)
      ? (payload.activity_feed as Record<string, unknown>[])
      : [],
    serverTrend: Array.isArray(payload.inventory_trend)
      ? (payload.inventory_trend as number[]).map((n) => num(n))
      : null,
    serverTrendLabels: Array.isArray(payload.trend_labels)
      ? (payload.trend_labels as unknown[]).map(String)
      : null,
    serverStockIn: Array.isArray(payload.stock_in_series)
      ? (payload.stock_in_series as number[]).map((n) => num(n))
      : null,
    serverStockOut: Array.isArray(payload.stock_out_series)
      ? (payload.stock_out_series as number[]).map((n) => num(n))
      : null,
    usingUnified: true,
    generatedAt: payload.generated_at != null ? String(payload.generated_at) : null,
  };
}

async function fetchDashboardData(range: string): Promise<DashboardViewModel> {
  const payload = await getDashboard(range as DashboardRange);
  if (!payload || typeof payload !== "object") {
    throw new Error("Dashboard API returned an empty payload");
  }
  if (
    !("inventory_value" in payload) &&
    !("total_products" in payload) &&
    !("sales_orders" in payload)
  ) {
    throw new Error("Dashboard API returned an unrecognized payload shape");
  }
  return mapUnifiedDashboard(payload as Record<string, unknown>);
}

export function useDashboard(options: { range?: string; enabled?: boolean } = {}) {
  const range = options.range ?? "7m";
  const enabled = options.enabled !== false;

  const query = useQuery({
    queryKey: queryKeys.dashboard(range),
    queryFn: () => fetchDashboardData(range),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const data = useMemo(() => query.data, [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
    usingUnified: data?.usingUnified ?? false,
  };
}