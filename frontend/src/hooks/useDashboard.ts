import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import { getDashboard, type DashboardRange } from "../api/dashboard";
import api from "../api/axios";
import { extractArray } from "../api/types";

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
      code: String(r.code ?? ""),
      name: r.name != null ? String(r.name) : undefined,
      location: r.location != null ? String(r.location) : undefined,
      capacity: num(r.capacity),
      utilized: num(r.utilized),
      status: r.status != null ? String(r.status) : undefined,
    };
  });

  const categories = (Array.isArray(payload.category_mix) ? payload.category_mix : [])
    .slice(0, 6)
    .map((c, i) => {
      const r = asRecord(c);
      return {
        label: String(r.label ?? r.name ?? "—"),
        value: num(r.value ?? r.count ?? r.product_count ?? 1),
        color: String(r.color ?? CAT_COLORS[i % CAT_COLORS.length]),
      };
    });

  const pipelineRaw = Array.isArray(payload.pipeline) ? payload.pipeline : [];
  const pipeline =
    pipelineRaw.length > 0
      ? pipelineRaw.map((p) => {
          const r = asRecord(p);
          return {
            label: String(r.label ?? ""),
            count: num(r.count),
            color: String(r.color ?? "#C49A5A"),
          };
        })
      : [
          { label: "Open SO", count: num(so.pending), color: "#C49A5A" },
          { label: "Done SO", count: num(so.done), color: "#5A9A6E" },
          { label: "All SO", count: num(so.all), color: "#9A6B45" },
          { label: "Open PO", count: num(po.pending), color: "#6B9B7A" },
          { label: "All PO", count: num(po.all), color: "#A89880" },
        ];

  const recentOrders: DashOrderRow[] = (
    Array.isArray(payload.recent_orders) ? payload.recent_orders : []
  ).map((o) => {
    const r = asRecord(o);
    const kind = String(r.kind ?? r.type ?? "SO").toUpperCase() === "PO" ? "PO" : "SO";
    return {
      id: String(r.id ?? r.so_number ?? r.po_number ?? "—"),
      kind,
      party: String(r.party ?? r.customer_name ?? r.supplier_name ?? "—"),
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

async function fetchDashboardLegacy(range: string): Promise<DashboardViewModel> {
  const unwrap = (v: unknown): Record<string, number> => {
    const raw = v as Record<string, unknown>;
    if (raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
      return raw.data as Record<string, number>;
    }
    return (raw ?? {}) as Record<string, number>;
  };

  const kpi = await Promise.allSettled([
    api.get("/inventories/stats").then((r) => r.data),
    api.get("/sales-orders/stats").then((r) => r.data),
    api.get("/purchase-orders/stats").then((r) => r.data),
  ]);

  let invValue = 0,
    lowStock = 0,
    outStock = 0,
    skuCount = 0;
  let soPending = 0,
    soAll = 0,
    soDone = 0,
    soValue = 0;
  let poPending = 0,
    poAll = 0,
    poValue = 0;

  if (kpi[0].status === "fulfilled") {
    const j = unwrap(kpi[0].value);
    invValue = num(j.inventory_value ?? j.total_value);
    lowStock = num(j.low_stock ?? j.low);
    outStock = num(j.out_of_stock ?? j.out);
    skuCount = num(j.total_products ?? j.products ?? j.count);
  }
  if (kpi[1].status === "fulfilled") {
    const j = unwrap(kpi[1].value);
    soAll = num(j.all);
    soPending = num(j.pending);
    soDone = num(j.done);
    soValue = num(j.total_value);
  }
  if (kpi[2].status === "fulfilled") {
    const j = unwrap(kpi[2].value);
    poAll = num(j.all ?? j.total);
    poPending = num(j.pending);
    poValue = num(j.total_value);
  }

  const batchA = await Promise.allSettled([
    api.get("/warehouses", { params: { per_page: 30, all: 1 } }).then((r) => r.data),
    api
      .get("/sales-orders", { params: { per_page: 5, sort: "order_date", dir: "desc" } })
      .then((r) => r.data),
    api
      .get("/purchase-orders", { params: { per_page: 3, sort: "order_date", dir: "desc" } })
      .then((r) => r.data),
  ]);

  const warehouses: DashWarehouse[] =
    batchA[0].status === "fulfilled"
      ? extractArray<DashWarehouse>(batchA[0].value).map((w) => ({
          id: String(w.id),
          code: String(w.code ?? ""),
          name: w.name,
          location: w.location,
          capacity: num(w.capacity),
          utilized: num(w.utilized),
          status: w.status,
        }))
      : [];

  const soList =
    batchA[1].status === "fulfilled" ? extractArray<Record<string, unknown>>(batchA[1].value) : [];
  const poList =
    batchA[2].status === "fulfilled" ? extractArray<Record<string, unknown>>(batchA[2].value) : [];

  const recentOrders: DashOrderRow[] = [
    ...soList.slice(0, 4).map((o) => ({
      id: String(o.so_number ?? o.id ?? "SO"),
      kind: "SO" as const,
      party: String((o.customer as { name?: string })?.name ?? "—"),
      total: num(o.total),
      status: String(o.status ?? "pending"),
      date: String(o.order_date ?? "").slice(0, 10),
    })),
    ...poList.slice(0, 2).map((o) => ({
      id: String(o.po_number ?? o.id ?? "PO"),
      kind: "PO" as const,
      party: String((o.supplier as { name?: string })?.name ?? "—"),
      total: num(o.total),
      status: String(o.status ?? "pending"),
      date: String(o.order_date ?? "").slice(0, 10),
    })),
  ];

  const batchB = await Promise.allSettled([
    api.get("/inventories", { params: { per_page: 8, status: "low-stock" } }).then((r) => r.data),
    api.get("/inventories", { params: { per_page: 5, status: "out-of-stock" } }).then((r) => r.data),
    api.get("/categories", { params: { per_page: 12 } }).then((r) => r.data),
    api.get("/cycle-counts/stats").then((r) => r.data).catch(() => null),
    api.get("/goods-receipts/stats").then((r) => r.data).catch(() => null),
    api.get("/returns/stats").then((r) => r.data).catch(() => null),
  ]);

  const lowList =
    batchB[0].status === "fulfilled"
      ? extractArray<Record<string, unknown>>(batchB[0].value)
      : [];
  const oosList =
    batchB[1].status === "fulfilled"
      ? extractArray<Record<string, unknown>>(batchB[1].value)
      : [];

  const alerts: DashAlertItem[] = [];
  for (const p of oosList) {
    alerts.push({
      type: "danger",
      title: "Out of stock",
      msg: `${String(p.name ?? p.sku ?? "SKU")} · 0 units`,
      path: "/products",
      sku: p.sku != null ? String(p.sku) : undefined,
    });
  }
  for (const p of lowList) {
    alerts.push({
      type: "warning",
      title: "Low stock",
      msg: `${String(p.name ?? p.sku ?? "SKU")} · ${p.qty ?? "?"} remaining`,
      path: "/products",
      sku: p.sku != null ? String(p.sku) : undefined,
    });
  }

  let categories: DashboardViewModel["categories"] = [];
  if (batchB[2].status === "fulfilled") {
    categories = extractArray<Record<string, unknown>>(batchB[2].value)
      .slice(0, 6)
      .map((c, i) => ({
        label: String(c.name ?? c.label ?? "—"),
        value: num(c.product_count ?? c.count ?? c.value ?? 1),
        color: CAT_COLORS[i % CAT_COLORS.length],
      }));
  }

  let serverTrendLabels: string[] | null = null;
  let serverStockIn: number[] | null = null;
  let serverStockOut: number[] | null = null;
  try {
    const movRes = await api
      .get("/stock-movements", { params: { per_page: 60 } })
      .then((r) => r.data);
    const moves = extractArray<Record<string, unknown>>(movRes);
    const monthsBack = range === "3m" ? 3 : range === "1y" ? 12 : 7;
    const now = new Date();
    const labels: string[] = [];
    const keys: string[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      labels.push(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
          d.getMonth()
        ]
      );
    }
    const inBy = new Map(keys.map((k) => [k, 0]));
    const outBy = new Map(keys.map((k) => [k, 0]));
    for (const m of moves) {
      const dt = new Date(String(m.movement_date ?? m.date ?? ""));
      if (Number.isNaN(dt.getTime())) continue;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!inBy.has(key)) continue;
      const t = String(m.type ?? "").toUpperCase();
      if (t === "IN" || t === "RECEIPT") inBy.set(key, (inBy.get(key) || 0) + 1);
      if (t === "OUT" || t === "ISSUE") outBy.set(key, (outBy.get(key) || 0) + 1);
    }
    serverTrendLabels = labels;
    serverStockIn = keys.map((k) => inBy.get(k) || 0);
    serverStockOut = keys.map((k) => outBy.get(k) || 0);
  } catch {
    /* optional */
  }

  return {
    invValue,
    lowStock,
    outStock,
    skuCount,
    soPending,
    soAll,
    soDone,
    poPending,
    poAll,
    soValue,
    poValue,
    warehouses,
    recentOrders,
    alerts,
    categories,
    pipeline: [
      { label: "Open SO", count: soPending, color: "#C49A5A" },
      { label: "Done SO", count: soDone, color: "#5A9A6E" },
      { label: "All SO", count: soAll, color: "#9A6B45" },
      { label: "Open PO", count: poPending, color: "#6B9B7A" },
      { label: "All PO", count: poAll, color: "#A89880" },
    ],
    moveStats: {},
    cycleStats:
      batchB[3].status === "fulfilled" && batchB[3].value
        ? (batchB[3].value as DashOpsStats)
        : {},
    receiptStats:
      batchB[4].status === "fulfilled" && batchB[4].value
        ? (batchB[4].value as DashOpsStats)
        : {},
    returnStats:
      batchB[5].status === "fulfilled" && batchB[5].value
        ? (batchB[5].value as DashOpsStats)
        : {},
    recentMoves: [],
    activityFeed: [],
    serverTrend: null,
    serverTrendLabels,
    serverStockIn,
    serverStockOut,
    usingUnified: false,
    generatedAt: new Date().toISOString(),
  };
}

async function fetchDashboardData(range: string): Promise<DashboardViewModel> {
  try {
    const payload = await getDashboard(range as DashboardRange);
    if (
      payload &&
      typeof payload === "object" &&
      ("inventory_value" in payload || "total_products" in payload)
    ) {
      return mapUnifiedDashboard(payload as Record<string, unknown>);
    }
    return fetchDashboardLegacy(range);
  } catch {
    return fetchDashboardLegacy(range);
  }
}

export function useDashboard(options: { range?: string; enabled?: boolean } = {}) {
  const range = options.range ?? "7m";
  const enabled = options.enabled !== false;

  const query = useQuery({
    queryKey: queryKeys.dashboard(range),
    queryFn: () => fetchDashboardData(range),
    enabled,
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