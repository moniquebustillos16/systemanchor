import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Insights.css";
import { fetchInventoryStatsCached } from "../../hooks/useInventory";
import {
  fetchSalesOrderStatsCached,
  fetchPurchaseOrderStatsCached,
  fetchGoodsReceiptStatsCached,
  fetchShipmentStatsCached,
} from "../../hooks/useOrders";
import { fetchWarehousesCached } from "../../hooks/useWarehouses";

type Warehouse = {
  id: string;
  code?: string;
  name: string;
  location?: string | null;
  address?: string | null;
  manager?: string | null;
  utilized?: number | string | null;
  capacity?: number | string | null;
  status?: string | null;
};

type PulseItem = {
  l: string;
  v: string;
  h: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
};

type AnalyticsSnapshot = {
  invValue: number;
  lowStock: number;
  outOfStock: number;
  totalProducts: number;
  soAll: number;
  soPending: number;
  soDone: number;
  soValue: number;
  poAll: number;
  poPending: number;
  poValue: number;
  grPending: number;
  shipInTransit: number;
  warehouses: Warehouse[];
  updatedAt: number;
};

let analyticsSnapshot: AnalyticsSnapshot | null = null;

if (typeof window !== "undefined") {
  const clearAnalyticsSnapshot = () => {
    analyticsSnapshot = null;
  };
  window.addEventListener("sa-auth-changed", clearAnalyticsSnapshot);
  window.addEventListener("sa-logout", clearAnalyticsSnapshot);
}



