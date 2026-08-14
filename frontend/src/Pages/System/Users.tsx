import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
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

type Role = {
  id: string;
  name: string;
  description?: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code?: string;
  location?: string | null;
  status?: string;
};

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
  created_at?: string;
  updated_at?: string;
};

type PaginatedResponse = {
  data: User[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

type UserStats = {
  all: number;
  active: number;
  inactive: number;
  suspended: number;
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
  if (u.warehouses && u.warehouses.length > 0) {
    return u.warehouses.map((w) => w.id);
  }
  if (u.warehouse_id) return [u.warehouse_id];
  if (u.warehouse?.id) return [u.warehouse.id];
  return [];
}

function userPrimaryWarehouse(u: User): Warehouse | null {
  if (u.warehouse) return u.warehouse;
  if (u.warehouses && u.warehouses.length > 0) return u.warehouses[0];
  return null;
}

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stats, setStats] = useState<UserStats>({
    all: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "",
    warehouse_ids: [] as string[],
    access_all_warehouses: false,
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchStats = useCallback(async () => {
    try {
      const { data: json } = await api.get("/users/stats");
      setStats({
        all: json.all ?? 0,
        active: json.active ?? 0,
        inactive: json.inactive ?? 0,
        suspended: json.suspended ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const { data: json } = await api.get("/roles?per_page=100&all=1");
      setRoles(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      /* optional */
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      const { data: json } = await api.get("/warehouses");
      setWarehouses(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      /* optional */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (roleFilter !== "all") params.set("role_id", roleFilter);
      if (warehouseFilter !== "all") params.set("warehouse_id", warehouseFilter);
      params.set("per_page", "100");
      params.set("sort", "name");
      params.set("dir", "asc");

      const { data: json } = await api.get(`/users?${params}`);
      let list: User[] = Array.isArray(json) ? json : json.data ?? [];

      if (warehouseFilter !== "all") {
        list = list.filter((u) => {
          if (u.access_all_warehouses) return true;
          if (u.warehouse_id === warehouseFilter) return true;
          if (u.warehouse?.id === warehouseFilter) return true;
          if (u.warehouses?.some((w) => w.id === warehouseFilter)) return true;
          return false;
        });
      }

      setUsers(list);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Unable to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, roleFilter, warehouseFilter]);

  useEffect(() => {
    fetchRoles();
    fetchWarehouses();
    fetchStats();
  }, [fetchRoles, fetchWarehouses, fetchStats]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 280);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  const withWarehouseCount = useMemo(
    () =>
      users.filter(
        (u) =>
          u.access_all_warehouses ||
          userWarehouseIds(u).length > 0 ||
          !!u.warehouse_id
      ).length,
    [users]
  );

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (const w of warehouses) map.set(w.id, w);
    return map;
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
    setModalOpen(true);
  };

  const syncWarehouses = async (userId: string) => {
    await api.put(`/users/${userId}/warehouses`, {
      access_all_warehouses: form.access_all_warehouses,
      warehouse_ids: form.access_all_warehouses ? [] : form.warehouse_ids,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      showToast("error", "Validation", "Name and email are required.");
      return;
    }
    if (!editing && !form.password) {
      showToast("error", "Validation", "Password is required for new users.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role_id: form.role_id || null,
        access_all_warehouses: form.access_all_warehouses,
        warehouse_ids: form.access_all_warehouses ? [] : form.warehouse_ids,
        warehouse_id: form.access_all_warehouses ? null : form.warehouse_ids[0] || null,
        status: form.status || "active",
      };
      if (form.password) payload.password = form.password;

      let body: any;
      if (editing) {
        const res = await api.put(`/users/${editing.id}`, payload);
        body = res.data;
      } else {
        const res = await api.post("/users", payload);
        body = res.data;
      }

      const savedId: string | undefined = body?.data?.id || editing?.id || body?.id;

      if (savedId) {
        try {
          await syncWarehouses(savedId);
        } catch {
          /* user saved; pivot optional if already synced */
        }
      }

      showToast(
        "success",
        editing ? "Updated" : "Created",
        editing ? "User updated successfully." : "User created successfully."
      );
      setModalOpen(false);
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.errors && Object.values(err.response.data.errors).flat().join(" ")) ||
        err.message ||
        "Save failed";
      showToast("error", "Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;

    try {
      await api.delete(`/users/${u.id}`);
      showToast("success", "Deleted", `"${u.name}" removed.`);
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      showToast(
        "error",
        "Error",
        err.response?.data?.message || err.message || "Delete failed"
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
    setForm((f) => {
      const checked = f.warehouse_ids.includes(id);
      return {
        ...f,
        warehouse_ids: checked
          ? f.warehouse_ids.filter((x) => x !== id)
          : [...f.warehouse_ids, id],
      };
    });
  };

  return (
    <div className="system-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Users</h1>
              <p className="page-subtitle">Accounts with role and warehouse access</p>
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-primary" onClick={openCreate}>
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
              <div className="stat-value users-stat-active">{stats.active}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With warehouse</div>
              <div className="stat-value">{withWarehouseCount}</div>
              <div className="stat-hint">On current list</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Warehouses</div>
              <div className="stat-value">{warehouses.length || "—"}</div>
            </div>
          </div>

          <div className="card">
            <div className="table-toolbar users-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
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
                  <button type="button" className="btn btn-sm btn-secondary" onClick={clearFilters}>
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
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <span className="users-spinner" />
                          Loading users…
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <p>{error}</p>
                          <button type="button" className="btn btn-sm btn-secondary" onClick={fetchUsers}>
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="users-empty">
                          <p>
                            {hasActiveFilters
                              ? "No users match your filters."
                              : "No users yet."}
                          </p>
                          {hasActiveFilters ? (
                            <button type="button" className="btn btn-sm btn-secondary" onClick={clearFilters}>
                              Clear filters
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                              <IconPlus /> Add User
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const primary =
                        userPrimaryWarehouse(u) ||
                        (u.warehouse_id ? warehouseNameById.get(u.warehouse_id) ?? null : null);
                      const multi = !!(u.warehouses && u.warehouses.length > 1);

                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar">{initials(u.name)}</div>
                              <span className="fw-600">{u.name}</span>
                            </div>
                          </td>
                          <td className="text-muted">{u.email}</td>
                          <td>
                            {u.role?.name ? (
                              <span className="users-role-chip">{u.role.name}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {u.access_all_warehouses ? (
                              <span className="role-wh-all">All warehouses</span>
                            ) : multi ? (
                              <span
                                className="user-wh-chip"
                                title={u.warehouses!.map((w) => w.name).join(", ")}
                              >
                                <IconWarehouse />
                                <span>
                                  {u.warehouses![0].name}
                                  <span className="text-muted"> +{u.warehouses!.length - 1}</span>
                                </span>
                              </span>
                            ) : primary ? (
                              <span
                                className="user-wh-chip"
                                title={primary.location || primary.code || ""}
                              >
                                <IconWarehouse />
                                <span>{primary.name}</span>
                                {primary.code && (
                                  <span className="track-code" style={{ marginLeft: 6 }}>
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
                          <td className="text-muted">{formatDateTime(u.last_login_at)}</td>
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

            {!loading && !error && users.length > 0 && (
              <div className="table-pagination">
                <div className="pagination-info">
                  Showing <strong>{users.length}</strong> user
                  {users.length !== 1 ? "s" : ""}
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
        >
          <div
            className="card roles-modal users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="roles-modal-header">
              <h2 id="users-modal-title">{editing ? "Edit User" : "Add User"}</h2>
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

            <form onSubmit={handleSave}>
              <div className="roles-form-grid">
                <label className="form-field">
                  <span>Name *</span>
                  <input
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </label>

                <label className="form-field">
                  <span>Email *</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </label>

                <label className="form-field">
                  <span>Password {editing ? "(leave blank to keep)" : "*"}</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editing ? "••••••••" : "Min 6 characters"}
                    minLength={editing ? undefined : 6}
                    required={!editing}
                  />
                </label>

                <label className="form-field">
                  <span>Role</span>
                  <select
                    value={form.role_id}
                    onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-field">
                  <label className="users-all-wh-check">
                    <input
                      type="checkbox"
                      checked={form.access_all_warehouses}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          access_all_warehouses: e.target.checked,
                          warehouse_ids: e.target.checked ? [] : f.warehouse_ids,
                        }))
                      }
                    />
                    <span>Access all warehouses</span>
                  </label>
                </div>

                {!form.access_all_warehouses && (
                  <div className="form-field">
                    <span>Assigned warehouses</span>
                    <div className="user-wh-checklist">
                      {warehouses.length === 0 ? (
                        <span className="text-muted">No warehouses available</span>
                      ) : (
                        warehouses.map((w) => {
                          const checked = form.warehouse_ids.includes(w.id);
                          return (
                            <label key={w.id} className="user-wh-check-item">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleWarehouse(w.id)}
                              />
                              <span>
                                {w.name}
                                {w.code ? ` (${w.code})` : ""}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {form.warehouse_ids.length > 0 && (
                      <span className="users-wh-count">
                        {form.warehouse_ids.length} selected
                      </span>
                    )}
                  </div>
                )}

                <label className="form-field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>

              <div className="roles-modal-actions">
                <div className="roles-modal-actions-right">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
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
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default Users;