import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidateWarehouses } from "../../lib/invalidate";
import "../css/Warehouse.css";

/* ── Types ─────────────────────────────────────────────────── */
type AuthPayload = {
  permissions?: string[];
  data?: { permissions?: string[]; user?: { permissions?: string[] } };
  user?: {
    permissions?: string[];
    role_id?: string;
    role?: { id?: string; permissions?: { name: string }[] };
  };
  role_id?: string;
};

type Warehouse = {
  id: string | number;
  code: string;
  name: string;
  location?: string;
  address?: string;
  manager?: string;
  capacity: number | string;
  utilized?: number | string;
  zones?: number;
  bins?: number;
  status: boolean | string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type FormData = {
  name: string;
  code: string;
  address: string;
  manager: string;
  capacity: string;
  status: boolean;
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Permission helpers ────────────────────────────────────── */
function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const j = json as AuthPayload;

  if (Array.isArray(j.permissions)) return j.permissions.map(String);
  if (Array.isArray(j.data?.permissions)) return j.data!.permissions!.map(String);
  if (Array.isArray(j.user?.permissions)) return j.user!.permissions!.map(String);

  const rolePerms = j.user?.role?.permissions;
  if (Array.isArray(rolePerms)) {
    return rolePerms
      .map((p) => (typeof p === "string" ? p : p?.name))
      .filter(Boolean) as string[];
  }

  const du = (j as { data?: { user?: { permissions?: string[] } } }).data?.user;
  if (Array.isArray(du?.permissions)) return du!.permissions!.map(String);

  return [];
}

function can(perms: string[], ...needed: string[]): boolean {
  if (perms.includes("*") || perms.includes("admin") || perms.includes("Admin")) {
    return true;
  }
  return needed.some((n) => perms.includes(n));
}

/* ── Domain helpers ────────────────────────────────────────── */
function isActive(status: boolean | string | undefined | null): boolean {
  return status === true || status === "active" || status === "Active";
}

function toNumber(value: number | string | undefined | null): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Treats `utilized` as absolute units used (matches current UI & stats). */
function utilizationPct(w: Warehouse): number | null {
  const cap = toNumber(w.capacity);
  if (cap <= 0) return null;
  const used = toNumber(w.utilized);
  return Math.min(100, Math.round((used / cap) * 100));
}

const EMPTY_FORM: FormData = {
  name: "",
  code: "",
  address: "",
  manager: "",
  capacity: "0",
  status: true,
};

/* ── Icons ─────────────────────────────────────────────────── */
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconPlus = () => (
  <svg {...svg} width="16" height="16">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconEdit = () => (
  <svg {...svg} width="15" height="15">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L21 3z" />
  </svg>
);

const IconTrash = () => (
  <svg {...svg} width="15" height="15">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconRefresh = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconX = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconWarehouse = () => (
  <svg {...svg} width="16" height="16">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-6h6v6" />
    <path d="M9 9h.01M15 9h.01" />
  </svg>
);

/* ── Component ─────────────────────────────────────────────── */
function Locations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const {
    rows: whRows,
    isLoading: whLoading,
    isError: whIsError,
    error: whError,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true });

  const warehouses = (whRows ?? []) as Warehouse[];
  const loading = whLoading && warehouses.length === 0;

  /* ── Toast ───────────────────────────────────────────────── */
  const showToast = useCallback((type: ToastState["type"], title: string, msg: string) => {
    setToast({ type, title, msg });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Permissions ─────────────────────────────────────────── */
  const fetchUserPermissions = useCallback(async () => {
    const finish = (list: string[]) => {
      setUserPermissions(list);
      setPermsLoaded(true);
    };

    try {
      for (const key of ["permissions", "user", "auth_user", "sa-user"]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string")) {
            finish(parsed as string[]);
            return;
          }
          const list = extractPermissions(parsed);
          if (list.length > 0) {
            finish(list);
            return;
          }
          const u = parsed?.data ?? parsed?.user ?? parsed;
          const rid = u?.role_id || u?.role?.id;
          if (rid) {
            try {
              const { data: json } = await api.get(`/roles/${rid}/permissions`);
              const perms = json?.data?.permissions ?? json?.permissions ?? json?.data ?? [];
              if (Array.isArray(perms)) {
                finish(
                  perms
                    .map((p: { name?: string } | string) =>
                      typeof p === "string" ? p : p?.name
                    )
                    .filter(Boolean) as string[]
                );
                return;
              }
            } catch {
              /* ignore role lookup failure */
            }
          }
        } catch {
          /* ignore bad localStorage JSON */
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const { data: json } = await api.get("/me");
      const list = extractPermissions(json);
      if (list.length > 0) {
        finish(list);
        return;
      }
    } catch {
      /* ignore */
    }

    finish(["*"]);
  }, []);

  useEffect(() => {
    void fetchUserPermissions();
  }, [fetchUserPermissions]);

  const canView = can(userPermissions, "warehouses.view", "locations.view");
  const canCreate = can(userPermissions, "warehouses.create", "locations.create");
  const canUpdate = can(userPermissions, "warehouses.update", "locations.update");
  const canDelete = canUpdate; // same gate as backend soft-delete path

  /* ── Stats & filtered list (client-side over full list) ──── */
  const stats = useMemo(() => {
    const list = Array.isArray(warehouses) ? warehouses : [];
    const totalCount = list.length;
    const activeCount = list.filter((w) => isActive(w.status)).length;
    const totalCapacity = list.reduce((sum, w) => sum + toNumber(w.capacity), 0);
    const totalUsed = list.reduce((sum, w) => sum + toNumber(w.utilized), 0);
    const avgUtil = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
    return { totalCount, activeCount, totalCapacity, totalUsed, avgUtil };
  }, [warehouses]);

  const filtered = useMemo(() => {
    let list = [...warehouses];

    if (statusFilter === "active") list = list.filter((w) => isActive(w.status));
    if (statusFilter === "inactive") list = list.filter((w) => !isActive(w.status));

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => {
        const hay = [w.name, w.code, w.location, w.address, w.manager]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return list.sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [warehouses, search, statusFilter]);

  /* ── Form open / close ───────────────────────────────────── */
  const openForm = useCallback(
    (warehouse?: Warehouse) => {
      if (warehouse ? !canUpdate : !canCreate) {
        showToast(
          "error",
          "Permission denied",
          warehouse ? "You cannot update warehouses." : "You cannot create warehouses."
        );
        return;
      }

      setFormError(null);

      if (warehouse) {
        setEditingId(warehouse.id);
        setFormData({
          name: warehouse.name || "",
          code: warehouse.code || "",
          address: warehouse.location || warehouse.address || "",
          manager: warehouse.manager || "",
          capacity: String(toNumber(warehouse.capacity)),
          status: isActive(warehouse.status),
        });
      } else {
        setEditingId(null);
        setFormData(EMPTY_FORM);
      }

      setShowForm(true);
    },
    [canCreate, canUpdate, showToast]
  );

  const closeForm = useCallback(() => {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }, [saving]);

  /* ── CRUD handlers ───────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError("Code and name are required.");
      return;
    }

    const capacity = Math.max(0, Number(formData.capacity) || 0);
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      address: formData.address.trim() || null,
      location: formData.address.trim() || null,
      manager: formData.manager.trim() || null,
      capacity,
      status: formData.status ? "active" : "inactive",
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/warehouses/${editingId}`, payload);
      } else {
        await api.post("/warehouses", payload);
      }

      showToast(
        "success",
        editingId ? "Updated" : "Created",
        `${payload.code} · ${payload.name}`
      );
      closeForm();
      void invalidateWarehouses();
      void refetchWarehouses();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: any } })?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        (err as Error)?.message ||
        "Failed to save warehouse";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (w: Warehouse) => {
    if (!canDelete) {
      showToast("error", "Permission denied", "You cannot delete warehouses.");
      return;
    }
    if (!window.confirm(`Delete warehouse ${w.code}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/warehouses/${w.id}`);
      showToast("success", "Deleted", `${w.code} removed`);
      void invalidateWarehouses();
      void refetchWarehouses();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "Could not delete";
      showToast("error", "Delete failed", msg);
    }
  };

  const handleRefresh = () => {
    void refetchWarehouses();
    showToast("success", "Refreshed", "Warehouses reloaded.");
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
                <code>warehouses.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Warehouses</h1>
              <p className="page-subtitle">
                Sites, capacity, and status · used across receiving, shipping, and stock
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
                  onClick={() => openForm()}
                >
                  <IconPlus /> New Warehouse
                </button>
              )}
            </div>
          </div>

          <div className="stats-grid">
            <button
              type="button"
              className={`stat-card${statusFilter === "all" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
              onClick={() => setStatusFilter("all")}
            >
              <div className="stat-label">Total Sites</div>
              <div className="stat-value">
                {loading ? "…" : stats.totalCount.toLocaleString()}
              </div>
              <div className="stat-hint">All warehouses</div>
            </button>

            <button
              type="button"
              className={`stat-card${statusFilter === "active" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
              onClick={() =>
                setStatusFilter(statusFilter === "active" ? "all" : "active")
              }
            >
              <div className="stat-label">Active</div>
              <div className="stat-value">
                {loading ? "…" : stats.activeCount.toLocaleString()}
              </div>
              <div className="stat-hint">Operational sites</div>
            </button>

            <div className="stat-card">
              <div className="stat-label">Total Capacity</div>
              <div className="stat-value">
                {loading ? "…" : stats.totalCapacity.toLocaleString()}
              </div>
              <div className="stat-hint">Units across sites</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Utilization</div>
              <div
                className={`stat-value${
                  stats.avgUtil >= 90
                    ? " danger"
                    : stats.avgUtil >= 70
                      ? " warning"
                      : ""
                }`}
              >
                {loading ? "…" : `${stats.avgUtil}%`}
              </div>
              <div className="stat-hint">
                {stats.totalUsed.toLocaleString()} used of{" "}
                {stats.totalCapacity.toLocaleString()}
              </div>
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

          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search code, name, address, manager…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search warehouses"
                />
              </div>
              <div className="table-filters">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "active" | "inactive")
                  }
                  aria-label="Filter by status"
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="table-wrap">
              {loading ? (
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Address</th>
                      <th>Capacity</th>
                      <th>Utilization</th>
                      <th>Status</th>
                      <th style={{ width: 110, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j}>
                            <div
                              style={{
                                width: j === 0 ? 140 : 64,
                                height: 12,
                                borderRadius: 6,
                                background:
                                  "linear-gradient(90deg, var(--sa-cream-2) 25%, var(--sa-beige) 50%, var(--sa-cream-2) 75%)",
                                backgroundSize: "200% 100%",
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtered.length === 0 ? (
                <div className="empty-row" style={{ padding: 40 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <IconWarehouse />
                    <p style={{ margin: 0, fontWeight: 550 }}>
                      {search || statusFilter !== "all"
                        ? "No warehouses match your filters"
                        : "No warehouses yet"}
                    </p>
                    {!search && statusFilter === "all" && canCreate && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => openForm()}
                      >
                        <IconPlus /> New Warehouse
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Address</th>
                      <th>Capacity</th>
                      <th>Utilization</th>
                      <th>Status</th>
                      <th style={{ width: 110, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => {
                      const pct = utilizationPct(w);
                      const fillClass =
                        pct == null ? "ok" : pct >= 90 ? "high" : pct >= 70 ? "mid" : "ok";

                      return (
                        <tr key={w.id}>
                          <td>
                            <div className="product-cell">
                              <div
                                className="product-avatar"
                                style={{
                                  background: isActive(w.status)
                                    ? "rgba(90, 154, 110, 0.12)"
                                    : "rgba(168, 152, 128, 0.14)",
                                  color: isActive(w.status)
                                    ? "var(--sa-sage-deep)"
                                    : "var(--sa-muted)",
                                }}
                              >
                                <IconWarehouse />
                              </div>
                              <div>
                                <div className="product-name">
                                  {w.code}
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      color: "var(--sa-muted)",
                                      marginLeft: 8,
                                    }}
                                  >
                                    {w.name}
                                  </span>
                                </div>
                                {w.manager && (
                                  <div className="product-meta">Mgr · {w.manager}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-muted">
                            {w.location || w.address || "—"}
                          </td>
                          <td className="fw-600">
                            {toNumber(w.capacity).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td style={{ minWidth: 120 }}>
                            {pct != null ? (
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 12,
                                    marginBottom: 4,
                                  }}
                                >
                                  <span className="text-muted">
                                    {toNumber(w.utilized).toLocaleString()} used
                                  </span>
                                  <span className="fw-600">{pct}%</span>
                                </div>
                                <div className="cap-bar">
                                  <div
                                    className={`cap-fill ${fillClass}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                isActive(w.status) ? "status-active" : "status-cancelled"
                              }`}
                            >
                              {isActive(w.status) ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {canUpdate && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => openForm(w)}
                                title="Edit"
                                style={{ marginRight: 6, padding: "6px 8px" }}
                              >
                                <IconEdit />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => void handleDelete(w)}
                                title="Delete"
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
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filtered.length > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Showing {filtered.length} of {warehouses.length} warehouse
                  {warehouses.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modal form ──────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflow: "auto",
            }}
            role="dialog"
            aria-labelledby="wh-form-title"
            aria-modal="true"
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
                  id="wh-form-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  {editingId ? "Edit Warehouse" : "New Warehouse"}
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  Code, capacity, and site details
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "11px 14px",
                  background: "rgba(184, 92, 74, 0.1)",
                  color: "var(--sa-clay)",
                  borderRadius: 10,
                  fontSize: 13,
                  border: "1px solid rgba(184, 92, 74, 0.2)",
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="wh-code">Code *</label>
                  <input
                    id="wh-code"
                    type="text"
                    placeholder="e.g. WH-NAGA"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, code: e.target.value }))
                    }
                    required
                    disabled={saving}
                    autoComplete="off"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="wh-capacity">Capacity (units) *</label>
                  <input
                    id="wh-capacity"
                    type="number"
                    min={0}
                    step="1"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, capacity: e.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="wh-name">Name *</label>
                  <input
                    id="wh-name"
                    type="text"
                    placeholder="e.g. Naga Main Hub"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, name: e.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="wh-address">Address / Location</label>
                  <input
                    id="wh-address"
                    type="text"
                    placeholder="Street, city, province"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, address: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="wh-manager">Manager</label>
                  <input
                    id="wh-manager"
                    type="text"
                    placeholder="Site manager name"
                    value={formData.manager}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, manager: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="wh-status">Status</label>
                  <select
                    id="wh-status"
                    value={formData.status ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        status: e.target.value === "active",
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Update Warehouse"
                      : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`orders-toast ${toast.type}`}>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default Locations;