import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePermissions } from "../../hooks/useCurrentUser";
import { useWarehouses } from "../../hooks/useWarehouses";
import { queryKeys } from "../../lib/queryClient";
import { invalidateCycleCounts } from "../../lib/invalidate";
import "../css/Warehouse.css";

/* ── Types ─────────────────────────────────────────────────── */


type Warehouse = {
  id: string;
  code: string;
  name: string;
};

type Count = {
  id: string;
  code: string;
  warehouse_id: string;
  warehouse?: Warehouse | null;
  zone: string;
  scheduled_date: string;
  started_at: string | null;
  ended_at: string | null;
  counted: number;
  system_qty: number;
  variance: string | null;
  accuracy: number | null;
  counter: string | null;
  status: string;
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const ZONES = [
  "Zone A - Receiving",
  "Zone B - Bulk Storage",
  "Zone C - Picking",
  "Zone D - Shipping",
] as const;

/* ── Permission helpers ────────────────────────────────────── */
/* ── Domain helpers ────────────────────────────────────────── */
function getItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o?.data)) return o.data as unknown[];
  return [];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.includes("T")) return value.slice(0, 10);
  return value.slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isStarted(c: Count): boolean {
  return !!(c.started_at && c.started_at !== "—");
}

function varianceClass(v: string | null | undefined): string {
  if (v == null || v === "—" || v === "") return "";
  if (v === "0") return "var-pos";
  return String(v).startsWith("+") ? "var-pos" : "var-neg";
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

const IconPlus = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconRefresh = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconPlay = () => (
  <svg {...svg} width="14" height="14">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconCheck = () => (
  <svg {...svg} width="14" height="14">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconEdit = () => (
  <svg {...svg} width="14" height="14">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L21 3z" />
  </svg>
);

const IconTrash = () => (
  <svg {...svg} width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconX = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconClipboard = () => (
  <svg {...svg} width="16" height="16">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

/* ── Component ─────────────────────────────────────────────── */
function CycleCount() {
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [whFilter, setWhFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<Count | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [whId, setWhId] = useState("");
  const [zone, setZone] = useState<string>(ZONES[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counter, setCounter] = useState("");

  const [editCounted, setEditCounted] = useState(0);
  const [editSystem, setEditSystem] = useState(0);
  const [editCounter, setEditCounter] = useState("");
  const queryClient = useQueryClient();

  const countsQuery = useQuery({
    queryKey: queryKeys.cycleCounts,
    queryFn: async () => {
      const { data: json } = await api.get("/cycle-counts");
      return getItems(json) as Count[];
    },
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const rows = countsQuery.data ?? [];
  const loading = countsQuery.isLoading && rows.length === 0;

  const {
    rows: whRows,
    isLoading: whLoading,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true });

  const warehouses: Warehouse[] = useMemo(
    () =>
      (whRows ?? []).map((w: Record<string, unknown>) => ({
        id: String(w.id),
        code: String(w.code ?? ""),
        name: String(w.name ?? ""),
      })),
    [whRows]
  );

  // Default warehouse for schedule form once list arrives
  useEffect(() => {
    if (warehouses.length > 0) {
      setWhId((prev) => prev || warehouses[0].id);
    }
  }, [warehouses]);

  const showToast = useCallback(
    (type: ToastState["type"], title: string, msg: string) => {
      setToast({ type, title, msg });
      window.setTimeout(() => setToast(null), 3200);
    },
    []
  );

  /* ── Permissions ─────────────────────────────────────────── */
  const { can, isLoaded: permsLoaded } = usePermissions();

  const canView = can("cycle_counts.view", "cycle-counts.view");
  const canCreate = can("cycle_counts.create", "cycle-counts.create");
  const canUpdate = can("cycle_counts.update", "cycle-counts.update");
  const canDelete = canUpdate;

  /* ── Load cycle counts ───────────────────────────────────── */
  const loadCounts = useCallback(async () => {
    setError(null);
    const result = await countsQuery.refetch();
    if (result.error) {
      setError((result.error as Error)?.message || "Failed to load cycle counts");
    }
  }, [countsQuery]);

  /* ── Stats & filtered list ───────────────────────────────── */
  const stats = useMemo(() => {
    const completed = rows.filter((c) => c.status === "completed");
    const pending = rows.filter(
      (c) => c.status === "pending" || c.status === "draft"
    ).length;
    const inProgress = rows.filter(
      (c) => c.status === "pending" && isStarted(c)
    ).length;
    const avgAcc = completed.length
      ? (
          completed.reduce((s, c) => s + (Number(c.accuracy) || 0), 0) /
          completed.length
        ).toFixed(1)
      : "—";
    const openVar = completed.filter(
      (c) => c.variance != null && c.variance !== "0" && c.variance !== "—"
    ).length;
    return { all: rows.length, pending, inProgress, avgAcc, openVar };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const hay = [c.code, c.warehouse?.code, c.zone, c.counter]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (status === "in_progress") {
      list = list.filter((c) => c.status === "pending" && isStarted(c));
    } else if (status !== "all") {
      list = list.filter((c) => c.status === status);
    }
    if (whFilter !== "all") {
      list = list.filter((c) => String(c.warehouse_id) === whFilter);
    }
    return list;
  }, [rows, search, status, whFilter]);

  /* ── CRUD / actions ──────────────────────────────────────── */
  const schedule = async () => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot schedule cycle counts.");
      return;
    }
    if (!whId) {
      showToast("error", "Validation", "Select a warehouse.");
      return;
    }
    try {
      setSaving(true);
      const { data: body } = await api.post("/cycle-counts", {
        warehouse_id: whId,
        zone,
        scheduled_date: date,
        counter: counter.trim() || "Unassigned",
        status: "pending",
      });
      const created = (body?.data ?? body) as Count;
      queryClient.setQueryData<Count[]>(queryKeys.cycleCounts, (prev = []) => [created, ...prev]);
      void invalidateCycleCounts();
      setShowForm(false);
      setCounter("");
      showToast("success", "Scheduled", `${created.code ?? "Count"} scheduled.`);
      await loadCounts();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Could not schedule";
      showToast("error", "Failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const startCount = async (row: Count) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot update cycle counts.");
      return;
    }
    try {
      const { data: body } = await api.put(`/cycle-counts/${row.id}`, {
        started_at: nowTime(),
        status: "pending",
      });
      const updated = (body?.data ?? body) as Count;
      queryClient.setQueryData<Count[]>(queryKeys.cycleCounts, (prev = []) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r))
      );
      void invalidateCycleCounts();
      showToast("success", "Started", `${row.code} started at ${nowTime()}.`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Could not start";
      showToast("error", "Failed", msg);
    }
  };

  const openEdit = (row: Count) => {
    if (!canUpdate && row.status !== "completed") {
      showToast("error", "Permission denied", "You cannot edit cycle counts.");
      return;
    }
    setShowForm(false);
    setEditRow(row);
    setEditCounted(Number(row.counted) || 0);
    setEditSystem(Number(row.system_qty) || 0);
    setEditCounter(row.counter || "");
  };

  const saveEdit = async (complete = false) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot update cycle counts.");
      return;
    }
    if (!editRow) return;
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        counted: editCounted,
        system_qty: editSystem,
        counter: editCounter || editRow.counter,
      };
      if (complete) {
        payload.status = "completed";
        payload.ended_at = nowTime();
        if (!isStarted(editRow)) payload.started_at = nowTime();
      }
      const { data: body } = await api.put(`/cycle-counts/${editRow.id}`, payload);
      const updated = (body?.data ?? body) as Count;
      queryClient.setQueryData<Count[]>(queryKeys.cycleCounts, (prev = []) =>
        prev.map((r) => (r.id === editRow.id ? { ...r, ...updated } : r))
      );
      void invalidateCycleCounts();
      setEditRow(null);
      showToast(
        "success",
        complete ? "Completed" : "Saved",
        complete
          ? `${editRow.code} done · variance ${updated.variance ?? "—"}`
          : `${editRow.code} progress saved`
      );
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Could not save";
      showToast("error", "Failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteCount = async (row: Count) => {
    if (!canDelete) {
      showToast("error", "Permission denied", "You cannot delete cycle counts.");
      return;
    }
    if (!window.confirm(`Delete ${row.code}? This cannot be undone.`)) return;
    try {
      await api.delete(`/cycle-counts/${row.id}`);
      queryClient.setQueryData<Count[]>(queryKeys.cycleCounts, (prev = []) =>
        prev.filter((r) => r.id !== row.id)
      );
      void invalidateCycleCounts();
      showToast("success", "Deleted", `${row.code} removed.`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Could not delete";
      showToast("error", "Failed", msg);
    }
  };

  const liveVariance = useMemo(() => {
    const diff = editCounted - editSystem;
    if (editSystem === 0 && editCounted === 0) return "—";
    return diff > 0 ? `+${diff}` : String(diff);
  }, [editCounted, editSystem]);

  const liveAccuracy = useMemo(() => {
    if (editSystem <= 0) return editCounted === 0 ? "100" : "—";
    const acc = (1 - Math.abs(editCounted - editSystem) / editSystem) * 100;
    return Math.max(0, Math.round(acc * 10) / 10).toFixed(1);
  }, [editCounted, editSystem]);

  const handleRefresh = () => {
    void loadCounts();
    void refetchWarehouses();
    showToast("success", "Refreshed", "Counts reloaded.");
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
                <code>cycle_counts.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Cycle Count</h1>
              <p className="page-subtitle">
                Schedule, execute, and reconcile inventory counts across sites
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
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditRow(null);
                    setShowForm(true);
                  }}
                >
                  <IconPlus /> New Count
                </button>
              )}
            </div>
          </div>

          {error && (
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
              <span>{error}</span>
            </div>
          )}

          <div className="stats-grid stats-grid-5">
            <button
              type="button"
              className={`stat-card${status === "all" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
              onClick={() => setStatus("all")}
            >
              <div className="stat-label">Scheduled</div>
              <div className="stat-value">
                {loading ? "…" : stats.all.toLocaleString()}
              </div>
              <div className="stat-hint">All sessions</div>
            </button>
            <button
              type="button"
              className={`stat-card${status === "pending" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
              onClick={() => setStatus(status === "pending" ? "all" : "pending")}
            >
              <div className="stat-label">Pending</div>
              <div className="stat-value warning">
                {loading ? "…" : stats.pending.toLocaleString()}
              </div>
              <div className="stat-hint">Not finished</div>
            </button>
            <button
              type="button"
              className={`stat-card${status === "in_progress" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
              onClick={() =>
                setStatus(status === "in_progress" ? "all" : "in_progress")
              }
            >
              <div className="stat-label">In Progress</div>
              <div className="stat-value">
                {loading ? "…" : stats.inProgress.toLocaleString()}
              </div>
              <div className="stat-hint">Started counts</div>
            </button>
            <div className="stat-card">
              <div className="stat-label">Avg Accuracy</div>
              <div className="stat-value">
                {loading ? "…" : stats.avgAcc === "—" ? "—" : `${stats.avgAcc}%`}
              </div>
              <div className="stat-hint">Completed only</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open Variances</div>
              <div className={`stat-value${stats.openVar > 0 ? " warning" : ""}`}>
                {loading ? "…" : stats.openVar.toLocaleString()}
              </div>
              <div className="stat-hint">Non-zero variance</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Count Workflow</span>
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div className="workflow-steps">
                  <div className="wf-step done">
                    <span className="wf-num">1</span>
                    <div>
                      <strong>Plan</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Warehouse, zone &amp; date
                      </div>
                    </div>
                  </div>
                  <div className="wf-step done">
                    <span className="wf-num">2</span>
                    <div>
                      <strong>Assign</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Counter &amp; freeze moves
                      </div>
                    </div>
                  </div>
                  <div className="wf-step active">
                    <span className="wf-num">3</span>
                    <div>
                      <strong>Count</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Physical vs system qty
                      </div>
                    </div>
                  </div>
                  <div className="wf-step">
                    <span className="wf-num">4</span>
                    <div>
                      <strong>Reconcile</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Post variance adjustments
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Quick Actions</span>
              </div>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (!canCreate) {
                      showToast(
                        "error",
                        "Permission denied",
                        "You cannot schedule cycle counts."
                      );
                      return;
                    }
                    setEditRow(null);
                    setShowForm(true);
                  }}
                >
                  Schedule new cycle count
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    showToast(
                      "success",
                      "Freeze",
                      "Stock movements frozen for active count zones."
                    )
                  }
                >
                  Freeze movements (active zones)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    showToast(
                      "success",
                      "Reconcile",
                      "Variance adjustments posted to inventory."
                    )
                  }
                >
                  Post variance adjustments
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    showToast(
                      "info",
                      "Report",
                      "Accuracy report generated for completed counts."
                    )
                  }
                >
                  Generate accuracy report
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Count Sessions</span>
            </div>
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search ID, warehouse, zone, counter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search cycle counts"
                />
              </div>
              <div className="table-filters">
                <select
                  value={whFilter}
                  onChange={(e) => setWhFilter(e.target.value)}
                  aria-label="Filter by warehouse"
                >
                  <option value="all">All warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: 40, textAlign: "center" }} className="text-muted">
                  Loading cycle counts…
                </div>
              ) : (
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Count</th>
                      <th>Warehouse</th>
                      <th>Zone</th>
                      <th>Scheduled</th>
                      <th>Counter</th>
                      <th>Counted</th>
                      <th>System</th>
                      <th>Variance</th>
                      <th>Accuracy</th>
                      <th>Status</th>
                      <th style={{ width: 130, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="empty-row">
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 10,
                              padding: 16,
                            }}
                          >
                            <IconClipboard />
                            <span>No counts match your filters</span>
                            {canCreate && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setShowForm(true)}
                              >
                                <IconPlus /> Schedule count
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c) => {
                        const active = c.status === "pending" && isStarted(c);
                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="product-cell">
                                <div
                                  className="product-avatar"
                                  style={{
                                    background: active
                                      ? "rgba(196, 154, 90, 0.16)"
                                      : c.status === "completed"
                                        ? "rgba(90, 154, 110, 0.12)"
                                        : "rgba(196, 160, 122, 0.14)",
                                    color: active
                                      ? "var(--sa-warning)"
                                      : c.status === "completed"
                                        ? "var(--sa-sage-deep)"
                                        : "var(--sa-brown)",
                                  }}
                                >
                                  <IconClipboard />
                                </div>
                                <div>
                                  <div className="product-name">{c.code}</div>
                                  {active && (
                                    <div className="product-meta">
                                      Started {c.started_at}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>{c.warehouse?.code || "—"}</td>
                            <td>{c.zone}</td>
                            <td className="text-muted">
                              {formatDate(c.scheduled_date)}
                            </td>
                            <td>{c.counter || "—"}</td>
                            <td className="fw-600">
                              {c.counted != null && c.counted !== 0
                                ? c.counted
                                : "—"}
                            </td>
                            <td>{c.system_qty ?? "—"}</td>
                            <td className={`fw-600 ${varianceClass(c.variance)}`}>
                              {c.variance ?? "—"}
                            </td>
                            <td>
                              {c.accuracy != null ? `${c.accuracy}%` : "—"}
                            </td>
                            <td>
                              <span
                                className={`status-badge status-${
                                  c.status === "draft"
                                    ? "pending"
                                    : active
                                      ? "processing"
                                      : c.status
                                }`}
                              >
                                {active ? "in progress" : c.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                              {c.status !== "completed" && !isStarted(c) && canUpdate && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  title="Start count"
                                  onClick={() => void startCount(c)}
                                  style={{ marginRight: 4, padding: "6px 8px" }}
                                >
                                  <IconPlay />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                title={
                                  c.status === "completed" ? "View" : "Record / Edit"
                                }
                                onClick={() => openEdit(c)}
                                style={{ marginRight: 4, padding: "6px 8px" }}
                              >
                                <IconEdit />
                              </button>
                              {c.status !== "completed" && canDelete && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  title="Delete"
                                  onClick={() => void deleteCount(c)}
                                  style={{
                                    padding: "6px 8px",
                                    color: "var(--sa-clay)",
                                  }}
                                >
                                  <IconTrash />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && filtered.length > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Showing {filtered.length} of {rows.length} session
                  {rows.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Schedule modal */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 520,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflow: "auto",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-schedule-title"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  id="cc-schedule-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  Schedule Cycle Count
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  Pick site, zone, and assign a counter
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>
            <div className="form-grid-2">
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="cc-wh">Warehouse *</label>
                <select
                  id="cc-wh"
                  value={whId}
                  onChange={(e) => setWhId(e.target.value)}
                  disabled={saving}
                >
                  {warehouses.length === 0 ? (
                    <option value="">No warehouses</option>
                  ) : (
                    warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="cc-zone">Zone</label>
                <select
                  id="cc-zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  disabled={saving}
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="cc-date">Scheduled Date</label>
                <input
                  id="cc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="cc-counter">Assign Counter</label>
                <input
                  id="cc-counter"
                  type="text"
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                  placeholder="Staff name"
                  disabled={saving}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 22,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void schedule()}
                disabled={saving || !whId}
              >
                {saving ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record / complete modal */}
      {editRow && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setEditRow(null)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 520,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflow: "auto",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-edit-title"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  id="cc-edit-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  {editRow.status === "completed" ? "View Count" : "Record Count"}
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  {editRow.code} · {editRow.warehouse?.code ?? "—"} · {editRow.zone}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditRow(null)}
                disabled={saving}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>

            <div className="cc-live-strip">
              <div>
                <span className="meta-label">Variance</span>
                <span className={`fw-600 ${varianceClass(liveVariance)}`}>
                  {liveVariance}
                </span>
              </div>
              <div>
                <span className="meta-label">Accuracy</span>
                <span className="fw-600">{liveAccuracy}%</span>
              </div>
              <div>
                <span className="meta-label">Scheduled</span>
                <span>{formatDate(editRow.scheduled_date)}</span>
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: 16 }}>
              <div className="form-field">
                <label htmlFor="cc-counted">Physical Counted Qty</label>
                <input
                  id="cc-counted"
                  type="number"
                  min={0}
                  value={editCounted}
                  onChange={(e) =>
                    setEditCounted(parseFloat(e.target.value) || 0)
                  }
                  disabled={editRow.status === "completed" || saving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="cc-system">System Qty</label>
                <input
                  id="cc-system"
                  type="number"
                  min={0}
                  value={editSystem}
                  onChange={(e) =>
                    setEditSystem(parseFloat(e.target.value) || 0)
                  }
                  disabled={editRow.status === "completed" || saving}
                />
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="cc-edit-counter">Counter</label>
                <input
                  id="cc-edit-counter"
                  type="text"
                  value={editCounter}
                  onChange={(e) => setEditCounter(e.target.value)}
                  disabled={editRow.status === "completed" || saving}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 22,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditRow(null)}
                disabled={saving}
              >
                Close
              </button>
              {editRow.status !== "completed" && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void saveEdit(false)}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save Progress"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void saveEdit(true)}
                    disabled={saving}
                  >
                    <IconCheck /> {saving ? "Saving…" : "Complete Count"}
                  </button>
                </>
              )}
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

export default CycleCount;