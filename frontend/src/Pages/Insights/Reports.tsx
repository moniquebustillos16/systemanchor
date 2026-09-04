import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePermissions } from "../../hooks/useCurrentUser";
import { useWarehouses } from "../../hooks/useWarehouses";
import "../css/Insights.css";



/* ── Role permissions ─────────────────────────────────────── */
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconFile = () => (
  <svg {...svg} width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconStar = ({ filled }: { filled?: boolean }) => (
  <svg {...svg} width="14" height="14" fill={filled ? "currentColor" : "none"}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconEye = () => (
  <svg {...svg} width="14" height="14">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconX = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconDownload = () => (
  <svg {...svg} width="14" height="14">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

type ReportDef = {
  id: string;
  t: string;
  d: string;
  cat: string;
  freq: string;
  how: string;
  endpoint: string;
  csvMode: "list" | "stats";
  /** Apply warehouse filter query when set */
  warehouseParam?: boolean;
};

const REPORTS: ReportDef[] = [
  {
    id: "inv",
    t: "Inventory Valuation",
    d: "On-hand qty × cost by SKU and warehouse.",
    cat: "Inventory",
    freq: "Daily",
    how: "GET /inventories — qty, price, stock_value.",
    endpoint: "/inventories?per_page=200",
    csvMode: "list",
    warehouseParam: true,
  },
  {
    id: "inv-stats",
    t: "Inventory Health Snapshot",
    d: "Totals: value, low stock, out of stock.",
    cat: "Inventory",
    freq: "Daily",
    how: "GET /inventories/stats.",
    endpoint: "/inventories/stats",
    csvMode: "stats",
  },
  {
    id: "stk",
    t: "Stock Movement Log",
    d: "All stock in / out / transfer / adjust posts.",
    cat: "Inventory",
    freq: "Daily",
    how: "GET /stock-movements.",
    endpoint: "/stock-movements?per_page=200",
    csvMode: "list",
  },
  {
    id: "cc",
    t: "Cycle Count Accuracy",
    d: "Variance and accuracy by count session.",
    cat: "Inventory",
    freq: "On demand",
    how: "GET /cycle-counts.",
    endpoint: "/cycle-counts",
    csvMode: "list",
  },
  {
    id: "tx",
    t: "Product Transactions",
    d: "Purchase, sale, receiving, shipment, return lines.",
    cat: "Inventory",
    freq: "Daily",
    how: "GET /product-transactions.",
    endpoint: "/product-transactions?per_page=200",
    csvMode: "list",
  },
  {
    id: "so",
    t: "Sales Performance",
    d: "Order count, revenue, and status mix.",
    cat: "Sales",
    freq: "Weekly",
    how: "GET /sales-orders.",
    endpoint: "/sales-orders?per_page=200",
    csvMode: "list",
    warehouseParam: true,
  },
  {
    id: "so-stats",
    t: "Sales Snapshot",
    d: "All / pending / done / total value.",
    cat: "Sales",
    freq: "Daily",
    how: "GET /sales-orders/stats.",
    endpoint: "/sales-orders/stats",
    csvMode: "stats",
  },
  {
    id: "ship",
    t: "Shipments Log",
    d: "Carrier, tracking, packages, delivery status.",
    cat: "Sales",
    freq: "Daily",
    how: "GET /shipments.",
    endpoint: "/shipments?per_page=200",
    csvMode: "list",
  },
  {
    id: "ret",
    t: "Returns (RMA)",
    d: "Return sessions, reason, disposition.",
    cat: "Sales",
    freq: "Weekly",
    how: "GET /returns.",
    endpoint: "/returns?per_page=200",
    csvMode: "list",
  },
  {
    id: "cus",
    t: "Customer Roster",
    d: "Customer master for order linkage.",
    cat: "Sales",
    freq: "Weekly",
    how: "GET /customers.",
    endpoint: "/customers?per_page=200",
    csvMode: "list",
  },
  {
    id: "po",
    t: "Purchase Analysis",
    d: "PO spend, open vs received, supplier totals.",
    cat: "Purchasing",
    freq: "Weekly",
    how: "GET /purchase-orders.",
    endpoint: "/purchase-orders?per_page=200",
    csvMode: "list",
    warehouseParam: true,
  },
  {
    id: "gr",
    t: "Goods Receipts",
    d: "Receiving sessions vs PO expected/received.",
    cat: "Purchasing",
    freq: "Daily",
    how: "GET /goods-receipts.",
    endpoint: "/goods-receipts?per_page=200",
    csvMode: "list",
    warehouseParam: true,
  },
  {
    id: "sup",
    t: "Supplier Scorecard",
    d: "Contacts, scores, and status.",
    cat: "Purchasing",
    freq: "Monthly",
    how: "GET /suppliers.",
    endpoint: "/suppliers?per_page=200",
    csvMode: "list",
  },
  {
    id: "wh",
    t: "Warehouse Utilization",
    d: "Capacity % and site profile per warehouse.",
    cat: "Warehouse",
    freq: "Daily",
    how: "GET /warehouses.",
    endpoint: "/warehouses?per_page=100",
    csvMode: "list",
  },
];

const CATS = ["All", "Inventory", "Sales", "Purchasing", "Warehouse"];

type RunLog = {
  id: string;
  title: string;
  at: string;
  rows: number;
  ok: boolean;
  format: string;
};

type PreviewState = {
  report: ReportDef;
  rows: Record<string, unknown>[];
};


function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join(
    "\n"
  );
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flattenRow(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const nested = v as Record<string, unknown>;
      if ("name" in nested) out[`${k}_name`] = nested.name;
      if ("code" in nested) out[`${k}_code`] = nested.code;
      if ("id" in nested) out[`${k}_id`] = nested.id;
    } else if (!Array.isArray(v)) {
      out[k] = v;
    }
  }
  return out;
}

function catAccent(cat: string): string {
  switch (cat) {
    case "Inventory":
      return "var(--sa-sage-deep)";
    case "Sales":
      return "var(--sa-brown)";
    case "Purchasing":
      return "var(--sa-warning)";
    case "Warehouse":
      return "var(--sa-tan)";
    default:
      return "var(--sa-muted)";
  }
}

function Reports() {
  const [cat, setCat] = useState("All");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sa-report-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [runningId, setRunningId] = useState<string | null>(null);
  const [history, setHistory] = useState<RunLog[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sa-report-history") || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(
    null
  );
  const [warehouseId, setWarehouseId] = useState("all");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [favOnly, setFavOnly] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();
  const { rows: warehouseRows } = useWarehouses({ perPage: 100 });

  const warehouses = useMemo(
    () =>
      warehouseRows.map((w) => ({
        id: String(w.id ?? ""),
        code: w.code != null ? String(w.code) : undefined,
        name: String(w.name ?? ""),
      })),
    [warehouseRows]
  );

  const canView = can("reports.view", "analytics.view");
  const canCreate = can("reports.create", "reports.export");
  const canUpdate = can("reports.update", "reports.export");

  useEffect(() => {
    localStorage.setItem("sa-report-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("sa-report-history", JSON.stringify(history.slice(0, 12)));
  }, [history]);

  const filtered = useMemo(() => {
    let list = [...REPORTS];
    if (cat !== "All") list = list.filter((r) => r.cat === cat);
    if (favOnly) list = list.filter((r) => favorites.includes(r.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.t.toLowerCase().includes(q) ||
          r.d.toLowerCase().includes(q) ||
          r.how.toLowerCase().includes(q) ||
          r.cat.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const fa = favorites.includes(a.id) ? 0 : 1;
      const fb = favorites.includes(b.id) ? 0 : 1;
      return fa - fb || a.t.localeCompare(b.t);
    });
    return list;
  }, [cat, search, favorites, favOnly]);

  const toggleFav = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const fetchReportRows = async (
    r: ReportDef
  ): Promise<Record<string, unknown>[]> => {
    // endpoint may include query string, e.g. "/inventories?per_page=200"
    const [path, qs] = r.endpoint.split("?");
    const params: Record<string, string> = {};
    if (qs) {
      new URLSearchParams(qs).forEach((v, k) => {
        params[k] = v;
      });
    }
    if (warehouseId !== "all" && r.warehouseParam) {
      params.warehouse_id = warehouseId;
    }

    const { data: json } = await api.get(path, {
      params: Object.keys(params).length ? params : undefined,
    });

    if (r.csvMode === "stats") {
      const data = (json?.data ?? json) as Record<string, unknown>;
      return [data];
    }

    const list = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : [];
    return list.map((item: Record<string, unknown>) => flattenRow(item));
  };

  const exportRows = (
    r: ReportDef,
    rows: Record<string, unknown>[],
    fmt: "csv" | "json"
  ) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const base = `${r.id}-${stamp}`;
    if (fmt === "json") {
      downloadBlob(
        `${base}.json`,
        new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" })
      );
    } else {
      const csv = toCsv(rows);
      if (!csv) throw new Error("No rows to export");
      downloadBlob(
        `${base}.csv`,
        new Blob([csv], { type: "text/csv;charset=utf-8;" })
      );
    }
  };

  const pushHistory = (r: ReportDef, rows: number, ok: boolean) => {
    setHistory((h) =>
      [
        {
          id: `${r.id}-${Date.now()}`,
          title: r.t,
          at: new Date().toLocaleString(),
          rows,
          ok,
          format,
        },
        ...h,
      ].slice(0, 12)
    );
  };

  const runReport = useCallback(
    async (r: ReportDef) => {
      if (!canCreate && !canUpdate) { showToast("error", "Permission denied", "You cannot export reports."); return; }
      setRunningId(r.id);
      try {
        const rows = await fetchReportRows(r);
        exportRows(r, rows, format);
        pushHistory(r, rows.length, true);
        showToast(
          "success",
          r.t,
          `Exported ${rows.length} row(s) as ${format.toUpperCase()}.`
        );
      } catch (err) {
        pushHistory(r, 0, false);
        showToast(
          "error",
          "Failed",
          err instanceof Error ? err.message : "Export failed"
        );
      } finally {
        setRunningId(null);
      }
    },
    [warehouseId, format]
  );

  const previewReport = async (r: ReportDef) => {
    if (!canView) { showToast("error", "Permission denied", "You cannot preview reports."); return; }
    setRunningId(r.id);
    try {
      const rows = await fetchReportRows(r);
      setPreview({ report: r, rows });
      showToast("info", "Preview", `${rows.length} row(s) loaded.`);
    } catch (err) {
      showToast(
        "error",
        "Preview failed",
        err instanceof Error ? err.message : "Could not load"
      );
    } finally {
      setRunningId(null);
    }
  };

  const runDailyPack = async () => {
    if (!canCreate && !canUpdate) { showToast("error", "Permission denied", "You cannot run report packs."); return; }
    const pack = REPORTS.filter((r) =>
      ["inv", "wh", "stk", "inv-stats", "so-stats"].includes(r.id)
    );
    showToast("info", "Daily pack", `Running ${pack.length} reports…`);
    for (const r of pack) {
      await runReport(r);
    }
  };

  const previewKeys = useMemo(() => {
    if (!preview?.rows.length) return [] as string[];
    return Object.keys(preview.rows[0]).slice(0, 8);
  }, [preview]);

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
                You do not have permission to view this page. Ask an admin to grant <code>reports.view</code>.
              </p>
            </div>
          )}
          <div className="page-header">
            <div>
              <h1 className="page-title">Reports</h1>
              <p className="page-subtitle">
                Live exports from WMS APIs — preview, filter, favorite, download
              </p>
            </div>
            <div className="page-actions">
              {(canCreate || canUpdate) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={runDailyPack}
                disabled={!!runningId}
              >
                <IconFile /> Run Daily Pack
              </button>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">How Reports Work</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div className="order-steps" style={{ marginBottom: 0 }}>
                <div className="order-step">
                  <span className="os-num">1</span>
                  <div>
                    <strong>Filters</strong>
                    <span>Warehouse + format</span>
                  </div>
                </div>
                <div className="order-step">
                  <span className="os-num">2</span>
                  <div>
                    <strong>Catalog</strong>
                    <span>Search or star favorites</span>
                  </div>
                </div>
                <div className="order-step">
                  <span className="os-num">3</span>
                  <div>
                    <strong>Preview</strong>
                    <span>Inspect rows first</span>
                  </div>
                </div>
                <div className="order-step">
                  <span className="os-num">4</span>
                  <div>
                    <strong>Export</strong>
                    <span>CSV or JSON download</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="report-toolbar card">
            <div className="table-search">
              <IconSearch />
              <input
                type="text"
                placeholder="Search reports…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="report-filter-label">
              Warehouse
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="all">All sites</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code ? `${w.code} — ${w.name}` : w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="report-filter-label">
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="report-fav-toggle">
              <input
                type="checkbox"
                checked={favOnly}
                onChange={(e) => setFavOnly(e.target.checked)}
              />
              Starred only
            </label>
            <span className="text-muted report-toolbar-meta">
              {filtered.length} report(s) · {favorites.length} starred
            </span>
          </div>

          <div className="cat-filter">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                className={`cat-chip-btn ${cat === c ? "active" : ""}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="report-grid">
            {filtered.length === 0 ? (
              <div className="card" style={{ padding: 24, gridColumn: "1 / -1" }}>
                No reports match your filters.
              </div>
            ) : (
              filtered.map((r) => {
                const fav = favorites.includes(r.id);
                const busy = runningId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`report-card${fav ? " is-fav" : ""}`}
                  >
                    <div className="report-card-top">
                      <span
                        className="report-cat"
                        style={{ color: catAccent(r.cat) }}
                      >
                        {r.cat}
                      </span>
                      <button
                        type="button"
                        className={`report-star${fav ? " on" : ""}`}
                        title={fav ? "Unstar" : "Star"}
                        onClick={() => toggleFav(r.id)}
                      >
                        <IconStar filled={fav} />
                      </button>
                    </div>
                    <div className="report-title">{r.t}</div>
                    <div className="report-desc">{r.d}</div>
                    <div className="report-meta">
                      <span className="report-freq">{r.freq}</span>
                      <div className="report-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={!!runningId}
                          onClick={() => previewReport(r)}
                          title="Preview"
                        >
                          <IconEye /> {busy ? "…" : "Preview"}
                        </button>
                        {(canCreate || canUpdate) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={!!runningId}
                          onClick={() => runReport(r)}
                        >
                          <IconDownload /> {busy ? "…" : "Run"}
                        </button>
                        )}
                      </div>
                    </div>
                    <div className="report-how">{r.how}</div>
                  </div>
                );
              })
            )}
          </div>

          {history.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">Recent runs</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setHistory([]);
                    showToast("info", "Cleared", "Run history cleared.");
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="table-wrap">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>When</th>
                      <th>Rows</th>
                      <th>Format</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="fw-600">{h.title}</td>
                        <td className="text-muted">{h.at}</td>
                        <td>{h.rows}</td>
                        <td className="text-muted">
                          {(h.format || "csv").toUpperCase()}
                        </td>
                        <td>
                          <span
                            className={`status-badge status-${
                              h.ok ? "active" : "cancelled"
                            }`}
                          >
                            {h.ok ? "ok" : "failed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div
            className="card report-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Report preview"
          >
            <div className="report-preview-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>
                  {preview.report.t}
                </h2>
                <p className="text-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {preview.rows.length} row(s) · showing first{" "}
                  {Math.min(25, preview.rows.length)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreview(null)}
              >
                <IconX />
              </button>
            </div>
            <div className="table-wrap report-preview-table">
              {preview.rows.length === 0 ? (
                <p className="text-muted" style={{ padding: 20 }}>
                  No rows returned.
                </p>
              ) : (
                <table className="orders-table">
                  <thead>
                    <tr>
                      {previewKeys.map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 25).map((row, i) => (
                      <tr key={i}>
                        {previewKeys.map((k) => (
                          <td key={k}>
                            {row[k] == null ? "—" : String(row[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="report-preview-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!preview.rows.length}
                onClick={() => {
                  try {
                    exportRows(preview.report, preview.rows, format);
                    pushHistory(preview.report, preview.rows.length, true);
                    showToast(
                      "success",
                      preview.report.t,
                      `Exported ${preview.rows.length} row(s).`
                    );
                    setPreview(null);
                  } catch (err) {
                    showToast(
                      "error",
                      "Export failed",
                      err instanceof Error ? err.message : "Could not export"
                    );
                  }
                }}
              >
                <IconDownload /> Export {format.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`orders-toast ${toast.type}`}>
          <button type="button" className="feedback-close" onClick={() => setToast(null)} aria-label="Close notification">×</button>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default Reports;