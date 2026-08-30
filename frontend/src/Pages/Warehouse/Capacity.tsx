import { useCallback, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidateWarehouses } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Warehouse.css";

/* ── Types ─────────────────────────────────────────────────── */


type Warehouse = {
  id: string | number;
  code: string;
  name: string;
  location?: string;
  address?: string;
  manager?: string;
  capacity: number | string;
  utilized?: number | string;
  status?: boolean | string;
};

type CapRow = {
  id: string | number;
  code: string;
  name: string;
  location: string;
  manager: string;
  capacity: number;
  /** Absolute units used */
  used: number;
  /** 0–100 */
  pct: number;
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Permission helpers ────────────────────────────────────── */
/* ── Domain helpers ────────────────────────────────────────── */
function toNumber(value: number | string | undefined | null): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * API may store `utilized` as units or as a 0–100 percentage.
 * If value ≤ 100 and capacity is much larger, treat as percent.
 */
function resolveUsage(
  capacity: number,
  utilizedRaw: number
): { used: number; pct: number } {
  if (capacity <= 0) {
    return { used: 0, pct: 0 };
  }
  if (utilizedRaw >= 0 && utilizedRaw <= 100 && capacity > 100) {
    const pct = Math.min(100, utilizedRaw);
    return { used: (pct / 100) * capacity, pct };
  }
  const used = Math.max(0, utilizedRaw);
  const pct = Math.min(100, (used / capacity) * 100);
  return { used, pct };
}

function fillClass(pct: number): "high" | "mid" | "ok" {
  if (pct >= 70) return "high";
  if (pct >= 50) return "mid";
  return "ok";
}

/* ── Icons ─────────────────────────────────────────────────── */
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconRefresh = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconWarehouse = () => (
  <svg {...svg} width="16" height="16">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

/* ── Component ─────────────────────────────────────────────── */
function Capacity() {
  const [sortBy, setSortBy] = useState<"pct" | "code" | "capacity">("pct");
  const [toast, setToast] = useState<ToastState | null>(null);

  const {
    rows: whRows,
    isLoading: whLoading,
    isError: whIsError,
    error: whError,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true });

  const warehouses = (whRows ?? []) as Warehouse[];
  const loading = whLoading && warehouses.length === 0;

  const showToast = useCallback(
    (type: ToastState["type"], title: string, msg: string) => {
      setToast({ type, title, msg });
      window.setTimeout(() => setToast(null), 2800);
    },
    []
  );

  /* ── Permissions ─────────────────────────────────────────── */
  const { can, isLoaded: permsLoaded } = usePermissions();

  const canView = can("capacity.view", "warehouses.view");

  /* ── Derived rows & stats ────────────────────────────────── */
  const list: CapRow[] = useMemo(() => {
    return warehouses.map((w) => {
      const capacity = toNumber(w.capacity);
      const { used, pct } = resolveUsage(capacity, toNumber(w.utilized));
      return {
        id: w.id,
        code: w.code || "—",
        name: w.name || "—",
        location: w.location || w.address || "—",
        manager: w.manager || "—",
        capacity,
        used,
        pct: Math.round(pct * 10) / 10,
      };
    });
  }, [warehouses]);

  const sorted = useMemo(() => {
    const rows = [...list];
    if (sortBy === "pct") rows.sort((a, b) => b.pct - a.pct);
    else if (sortBy === "capacity") rows.sort((a, b) => b.capacity - a.capacity);
    else
      rows.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" })
      );
    return rows;
  }, [list, sortBy]);

  const stats = useMemo(() => {
    const count = list.length;
    if (count === 0) {
      return { sites: 0, avg: 0, totalCap: 0, totalUsed: 0, high: 0 };
    }
    const totalCap = list.reduce((s, w) => s + w.capacity, 0);
    const totalUsed = list.reduce((s, w) => s + w.used, 0);
    const avg = totalCap > 0 ? Math.round((totalUsed / totalCap) * 1000) / 10 : 0;
    const high = list.filter((w) => w.pct >= 70).length;
    return {
      sites: count,
      avg,
      totalCap: Math.round(totalCap),
      totalUsed: Math.round(totalUsed),
      high,
    };
  }, [list]);

  const maxPct = useMemo(
    () => Math.max(100, ...list.map((w) => w.pct), 1),
    [list]
  );

  const handleRefresh = () => {
    void invalidateWarehouses();
    void refetchWarehouses();
    showToast("success", "Refreshed", "Capacity data reloaded.");
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="warehouse-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {permsLoaded && !canView && (
            <div
              className="card"
              style={{ padding: 40, textAlign: "center", marginBottom: 16 }}
            >
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
              <p className="text-muted" style={{ margin: 0 }}>
                You do not have permission to view this page. Ask an admin to grant{" "}
                <code>capacity.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Warehouse Capacity</h1>
              <p className="page-subtitle">
                Space utilization across the network · weighted by site capacity
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
                disabled={loading || whLoading}
              >
                <IconRefresh /> Refresh
              </button>
            </div>
          </div>

          {whIsError && (
            <div
              className="card"
              style={{
                padding: "14px 18px",
                marginBottom: 16,
                borderColor: "rgba(184, 92, 74, 0.35)",
                background: "rgba(184, 92, 74, 0.06)",
              }}
            >
              <strong style={{ color: "var(--sa-clay)" }}>API error:</strong>{" "}
              <span>
                {(whError as Error)?.message || "Failed to load warehouses"}
              </span>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Sites</div>
              <div className="stat-value">
                {loading ? "…" : stats.sites.toLocaleString()}
              </div>
              <div className="stat-hint">Warehouses tracked</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Utilization</div>
              <div
                className={`stat-value${
                  stats.avg >= 70 ? " danger" : stats.avg >= 50 ? " warning" : ""
                }`}
              >
                {loading ? "…" : `${stats.avg}%`}
              </div>
              <div className="stat-hint">Capacity-weighted</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Capacity</div>
              <div className="stat-value">
                {loading ? "…" : stats.totalCap.toLocaleString()}
              </div>
              <div className="stat-hint">
                {loading ? "…" : `${stats.totalUsed.toLocaleString()} units used`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">High Load (≥70%)</div>
              <div className="stat-value warning">
                {loading ? "…" : stats.high}
              </div>
              <div className="stat-hint">Sites near capacity</div>
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p className="text-muted" style={{ margin: 0 }}>
                Loading capacity data…
              </p>
            </div>
          ) : list.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <IconWarehouse />
              <p style={{ margin: "12px 0 0", fontWeight: 550 }}>
                No warehouses found
              </p>
              <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                Add sites under Warehouses to track capacity.
              </p>
            </div>
          ) : (
            <>
              <div className="charts-grid">
                {/* Vertical bar chart */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Utilization by Warehouse</span>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      Sorted by load
                    </span>
                  </div>
                  <div className="cap-chart-body">
                    <div className="bar-chart">
                      {[...list]
                        .sort((a, b) => b.pct - a.pct)
                        .map((w) => (
                          <div
                            key={w.id || w.code}
                            className="bar-col"
                            title={`${w.code} · ${w.name} · ${w.pct}%`}
                          >
                            <span className="bar-val">{w.pct}%</span>
                            <div className="bar-stack">
                              <div
                                className={`bar bar-${fillClass(w.pct)}`}
                                style={{
                                  height: `${Math.max(4, (w.pct / maxPct) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="bar-lbl">
                              {(w.code || "").replace(/^WH-?/i, "") || "—"}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Horizontal capacity summary */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Capacity Summary</span>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      {stats.totalUsed.toLocaleString()} /{" "}
                      {stats.totalCap.toLocaleString()} units
                    </span>
                  </div>
                  <div className="cap-chart-body">
                    <div className="cap-list">
                      {[...list]
                        .sort((a, b) => b.pct - a.pct)
                        .map((w) => (
                          <div key={w.id || w.code} className="cap-item">
                            <div className="cap-row-top">
                              <div className="cap-identity">
                                <span className="cap-code">{w.code}</span>
                                <span className="cap-name">
                                  {w.name}
                                  {w.manager !== "—" ? ` · ${w.manager}` : ""}
                                </span>
                              </div>
                              <span className="cap-meta">
                                <strong>{w.pct}%</strong>
                                <span className="text-muted">
                                  {" "}
                                  of {w.capacity.toLocaleString()}
                                </span>
                              </span>
                            </div>
                            <div className="cap-bar">
                              <div
                                className={`cap-fill ${fillClass(w.pct)}`}
                                style={{ width: `${Math.min(w.pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail table */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Site Details</span>
                  <div className="table-filters">
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as "pct" | "code" | "capacity")
                      }
                      aria-label="Sort sites"
                    >
                      <option value="pct">Sort by utilization</option>
                      <option value="capacity">Sort by capacity</option>
                      <option value="code">Sort by code</option>
                    </select>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Warehouse</th>
                        <th>Location</th>
                        <th>Capacity</th>
                        <th>Used</th>
                        <th>Utilization</th>
                        <th>Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((w) => (
                        <tr key={w.id || w.code}>
                          <td>
                            <div className="product-cell">
                              <div
                                className="product-avatar"
                                style={{
                                  background:
                                    w.pct >= 70
                                      ? "rgba(184, 92, 74, 0.12)"
                                      : w.pct >= 50
                                        ? "rgba(196, 154, 90, 0.14)"
                                        : "rgba(90, 154, 110, 0.12)",
                                  color:
                                    w.pct >= 70
                                      ? "var(--sa-clay)"
                                      : w.pct >= 50
                                        ? "var(--sa-warning)"
                                        : "var(--sa-sage-deep)",
                                }}
                              >
                                <IconWarehouse />
                              </div>
                              <div>
                                <div className="product-name">{w.code}</div>
                                <div className="product-meta">{w.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-muted">{w.location}</td>
                          <td className="fw-600">
                            {w.capacity.toLocaleString()}
                          </td>
                          <td>{Math.round(w.used).toLocaleString()}</td>
                          <td style={{ minWidth: 140 }}>
                            <div className="cap-util-cell">
                              <span className="fw-600">{w.pct}%</span>
                              <div className="cap-bar cap-bar-sm">
                                <div
                                  className={`cap-fill ${fillClass(w.pct)}`}
                                  style={{ width: `${Math.min(w.pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>{w.manager}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className={`orders-toast ${toast.type}`}>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default Capacity;