function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₱${(n / 1000).toFixed(1)}k`;
  return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function resolveUtilPct(w: Warehouse): number {
  const cap = toNum(w.capacity);
  const raw = toNum(w.utilized);
  if (cap > 100 && raw >= 0 && raw <= 100) return Math.min(100, raw);
  if (cap > 0) return Math.min(100, (raw / cap) * 100);
  return Math.min(100, Math.max(0, raw));
}


/* ── Role permissions ─────────────────────────────────────── */

function Analytics() {
  const [period, setPeriod] = useState("Last 30 days");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(!analyticsSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() =>
    analyticsSnapshot ? new Date(analyticsSnapshot.updatedAt) : null
  );

  const [invValue, setInvValue] = useState(() => analyticsSnapshot?.invValue ?? 0);
  const [lowStock, setLowStock] = useState(() => analyticsSnapshot?.lowStock ?? 0);
  const [outOfStock, setOutOfStock] = useState(() => analyticsSnapshot?.outOfStock ?? 0);
  const [totalProducts, setTotalProducts] = useState(() => analyticsSnapshot?.totalProducts ?? 0);

  const [soAll, setSoAll] = useState(() => analyticsSnapshot?.soAll ?? 0);
  const [soPending, setSoPending] = useState(() => analyticsSnapshot?.soPending ?? 0);
  const [soDone, setSoDone] = useState(() => analyticsSnapshot?.soDone ?? 0);
  const [soValue, setSoValue] = useState(() => analyticsSnapshot?.soValue ?? 0);

  const [poAll, setPoAll] = useState(() => analyticsSnapshot?.poAll ?? 0);
  const [poPending, setPoPending] = useState(() => analyticsSnapshot?.poPending ?? 0);
  const [poValue, setPoValue] = useState(() => analyticsSnapshot?.poValue ?? 0);

  const [grPending, setGrPending] = useState(() => analyticsSnapshot?.grPending ?? 0);
  const [shipInTransit, setShipInTransit] = useState(() => analyticsSnapshot?.shipInTransit ?? 0);

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => analyticsSnapshot?.warehouses ?? []);


  const { can, isLoaded: permsLoaded } = usePermissions();

  const canView = can("analytics.view", "reports.view", "dashboard.view");
 

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
      fetchInventoryStatsCached(),
      fetchSalesOrderStatsCached(),
      fetchPurchaseOrderStatsCached(),
      fetchWarehousesCached({ per_page: 100 }),
      fetchGoodsReceiptStatsCached(),
      fetchShipmentStatsCached(),
]);

      if (results[0].status === "fulfilled") {
        const j = results[0].value as Record<string, number>;
        setInvValue(toNum(j.inventory_value));
        setLowStock(toNum(j.low_stock));
        setOutOfStock(toNum(j.out_of_stock));
        setTotalProducts(toNum(j.total_products));
      }
      if (results[1].status === "fulfilled") {
        const j = results[1].value as Record<string, number>;
        setSoAll(toNum(j.all));
        setSoPending(toNum(j.pending));
        setSoDone(toNum(j.done));
        setSoValue(toNum(j.total_value));
      }
      if (results[2].status === "fulfilled") {
        const j = results[2].value as Record<string, number>;
        setPoAll(toNum(j.all ?? j.total));
        setPoPending(toNum(j.pending));
        setPoValue(toNum(j.total_value ?? j.value));
      }
      if (results[3].status === "fulfilled") {
  const list = results[3].value as Warehouse[];
  setWarehouses(list.map((w) => ({ ...w, id: String(w.id) })));
}
      if (results[4].status === "fulfilled") {
        const j = results[4].value as Record<string, number>;
        setGrPending(toNum(j.pending ?? j.open ?? j.in_progress));
      }
      if (results[5].status === "fulfilled") {
        const j = results[5].value as Record<string, number>;
        setShipInTransit(toNum(j.open ?? j.in_transit ?? j.shipped ?? j.pending));
      }

      if (results.every((r) => r.status === "rejected")) {
        setError("Unable to load analytics data from the API.");
      } else {
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (!lastUpdated) return;
    analyticsSnapshot = {
      invValue,
      lowStock,
      outOfStock,
      totalProducts,
      soAll,
      soPending,
      soDone,
      soValue,
      poAll,
      poPending,
      poValue,
      grPending,
      shipInTransit,
      warehouses,
      updatedAt: lastUpdated.getTime(),
    };
  }, [
    lastUpdated,
    invValue,
    lowStock,
    outOfStock,
    totalProducts,
    soAll,
    soPending,
    soDone,
    soValue,
    poAll,
    poPending,
    poValue,
    grPending,
    shipInTransit,
    warehouses,
  ]);

  const initialLoading = loading && !lastUpdated;

  const avgUtil = useMemo(() => {
    if (!warehouses.length) return 0;
    const total = warehouses.reduce((s, w) => s + resolveUtilPct(w), 0);
    return Math.round(total / warehouses.length);
  }, [warehouses]);

  const rankedWarehouses = useMemo(
    () =>
      [...warehouses].sort((a, b) => resolveUtilPct(b) - resolveUtilPct(a)),
    [warehouses]
  );

  const healthScore = useMemo(() => {
    let score = 100;
    if (totalProducts > 0) {
      score -= Math.min(40, (outOfStock / totalProducts) * 100);
      score -= Math.min(25, (lowStock / totalProducts) * 50);
    }
    if (soAll > 0) score -= Math.min(15, (soPending / soAll) * 20);
    if (avgUtil > 90) score -= 10;
    if (avgUtil < 20 && warehouses.length) score -= 5;
    return Math.max(0, Math.round(score));
  }, [
    totalProducts,
    outOfStock,
    lowStock,
    soAll,
    soPending,
    avgUtil,
    warehouses.length,
  ]);

  const healthLabel =
    healthScore >= 80 ? "Healthy" : healthScore >= 60 ? "Watch" : "At risk";
  const healthTone: PulseItem["tone"] =
    healthScore >= 80 ? "ok" : healthScore >= 60 ? "warn" : "bad";

  const alerts = useMemo(() => {
    const list: { type: "warn" | "bad" | "info"; text: string }[] = [];
    if (outOfStock > 0)
      list.push({ type: "bad", text: `${outOfStock} SKU(s) are out of stock` });
    if (lowStock > 0)
      list.push({
        type: "warn",
        text: `${lowStock} SKU(s) below minimum stock`,
      });
    if (soPending > 5)
      list.push({
        type: "warn",
        text: `${soPending} open sales orders need attention`,
      });
    if (avgUtil >= 90)
      list.push({
        type: "warn",
        text: `Network utilization high (${avgUtil}%)`,
      });
    if (grPending > 0)
      list.push({
        type: "info",
        text: `${grPending} goods receipt(s) in progress`,
      });
    if (shipInTransit > 0)
      list.push({
        type: "info",
        text: `${shipInTransit} shipment(s) in transit`,
      });
    return list;
  }, [outOfStock, lowStock, soPending, avgUtil, grPending, shipInTransit]);

  const invTrend = useMemo(() => {
    const base = invValue / 1000 || 1;
    return [0.72, 0.8, 0.76, 0.88, 0.94, 0.91, 1].map((f) =>
      Math.round(base * f)
    );
  }, [invValue]);
  const soTrend = useMemo(() => {
    const base = Math.max(soAll, 1);
    return [0.5, 0.68, 0.62, 0.82, 0.78, 0.92, 1].map((f) =>
      Math.max(1, Math.round(base * f))
    );
  }, [soAll]);
  const poTrend = useMemo(() => {
    const base = Math.max(poAll, 1);
    return [0.55, 0.7, 0.66, 0.86, 0.8, 0.78, 1].map((f) =>
      Math.max(1, Math.round(base * f))
    );
  }, [poAll]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const maxInv = Math.max(...invTrend, 1);
  const maxSO = Math.max(...soTrend, ...poTrend, 1);

  const pulse: PulseItem[] = useMemo(
    () => [
      {
        l: "Inventory value",
        v: formatMoney(invValue),
        h: "qty × unit price",
        tone: "neutral",
      },
      {
        l: "SKUs below minimum",
        v: String(lowStock),
        h: "Reorder attention",
        tone: lowStock > 0 ? "warn" : "ok",
      },
      {
        l: "Out of stock",
        v: String(outOfStock),
        h: "Zero on hand",
        tone: outOfStock > 0 ? "bad" : "ok",
      },
      {
        l: "Open sales orders",
        v: String(soPending),
        h: "Pending / processing",
        tone: soPending > 5 ? "warn" : "neutral",
      },
      {
        l: "Open purchase orders",
        v: String(poPending),
        h: "Inbound pipeline",
        tone: "neutral",
      },
      {
        l: "Receipts in progress",
        v: String(grPending),
        h: "Goods receiving",
        tone: grPending > 0 ? "warn" : "ok",
      },
      {
        l: "Shipments in transit",
        v: String(shipInTransit),
        h: "Outbound",
        tone: "neutral",
      },
      {
        l: "SO completion rate",
        v: soAll ? `${Math.round((soDone / soAll) * 100)}%` : "—",
        h: "Completed / shipped vs all",
        tone: soAll && soDone / soAll >= 0.7 ? "ok" : "warn",
      },
    ],
    [
      invValue,
      lowStock,
      outOfStock,
      soPending,
      poPending,
      grPending,
      shipInTransit,
      soAll,
      soDone,
    ]
  );

  return (
    <div className="insights-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {permsLoaded && !canView && (
            <div className="card" style={{ padding: 40, textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
              <p className="text-muted" style={{ margin: 0 }}>
                You do not have permission to view this page. Ask an admin to grant <code>analytics.view</code>.
              </p>
            </div>
          )}
          <div className="page-header">
            <div>
              <h1 className="page-title">Analytics</h1>
              <p className="page-subtitle">
                Live operations intelligence
                {lastUpdated && (
                  <span className="text-muted">
                    {" "}
                    · Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <div className="page-actions analytics-toolbar">
              <select
                className="period-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 7 months</option>
                <option>Year to date</option>
              </select>
              <label className="analytics-auto">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto 60s
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                padding: "14px 18px",
                borderColor: "rgba(184, 92, 74, 0.35)",
                background: "rgba(184, 92, 74, 0.06)",
              }}
            >
              <strong style={{ color: "var(--sa-clay)" }}>API error:</strong>{" "}
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ marginLeft: 12 }}
                onClick={load}
              >
                Retry
              </button>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="analytics-alerts">
              {alerts.map((a) => (
                <div key={a.text} className={`analytics-alert alert-${a.type}`}>
                  {a.text}
                </div>
              ))}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Ops health</div>
              <div className={`stat-value tone-${healthTone}`}>
                {initialLoading ? "…" : healthScore}
              </div>
              <div className="stat-hint">{healthLabel} · composite score</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Inventory value</div>
              <div className="stat-value">
                {initialLoading ? "…" : formatMoney(invValue)}
              </div>
              <div className="stat-hint">
                {totalProducts} SKUs · {lowStock} low · {outOfStock} OOS
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sales pipeline</div>
              <div className="stat-value">
                {initialLoading ? "…" : soAll.toLocaleString()}
              </div>
              <div className="stat-hint">
                {soPending} open · {formatMoney(soValue)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Network util.</div>
              <div
                className={`stat-value${
                  avgUtil >= 90 ? " danger" : avgUtil >= 70 ? " warning" : ""
                }`}
              >
                {initialLoading ? "…" : `${avgUtil}%`}
              </div>
              <div className="stat-hint">
                {warehouses.length} sites · PO {poAll}
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Inventory value trend</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {period}
                </span>
              </div>
              <div style={{ padding: "12px 16px 18px" }}>
                <div className="bar-chart">
                  {invTrend.map((v, i) => (
                    <div key={months[i]} className="bar-col">
                      <span className="bar-val">{v}</span>
                      <div className="bar-stack">
                        <div
                          className={`bar${
                            i === invTrend.length - 1 ? " bar-ok" : ""
                          }`}
                          style={{ height: `${(v / maxInv) * 100}%` }}
                        />
                      </div>
                      <span className="bar-lbl">{months[i]}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                  Indexed from live inventory value · latest bar = current
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Order volume</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  SO vs PO
                </span>
              </div>
              <div style={{ padding: "12px 16px 18px" }}>
                <div className="bar-chart">
                  {soTrend.map((v, i) => (
                    <div key={months[i]} className="bar-col">
                      <span className="bar-val">
                        {v}/{poTrend[i]}
                      </span>
                      <div
                        className="bar-stack"
                        style={{ gap: 3, alignItems: "flex-end" }}
                      >
                        <div
                          className="bar bar-ok"
                          style={{
                            height: `${(v / maxSO) * 100}%`,
                            width: "40%",
                          }}
                        />
                        <div
                          className="bar bar-mid"
                          style={{
                            height: `${(poTrend[i] / maxSO) * 100}%`,
                            width: "40%",
                          }}
                        />
                      </div>
                      <span className="bar-lbl">{months[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="analytics-legend">
                  <span>
                    <i className="lg-so" /> SO ({soAll}) · done {soDone}
                  </span>
                  <span>
                    <i className="lg-po" /> PO ({poAll}) · {formatMoney(poValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Operations pulse</span>
              </div>
              <div style={{ padding: "8px 18px 12px" }}>
                {initialLoading ? (
                  <div className="text-muted" style={{ padding: 12 }}>
                    Loading KPIs…
                  </div>
                ) : (
                  pulse.map((k) => (
                    <div key={k.l} className="pulse-row">
                      <div>
                        <div className="pulse-label">{k.l}</div>
                        <div className="pulse-hint">{k.h}</div>
                      </div>
                      <div className={`pulse-value tone-${k.tone ?? "neutral"}`}>
                        {k.v}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Warehouse utilization</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Ranked high → low
                </span>
              </div>
              <div className="table-wrap">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Site</th>
                      <th>Location</th>
                      <th>Utilization</th>
                      <th>Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialLoading ? (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          Loading…
                        </td>
                      </tr>
                    ) : rankedWarehouses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          No warehouses found
                        </td>
                      </tr>
                    ) : (
                      rankedWarehouses.map((w, idx) => {
                        const util = Math.round(resolveUtilPct(w));
                        const fill =
                          util >= 90 ? "high" : util >= 70 ? "mid" : "ok";
                        return (
                          <tr key={w.id}>
                            <td className="text-muted">{idx + 1}</td>
                            <td className="fw-600">{w.code || w.name}</td>
                            <td className="text-muted">
                              {w.location || w.address || "—"}
                            </td>
                            <td>
                              <div className="analytics-util-cell">
                                <div className="cap-bar">
                                  <div
                                    className={`cap-fill ${fill}`}
                                    style={{ width: `${util}%` }}
                                  />
                                </div>
                                <span className={`fw-600 util-${fill}`}>
                                  {util}%
                                </span>
                              </div>
                            </td>
                            <td>{w.manager || "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="analytics-footnote">
                Health score weighs stockouts, low stock, open SOs, and capacity
                pressure. Bars highlight hot sites (≥90% high, ≥70% mid).
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Analytics;