import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useUsers, useUserStats, useRoles } from "../../hooks/useUsers";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidateUsers } from "../../lib/invalidate";
import "../css/System.css";

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

const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconWarehouse = () => (
  <svg {...svg} width="14" height="14">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const IconX = () => (
  <svg {...svg} width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type Role = { id: string; name: string };
type Warehouse = { id: string; name: string; code?: string; location?: string | null };

type User = {
  id: string;
  name: string;
  email: string;
  role_id: string | null;
  warehouse_id?: string | null;
  access_all_warehouses?: boolean;
  status: string;
  last_login_at: string | null;
  role?: Role | null;
  warehouse?: Warehouse | null;
  warehouses?: Warehouse[] | null;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role_id: string;
  warehouse_ids: string[];
  access_all_warehouses: boolean;
  status: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function userWarehouseIds(u: User): string[] {
  if (u.warehouses?.length) return u.warehouses.map((w) => w.id);
  if (u.warehouse_id) return [u.warehouse_id];
  if (u.warehouse?.id) return [u.warehouse.id];
  return [];
}

function userPrimaryWarehouse(u: User): Warehouse | null {
  return u.warehouse || u.warehouses?.[0] || null;
}

function normalizeUser(raw: Record<string, unknown>): User {
  const roleRaw = raw.role as Record<string, unknown> | null | undefined;
  const whRaw = raw.warehouse as Record<string, unknown> | null | undefined;
  const whsRaw = Array.isArray(raw.warehouses)
    ? (raw.warehouses as Record<string, unknown>[])
    : null;

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    role_id:
      raw.role_id != null
        ? String(raw.role_id)
        : roleRaw?.id != null
          ? String(roleRaw.id)
          : null,
    warehouse_id: raw.warehouse_id != null ? String(raw.warehouse_id) : null,
    access_all_warehouses: !!raw.access_all_warehouses,
    status: String(raw.status ?? "active"),
    last_login_at: (raw.last_login_at as string | null) ?? null,
    role: roleRaw
      ? { id: String(roleRaw.id ?? ""), name: String(roleRaw.name ?? "") }
      : null,
    warehouse: whRaw
      ? {
          id: String(whRaw.id ?? ""),
          name: String(whRaw.name ?? ""),
          code: whRaw.code != null ? String(whRaw.code) : undefined,
          location:
            (whRaw.location as string | null) ??
            (whRaw.address as string | null) ??
            null,
        }
      : null,
    warehouses: whsRaw
      ? whsRaw.map((w) => ({
          id: String(w.id ?? ""),
          name: String(w.name ?? ""),
          code: w.code != null ? String(w.code) : undefined,
          location:
            (w.location as string | null) ??
            (w.address as string | null) ??
            null,
        }))
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = Partial<Record<keyof UserForm | "general", string>>;

function validateUserForm(
  form: UserForm,
  editing: User | null,
  existingUsers: User[]
): FormErrors {
  const errors: FormErrors = {};

  const name = form.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < 2) {
    errors.name = "Name must be at least 2 characters.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  const email = form.email.trim().toLowerCase();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  } else {
    const dup = existingUsers.some(
      (u) =>
        u.email.toLowerCase() === email && (!editing || u.id !== editing.id)
    );
    if (dup) errors.email = "A user with this email already exists.";
  }

  if (!editing) {
    if (!form.password) {
      errors.password = "Password is required for new users.";
    } else if (form.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    } else if (form.password.length > 128) {
      errors.password = "Password is too long.";
    }
  } else if (form.password) {
    if (form.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    } else if (form.password.length > 128) {
      errors.password = "Password is too long.";
    }
  }

  if (!form.access_all_warehouses && form.warehouse_ids.length === 0) {
    errors.warehouse_ids =
      "Assign at least one warehouse, or enable “Access all warehouses”.";
  }

  if (!["active", "inactive", "suspended"].includes(form.status)) {
    errors.status = "Invalid status.";
  }

  return errors;
}

function firstFormError(errors: FormErrors): string | null {
  const order: (keyof FormErrors)[] = [
    "name",
    "email",
    "password",
    "role_id",
    "warehouse_ids",
    "status",
    "general",
  ];
  for (const k of order) {
    if (errors[k]) return errors[k]!;
  }
  return null;
}

function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong"
): string {
  if (!err) return fallback;
  const e = err as any;
  if (
    e?.name === "CanceledError" ||
    e?.code === "ERR_CANCELED" ||
    e?.name === "AbortError"
  ) {
    return "";
  }
  const msg =
    e?.response?.data?.message ||
    (e?.response?.data?.errors &&
      Object.values(e.response.data.errors).flat().filter(Boolean).join(" ")) ||
    e?.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : fallback;
}

/* ── Warehouses via shared query key ─────────────────────────── */
function Users() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [toast, setToast] = useState<{
    type: string;
    title: string;
    msg: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({
    name: "",
    email: "",
    password: "",
    role_id: "",
    warehouse_ids: [],
    access_all_warehouses: false,
    status: "active",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const showToast = useCallback(
    (type: string, title: string, msg: string) => {
      setToast({ type, title, msg });
      setTimeout(() => setToast(null), 2800);
    },
    []
  );

  /* ── Data via TanStack Query ──────────────────────────────── */
  const usersQ = useUsers({
    page: 1,
    perPage: 200,
    search: "",
    status: status === "all" ? "" : status,
    roleId: roleFilter === "all" ? null : roleFilter,
    warehouseId: warehouseFilter === "all" ? null : warehouseFilter,
  });

  const statsQ = useUserStats();
  const rolesQ = useRoles();
  const warehousesQ = useWarehouses({ enabled: true, perPage: 200 });

  const users = useMemo(
    () => (usersQ.rows as Record<string, unknown>[]).map(normalizeUser),
    [usersQ.rows]
  );

  const roles = useMemo(
    () =>
      (rolesQ.rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
      })),
    [rolesQ.rows]
  );

  /* Always an array — shared warehouse cache may hold raw API shapes from other pages */
  const warehouses: Warehouse[] = useMemo(() => {
    const rows = warehousesQ.rows ?? [];
    if (!Array.isArray(rows)) return [];
    return rows
      .map((w) => ({
        id: String(w.id ?? ""),
        name: String(w.name ?? w.code ?? ""),
        code: w.code != null ? String(w.code) : undefined,
        location:
          (w.location as string | null | undefined) ??
          (w.address as string | null | undefined) ??
          null,
      }))
      .filter((w) => w.id);
  }, [warehousesQ.rows]);

  const stats = statsQ.stats;

  const loading = usersQ.isLoading && users.length === 0;
  const error =
    usersQ.isError && users.length === 0
      ? getErrorMessage(usersQ.error, "Unable to load users")
      : null;

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  /* Client-side search – same as original */
  const filteredUsers = useMemo(() => {
    let list = users;
    if (warehouseFilter !== "all") {
      list = list.filter(
        (u) =>
          u.access_all_warehouses ||
          u.warehouse_id === warehouseFilter ||
          u.warehouse?.id === warehouseFilter ||
          u.warehouses?.some((w) => w.id === warehouseFilter)
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role?.name || "").toLowerCase().includes(q)
    );
  }, [users, search, warehouseFilter]);

  const withWarehouseCount = useMemo(
    () =>
      filteredUsers.filter(
        (u) =>
          u.access_all_warehouses ||
          userWarehouseIds(u).length > 0 ||
          !!u.warehouse_id
      ).length,
    [filteredUsers]
  );

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, Warehouse>();
    if (!Array.isArray(warehouses)) return m;
    for (const w of warehouses) {
      if (w?.id) m.set(w.id, w);
    }
    return m;
  }, [warehouses]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role_id: "",
      warehouse_ids: [],
      access_all_warehouses: false,
      status: "active",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      name: u.name || "",
      email: u.email || "",
      password: "",
      role_id: u.role_id || u.role?.id || "",
      warehouse_ids: userWarehouseIds(u),
      access_all_warehouses: !!u.access_all_warehouses,
      status: u.status || "active",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const updateFormField = <K extends keyof UserForm>(
    key: K,
    value: UserForm[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateUserForm(form, editing, users);
    setFormErrors(errors);
    const top = firstFormError(errors);
    if (top) {
      showToast("error", "Validation", top);
      return;
    }

    setSaving(true);
    try {
      const allIds = warehouses.map((w) => w.id);
      const selectedAll =
        !form.access_all_warehouses &&
        allIds.length > 0 &&
        allIds.every((id) => form.warehouse_ids.includes(id));

      const accessAll = form.access_all_warehouses || selectedAll;
      const warehouseIds = accessAll
        ? []
        : [...new Set(form.warehouse_ids.filter(Boolean))];

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role_id: form.role_id || null,
        access_all_warehouses: accessAll,
        warehouse_id: accessAll ? null : warehouseIds[0] || null,
        warehouse_ids: accessAll ? [] : warehouseIds,
        status: form.status || "active",
      };
      if (form.password) payload.password = form.password;

      let body: any;
      if (editing) {
        body = (await api.put(`/users/${editing.id}`, payload)).data;
      } else {
        body = (await api.post("/users", payload)).data;
      }

      const savedId: string | undefined =
        body?.data?.id || editing?.id || body?.id;
      if (savedId) {
        try {
          await api.put(`/users/${savedId}/warehouses`, {
            access_all_warehouses: accessAll,
            warehouse_ids: warehouseIds,
          });
        } catch {
          /* optional */
        }
      }

      showToast(
        "success",
        editing ? "Updated" : "Created",
        editing ? "User updated." : "User created."
      );
      setModalOpen(false);
      setFormErrors({});
      await invalidateUsers();
      await Promise.all([usersQ.refetch(), statsQ.refetch()]);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Save failed");
      showToast("error", "Error", msg || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      showToast("success", "Deleted", `"${u.name}" removed.`);
      await invalidateUsers();
      await Promise.all([usersQ.refetch(), statsQ.refetch()]);
    } catch (err: unknown) {
      showToast(
        "error",
        "Error",
        getErrorMessage(err, "Delete failed") || "Delete failed"
      );
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setRoleFilter("all");
    setWarehouseFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    status !== "all" ||
    roleFilter !== "all" ||
    warehouseFilter !== "all";

  const toggleWarehouse = (id: string) => {
    setForm((f) => ({
      ...f,
      warehouse_ids: f.warehouse_ids.includes(id)
        ? f.warehouse_ids.filter((x) => x !== id)
        : [...f.warehouse_ids, id],
    }));
    setFormErrors((prev) => {
      if (!prev.warehouse_ids) return prev;
      const next = { ...prev };
      delete next.warehouse_ids;
      return next;
    });
  };

  return (
    <div className="system-page">
      <style>{`
        @media (max-width: 520px) {
          .users-modal .roles-form-grid {
            grid-template-columns: 1fr !important;
          }
          .users-modal .roles-modal-actions-right {
            width: 100%;
          }
          .users-modal .roles-modal-actions-right .btn {
            flex: 1;
          }
        }
      `}</style>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Users</h1>
              <p className="page-subtitle">
                Accounts with role and warehouse access
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreate}
              >
                <IconPlus /> Add User
              </button>
            </div>
          </div>

          <div className="stats-grid users-stats">
            <div className="stat-card">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{stats.all}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value users-stat-active">
                {stats.active}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With warehouse</div>
              <div className="stat-value">{withWarehouseCount}</div>
              <div className="stat-hint">On current list</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Warehouses</div>
              <div className="stat-value">
                {warehouses.length || "—"}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-toolbar users-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="search"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search users"
                />
              </div>
              <div className="table-filters users-filters">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                >
                  <option value="all">All roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  aria-label="Filter by warehouse"
                >
                  <option value="all">All warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.code ? ` (${w.code})` : ""}
                    </option>
                  ))}
                </select>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="table-wrap">
              <table className="orders-table users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Warehouse</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <span className="users-spinner" />
                          Loading users…
                        </div>
                      </td>
                    </tr>
                  ) : error && users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <p>{error}</p>
                          <p className="text-muted" style={{ fontSize: 13 }}>
                            Check your connection and try again.
                          </p>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{ marginTop: 8 }}
                            onClick={() => usersQ.refetch()}
                          >
                            Retry now
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <p>
                            {hasActiveFilters
                              ? "No users match your filters."
                              : loading
                                ? "Loading users…"
                                : "No users yet."}
                          </p>
                          {hasActiveFilters ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={clearFilters}
                            >
                              Clear filters
                            </button>
                          ) : (
                            !loading && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={openCreate}
                              >
                                <IconPlus /> Add User
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const whIds = userWarehouseIds(u);
                      const primary =
                        userPrimaryWarehouse(u) ||
                        (u.warehouse_id
                          ? warehouseNameById.get(u.warehouse_id) ?? null
                          : null);
                      const multiNames =
                        u.warehouses && u.warehouses.length > 0
                          ? u.warehouses.map((w) => w.name)
                          : (whIds
                              .map((id) => warehouseNameById.get(id)?.name)
                              .filter(Boolean) as string[]);
                      const multiCount = Math.max(
                        u.warehouses?.length ?? 0,
                        whIds.length,
                        primary ? 1 : 0
                      );

                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar">
                                {initials(u.name)}
                              </div>
                              <span className="fw-600">{u.name}</span>
                            </div>
                          </td>
                          <td className="text-muted">{u.email}</td>
                          <td>
                            {u.role?.name ? (
                              <span className="users-role-chip">
                                {u.role.name}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {u.access_all_warehouses ? (
                              <span className="role-wh-all">
                                All warehouses
                              </span>
                            ) : multiCount > 1 ? (
                              <span
                                className="user-wh-chip"
                                title={
                                  multiNames.join(", ") ||
                                  `${multiCount} warehouses`
                                }
                              >
                                <IconWarehouse />
                                <span>
                                  {multiNames[0] ||
                                    primary?.name ||
                                    "Warehouse"}
                                  <span className="text-muted">
                                    {" "}
                                    +{multiCount - 1}
                                  </span>
                                </span>
                              </span>
                            ) : primary ? (
                              <span
                                className="user-wh-chip"
                                title={
                                  primary.location || primary.code || ""
                                }
                              >
                                <IconWarehouse />
                                <span>{primary.name}</span>
                                {primary.code && (
                                  <span
                                    className="track-code"
                                    style={{ marginLeft: 6 }}
                                  >
                                    {primary.code}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                u.status === "active"
                                  ? "status-active"
                                  : u.status === "suspended"
                                    ? "status-cancelled"
                                    : "status-pending"
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="text-muted">
                            {formatDateTime(u.last_login_at)}
                          </td>
                          <td>
                            <div className="users-row-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => openEdit(u)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleDelete(u)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredUsers.length > 0 && (
              <div className="table-pagination">
                <div className="pagination-info">
                  Showing <strong>{filteredUsers.length}</strong> user
                  {filteredUsers.length !== 1 ? "s" : ""}
                  {hasActiveFilters ? " (filtered)" : ""}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {modalOpen && (
        <div
          className="roles-modal-overlay"
          onClick={() => !saving && setModalOpen(false)}
          role="presentation"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            boxSizing: "border-box",
          }}
        >
          <div
            className="card roles-modal users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "min(92vh, 860px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              margin: 0,
            }}
          >
            <div
              className="roles-modal-header"
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border-color, #e5e7eb)",
              }}
            >
              <h2
                id="user-modal-title"
                style={{ margin: 0, fontSize: "1.15rem" }}
              >
                {editing ? "Edit User" : "Add User"}
              </h2>
              <button
                type="button"
                className="roles-modal-close"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              noValidate
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                className="roles-form-grid"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: "16px 4px 8px 0",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px 16px",
                  alignContent: "start",
                }}
              >
                <label
                  className={`form-field ${formErrors.name ? "has-error" : ""}`}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <span>Name *</span>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => updateFormField("name", e.target.value)}
                    placeholder="Full name"
                    maxLength={100}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <span className="field-error">{formErrors.name}</span>
                  )}
                </label>

                <label
                  className={`form-field ${formErrors.email ? "has-error" : ""}`}
                >
                  <span>Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateFormField("email", e.target.value)}
                    placeholder="email@example.com"
                    aria-invalid={!!formErrors.email}
                  />
                  {formErrors.email && (
                    <span className="field-error">{formErrors.email}</span>
                  )}
                </label>

                <label
                  className={`form-field ${
                    formErrors.password ? "has-error" : ""
                  }`}
                >
                  <span>
                    Password {editing ? "(leave blank to keep)" : "*"}
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      updateFormField("password", e.target.value)
                    }
                    placeholder={editing ? "••••••••" : "Min 6 characters"}
                    minLength={editing ? undefined : 6}
                    aria-invalid={!!formErrors.password}
                    autoComplete="new-password"
                  />
                  {formErrors.password && (
                    <span className="field-error">{formErrors.password}</span>
                  )}
                </label>

                <label className="form-field">
                  <span>Role</span>
                  <select
                    value={form.role_id}
                    onChange={(e) =>
                      updateFormField("role_id", e.target.value)
                    }
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  className={`form-field ${
                    formErrors.status ? "has-error" : ""
                  }`}
                >
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateFormField("status", e.target.value)
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  {formErrors.status && (
                    <span className="field-error">{formErrors.status}</span>
                  )}
                </label>

                <div
                  className={`form-field full ${
                    formErrors.warehouse_ids ? "has-error" : ""
                  }`}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <span>Warehouse access *</span>
                  <div
                    className="user-wh-access-modes"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <label className="users-all-wh-check">
                      <input
                        type="checkbox"
                        checked={form.access_all_warehouses}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setForm((f) => ({
                            ...f,
                            access_all_warehouses: on,
                            warehouse_ids: on ? [] : f.warehouse_ids,
                          }));
                          setFormErrors((prev) => {
                            if (!prev.warehouse_ids) return prev;
                            const next = { ...prev };
                            delete next.warehouse_ids;
                            return next;
                          });
                        }}
                      />
                      <span>
                        <strong>Access all warehouses</strong>
                        <span
                          className="text-muted"
                          style={{ marginLeft: 6, fontSize: 12 }}
                        >
                          (system-wide — overrides specific list)
                        </span>
                      </span>
                    </label>

                    {!form.access_all_warehouses && (
                      <>
                        <div
                          className="user-wh-checklist-head"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span className="text-muted" style={{ fontSize: 13 }}>
                            {form.warehouse_ids.length === 0
                              ? "Select one or more warehouses"
                              : form.warehouse_ids.length === 1
                                ? "1 warehouse selected"
                                : `${form.warehouse_ids.length} warehouses selected`}
                          </span>
                          {warehouses.length > 0 && (
                            <span
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => {
                                  setForm((f) => ({
                                    ...f,
                                    access_all_warehouses: false,
                                    warehouse_ids: warehouses.map((w) => w.id),
                                  }));
                                  setFormErrors((prev) => {
                                    if (!prev.warehouse_ids) return prev;
                                    const next = { ...prev };
                                    delete next.warehouse_ids;
                                    return next;
                                  });
                                }}
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                disabled={form.warehouse_ids.length === 0}
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    warehouse_ids: [],
                                  }))
                                }
                              >
                                Clear
                              </button>
                            </span>
                          )}
                        </div>

                        <div
                          className="user-wh-checklist"
                          style={{
                            maxHeight: "min(220px, 32vh)",
                            overflowY: "auto",
                            border: "1px solid var(--border-color, #e5e7eb)",
                            borderRadius: 8,
                            padding: "6px 8px",
                          }}
                        >
                          {warehouses.length === 0 ? (
                            <span className="text-muted">
                              No warehouses available
                            </span>
                          ) : (
                            warehouses.map((w) => (
                              <label
                                key={w.id}
                                className="user-wh-check-item"
                              >
                                <input
                                  type="checkbox"
                                  checked={form.warehouse_ids.includes(w.id)}
                                  onChange={() => toggleWarehouse(w.id)}
                                />
                                <span>
                                  {w.name}
                                  {w.code ? ` (${w.code})` : ""}
                                </span>
                              </label>
                            ))
                          )}
                        </div>

                        {form.warehouse_ids.length > 1 && (
                          <p
                            className="text-muted"
                            style={{ fontSize: 12, margin: 0 }}
                          >
                            This user can operate in{" "}
                            {form.warehouse_ids.length} warehouses.
                          </p>
                        )}
                        {warehouses.length > 0 &&
                          form.warehouse_ids.length === warehouses.length &&
                          form.warehouse_ids.length > 0 && (
                            <p
                              className="text-muted"
                              style={{ fontSize: 12, margin: 0 }}
                            >
                              All warehouses checked — will be saved as “Access
                              all warehouses”.
                            </p>
                          )}
                      </>
                    )}

                    {form.access_all_warehouses && (
                      <p
                        className="text-muted"
                        style={{ fontSize: 12, margin: 0 }}
                      >
                        User can access every warehouse, including ones added
                        later.
                      </p>
                    )}
                  </div>
                  {formErrors.warehouse_ids && (
                    <span className="field-error">
                      {formErrors.warehouse_ids}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="roles-modal-actions"
                style={{
                  flexShrink: 0,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-color, #e5e7eb)",
                  marginTop: 4,
                }}
              >
                <div
                  className="roles-modal-actions-right"
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : editing ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </form>
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

export default Users;