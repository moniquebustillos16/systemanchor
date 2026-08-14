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

const IconX = () => (
  <svg {...svg} width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconShield = () => (
  <svg {...svg} width="16" height="16">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconEdit = () => (
  <svg {...svg} width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconUsers = () => (
  <svg {...svg} width="14" height="14">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconWarehouse = () => (
  <svg {...svg} width="14" height="14">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const IconCheck = () => (
  <svg {...svg} width="14" height="14">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconTrash = () => (
  <svg {...svg} width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconLock = () => (
  <svg {...svg} width="14" height="14">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconGrid = () => (
  <svg {...svg} width="14" height="14">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

type RolePreset = {
  name: string;
  description: string;
  scope: "system" | "warehouse" | "readonly";
};

const ROLE_PRESETS: RolePreset[] = [
  { name: "Admin", description: "Full system-wide access to all warehouses and modules.", scope: "system" },
  { name: "Warehouse Manager", description: "Full access to assigned warehouse(s). Cannot manage users or system settings.", scope: "warehouse" },
  { name: "Shift Supervisor", description: "Floor operations with read access to orders and reports.", scope: "warehouse" },
  { name: "Warehouse Operator", description: "Day-to-day floor work: movements, receiving, shipping.", scope: "warehouse" },
  { name: "Receiving Clerk", description: "Inbound receiving, verification, and put-away.", scope: "warehouse" },
  { name: "Picker / Packer", description: "Pick, pack, label, and prepare outbound shipments.", scope: "warehouse" },
  { name: "Sales Coordinator", description: "Sales orders, customers, shipping, and returns.", scope: "warehouse" },
  { name: "Inventory Controller", description: "Stock levels, locations, counts, and adjustments.", scope: "warehouse" },
  { name: "Quality Inspector", description: "Inspections, quarantine, and quality releases.", scope: "warehouse" },
  { name: "Viewer", description: "Read-only access to dashboards and reports.", scope: "readonly" },
];

const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;
type CrudAction = (typeof CRUD_ACTIONS)[number];

type Role = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  status?: "active" | "inactive";
};

type Permission = {
  id: string;
  name: string;
  description: string | null;
  roles_count?: number;
};

type RoleUser = {
  id: string;
  name: string;
  email: string;
  status?: string;
  role?: { id: string } | null;
  role_id?: string;
  warehouse_id?: string | null;
  warehouse?: Warehouse | null;
  warehouses?: Warehouse[] | null;
  access_all_warehouses?: boolean;
};

type Warehouse = {
  id: string;
  name: string;
  code?: string;
  location?: string | null;
  address?: string | null;
};

type DetailTab = "permissions" | "users" | "warehouses";

type PermGroup = {
  key: string;
  label: string;
  description: string;
  actions: Partial<Record<CrudAction, Permission>>;
  extras: Permission[];
};

function roleInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function titleCase(s: string): string {
  return s
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeAction(raw: string): CrudAction | null {
  const a = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (["view", "read", "show", "list", "index", "get", "access"].includes(a)) return "view";
  if (["create", "add", "store", "write", "insert", "new", "export", "schedule"].includes(a)) return "create";
  if (["update", "edit", "modify", "put", "patch", "manage", "sync", "complete", "process", "approve", "start"].includes(a)) return "update";
  if (["delete", "destroy", "remove", "trash", "cancel"].includes(a)) return "delete";
  if (/(^|_)(view|read|show|list|index)(_|$)/.test(a)) return "view";
  if (/(^|_)(create|add|store|write|export)(_|$)/.test(a)) return "create";
  if (/(^|_)(update|edit|modify|manage|sync|complete)(_|$)/.test(a)) return "update";
  if (/(^|_)(delete|destroy|remove|trash)(_|$)/.test(a)) return "delete";
  return null;
}

function parsePermName(name: string): { group: string; action: string; crud: CrudAction | null } {
  const cleaned = String(name || "").trim();
  const parts = cleaned.split(/[._-]/).filter(Boolean);
  if (parts.length < 2) {
    const crud = normalizeAction(cleaned) || "view";
    return { group: cleaned || "other", action: cleaned.toLowerCase() || "view", crud };
  }
  const actionRaw = parts[parts.length - 1];
  const group = parts.slice(0, -1).join("_");
  const crud = normalizeAction(actionRaw) || normalizeAction(parts.slice(1).join("_"));
  return { group: group || parts[0], action: actionRaw.toLowerCase(), crud };
}

function getPreset(name: string): RolePreset | null {
  const key = name.trim().toLowerCase();
  return (
    ROLE_PRESETS.find((p) => p.name.toLowerCase() === key) ||
    ROLE_PRESETS.find((p) => key.includes(p.name.toLowerCase())) ||
    null
  );
}

function scopeLabel(scope: RolePreset["scope"] | undefined): string {
  if (scope === "system") return "SYSTEM";
  if (scope === "readonly") return "READ ONLY";
  if (scope === "warehouse") return "WAREHOUSE";
  return "CUSTOM";
}

function buildGroups(perms: Permission[]): PermGroup[] {
  const map = new Map<string, PermGroup>();
  for (const p of perms) {
    const { group, crud } = parsePermName(p.name);
    const key = group.toLowerCase().replace(/\s+/g, "_");
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: titleCase(group),
        description: p.description || `${titleCase(group)} module`,
        actions: {},
        extras: [],
      });
    }
    const g = map.get(key)!;
    if (crud) {
      if (!g.actions[crud]) g.actions[crud] = p;
      else if (g.actions[crud]!.id !== p.id) g.extras.push(p);
    } else {
      g.extras.push(p);
    }
    if (p.description && g.description === `${titleCase(group)} module`) {
      g.description = p.description;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function warehousesFromUsers(users: RoleUser[], allWarehouses: Warehouse[]): Warehouse[] {
  if (users.some((u) => u.access_all_warehouses)) {
    return allWarehouses.length > 0 ? allWarehouses : [];
  }
  const index = new Map(allWarehouses.map((w) => [w.id, w]));
  const seen = new Map<string, Warehouse>();
  for (const u of users) {
    if (Array.isArray(u.warehouses)) {
      for (const w of u.warehouses) {
        if (w?.id && !seen.has(w.id)) seen.set(w.id, w);
      }
    }
    if (u.warehouse?.id && !seen.has(u.warehouse.id)) {
      seen.set(u.warehouse.id, u.warehouse);
    }
    if (u.warehouse_id && !seen.has(u.warehouse_id)) {
      const found = index.get(u.warehouse_id);
      seen.set(u.warehouse_id, found || { id: u.warehouse_id, name: `Warehouse ${u.warehouse_id.slice(0, 8)}` });
    }
  }
  return Array.from(seen.values());
}

function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [assignedOrig, setAssignedOrig] = useState<Set<string>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permFilter, setPermFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("permissions");
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [roleWarehouses, setRoleWarehouses] = useState<Warehouse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [permCounts, setPermCounts] = useState<Record<string, number>>({});
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: "200", sort: "name", dir: "asc" });
      if (search.trim()) params.set("search", search.trim());

      const { data: json } = await api.get(`/roles?${params}`);
      const list: Role[] = Array.isArray(json) ? json : json.data ?? [];
      setRoles(list);

      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || "Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data: json } = await api.get("/permissions?per_page=500");
      const payload = json.success !== undefined ? json.data : json.data ?? json;
      const list: Permission[] = Array.isArray(payload) ? payload : payload?.data ?? [];
      setPermissions(list);
    } catch {
      /* empty until seeded */
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      const { data: json } = await api.get("/warehouses");
      setAllWarehouses(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      /* optional */
    }
  }, []);

  const loadRolePermissions = useCallback(async (roleId: string) => {
    setPermLoading(true);
    try {
      let ids = new Set<string>();
      try {
        const { data: json } = await api.get(`/roles/${roleId}/permissions`);
        const perms: Permission[] = json.data?.permissions ?? json.permissions ?? json.data ?? [];
        if (Array.isArray(perms)) {
          ids = new Set(perms.map((p) => p.id).filter(Boolean));
        }
      } catch {
        try {
          const { data: j2 } = await api.get(`/role-permissions?role_id=${roleId}&per_page=500`);
          const records = j2.data?.data ?? j2.data ?? [];
          ids = new Set(
            records
              .map((r: any) => r.permission_id || r.permission?.id)
              .filter(Boolean)
          );
        } catch {
          /* ignore */
        }
      }
      setAssigned(ids);
      setAssignedOrig(new Set(ids));
      setPermCounts((prev) => ({ ...prev, [roleId]: ids.size }));
    } catch {
      setAssigned(new Set());
      setAssignedOrig(new Set());
    } finally {
      setPermLoading(false);
    }
  }, []);

  const loadRoleUsersAndWarehouses = useCallback(
    async (roleId: string) => {
      setUsersLoading(true);
      try {
        const params = new URLSearchParams({
          role_id: roleId,
          per_page: "200",
          all: "1",
          paginate: "false",
        });
        const { data: json } = await api.get(`/users?${params}`);
        let users: RoleUser[] = Array.isArray(json) ? json : json.data ?? [];
        users = users.filter((u) => u.role?.id === roleId || u.role_id === roleId);
        setRoleUsers(users);
        setUserCounts((prev) => ({ ...prev, [roleId]: users.length }));
        setRoleWarehouses(warehousesFromUsers(users, allWarehouses));
      } catch {
        setRoleUsers([]);
        setRoleWarehouses([]);
      } finally {
        setUsersLoading(false);
      }
    },
    [allWarehouses]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchRoles(), 250);
    return () => clearTimeout(t);
  }, [fetchRoles]);

  useEffect(() => {
    fetchPermissions();
    fetchWarehouses();
  }, [fetchPermissions, fetchWarehouses]);

  useEffect(() => {
    if (!selectedId) {
      setAssigned(new Set());
      setAssignedOrig(new Set());
      setRoleUsers([]);
      setRoleWarehouses([]);
      return;
    }
    setDetailTab("permissions");
    setPermFilter("");
    setGroupFilter("all");
    loadRolePermissions(selectedId);
    loadRoleUsersAndWarehouses(selectedId);
  }, [selectedId, loadRolePermissions, loadRoleUsersAndWarehouses]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !permSaving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, permSaving]);

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) || null, [roles, selectedId]);
  const selectedPreset = useMemo(() => (selected ? getPreset(selected.name) : null), [selected]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)
    );
  }, [roles, search]);

  const dirty = useMemo(() => {
    if (assigned.size !== assignedOrig.size) return true;
    for (const id of assigned) if (!assignedOrig.has(id)) return true;
    return false;
  }, [assigned, assignedOrig]);

  const allGroups = useMemo(() => buildGroups(permissions), [permissions]);

  const visibleGroups = useMemo(() => {
    let list = allGroups;
    if (groupFilter !== "all") list = list.filter((g) => g.key === groupFilter);
    const q = permFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          Object.values(g.actions).some(
            (p) => p && (p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
          ) ||
          g.extras.some(
            (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
          )
      );
    }
    return list;
  }, [allGroups, groupFilter, permFilter]);

  const enabledCount = assigned.size;
  const groupCount = allGroups.length;
  const hasAllWarehouses = roleUsers.some((u) => u.access_all_warehouses);

  const togglePerm = (id: string | undefined) => {
    if (!id) return;
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rowStats = (g: PermGroup) => {
    const ids = [
      ...CRUD_ACTIONS.map((a) => g.actions[a]?.id).filter(Boolean),
      ...g.extras.map((p) => p.id),
    ] as string[];
    const on = ids.filter((id) => assigned.has(id)).length;
    return { on, total: ids.length };
  };

  const savePermissions = async () => {
    if (!selectedId) return;
    setPermSaving(true);
    try {
      const permission_ids = Array.from(assigned);

      const attempts = [
        { method: "put" as const, url: `/roles/${selectedId}/permissions` },
        { method: "post" as const, url: `/roles/${selectedId}/permissions` },
        { method: "put" as const, url: `/roles/${selectedId}/permissions/sync` },
        { method: "post" as const, url: `/roles/${selectedId}/permissions/sync` },
      ];

      let ok = false;
      let lastMessage = "";

      for (const attempt of attempts) {
        try {
          if (attempt.method === "put") {
            await api.put(attempt.url, { permission_ids });
          } else {
            await api.post(attempt.url, { permission_ids });
          }
          ok = true;
          break;
        } catch (err: any) {
          const status = err.response?.status;
          if (status !== 404 && status !== 405) {
            lastMessage =
              err.response?.data?.message ||
              (err.response?.data?.errors && Object.values(err.response.data.errors).flat().join(" ")) ||
              `Save failed (${status})`;
            break;
          }
        }
      }

      if (!ok) {
        throw new Error(lastMessage || "Save failed. Register the permissions sync route.");
      }

      setAssignedOrig(new Set(assigned));
      setPermCounts((prev) => ({ ...prev, [selectedId]: assigned.size }));
      showToast("success", "Saved", "Permissions updated.");
    } catch (e: any) {
      showToast("error", "Error", e.message || "Could not save");
    } finally {
      setPermSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (role: Role, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(role);
    setForm({ name: role.name, description: role.description || "" });
    setModalOpen(true);
  };

  const handleRoleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      };

      let created: Role | undefined;
      if (editing) {
        const { data: json } = await api.put(`/roles/${editing.id}`, payload);
        created = json.data ?? json;
      } else {
        const { data: json } = await api.post("/roles", payload);
        created = json.data ?? json;
      }

      showToast("success", editing ? "Updated" : "Created", editing ? "Role updated." : "Role created.");
      setModalOpen(false);
      await fetchRoles();
      if (created?.id) setSelectedId(created.id);
    } catch (err: any) {
      showToast(
        "error",
        "Error",
        err.response?.data?.message ||
          (err.response?.data?.errors && Object.values(err.response.data.errors).flat().join(" ")) ||
          err.message ||
          "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"? Assigned permissions will be detached.`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      showToast("success", "Deleted", "Role removed.");
      if (selectedId === role.id) setSelectedId(null);
      setModalOpen(false);
      await fetchRoles();
    } catch {
      showToast("error", "Error", "Could not delete role");
    }
  };

  const actionClass = (action: CrudAction) => `rac-action rac-action-${action}`;

  return (
    <div className="system-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Roles &amp; Access Control</h1>
              <p className="page-subtitle">Manage roles, permissions, users and warehouse access</p>
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <IconPlus /> Create Role
              </button>
            </div>
          </div>

          {error && (
            <div className="roles-empty" style={{ marginBottom: 16 }}>
              <p>{error}</p>
              <button type="button" className="btn btn-sm btn-secondary" onClick={fetchRoles}>
                Retry
              </button>
            </div>
          )}

          <div className="rac-layout">
            <aside className="rac-roles card">
              <div className="rac-roles-head">
                <span className="rac-section-label">Roles</span>
                <div className="table-search rp-search">
                  <IconSearch />
                  <input
                    type="search"
                    placeholder="Search roles…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="rac-roles-list">
                {loading ? (
                  <div className="roles-empty">
                    <span className="roles-spinner" />
                    Loading…
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <div className="roles-empty">
                    <p>No roles yet.</p>
                    <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                      <IconPlus /> Create Role
                    </button>
                  </div>
                ) : (
                  filteredRoles.map((r) => {
                    const active = r.id === selectedId;
                    const preset = getPreset(r.name);
                    const scope = preset?.scope;
                    const pc = permCounts[r.id];
                    const uc = userCounts[r.id];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`rac-role-card ${active ? "active" : ""}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <div className="rac-role-icon">{roleInitials(r.name)}</div>
                        <div className="rac-role-body">
                          <div className="rac-role-title">
                            <span className="fw-600">{r.name}</span>
                            <span className={`role-scope-badge scope-${scope || "custom"}`}>
                              {scopeLabel(scope)}
                            </span>
                          </div>
                          <div className="rac-role-meta">
                            <span>
                              <IconLock /> {pc !== undefined ? pc : "—"} permissions
                            </span>
                            <span>
                              <IconUsers /> {uc !== undefined ? uc : "—"} users
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="rac-detail card">
              {!selected ? (
                <div className="roles-empty" style={{ padding: 48 }}>
                  <IconShield />
                  <p className="rp-empty-title">Select a role</p>
                  <p className="rp-empty-hint">Choose a role on the left to manage permissions.</p>
                </div>
              ) : (
                <>
                  <div className="rac-detail-head">
                    <div className="rac-detail-title">
                      <div className="rac-role-icon rac-role-icon-lg">{roleInitials(selected.name)}</div>
                      <div>
                        <div className="rac-detail-name">
                          <h2>{selected.name}</h2>
                          <span className={`role-scope-badge scope-${selectedPreset?.scope || "custom"}`}>
                            {scopeLabel(selectedPreset?.scope)}
                          </span>
                        </div>
                        <p className="rac-detail-desc">
                          {selected.description || selectedPreset?.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={(e) => openEdit(selected, e)}>
                      <IconEdit /> Edit Role
                    </button>
                  </div>

                  <div className="rac-tabs">
                    <button
                      type="button"
                      className={`rac-tab ${detailTab === "permissions" ? "active" : ""}`}
                      onClick={() => setDetailTab("permissions")}
                    >
                      <IconLock /> Permissions
                    </button>
                    <button
                      type="button"
                      className={`rac-tab ${detailTab === "users" ? "active" : ""}`}
                      onClick={() => setDetailTab("users")}
                    >
                      <IconUsers /> Users ({usersLoading ? "…" : roleUsers.length})
                    </button>
                    <button
                      type="button"
                      className={`rac-tab ${detailTab === "warehouses" ? "active" : ""}`}
                      onClick={() => setDetailTab("warehouses")}
                    >
                      <IconWarehouse /> Warehouses (
                      {usersLoading ? "…" : hasAllWarehouses ? "All" : roleWarehouses.length})
                    </button>
                  </div>

                  {detailTab === "permissions" ? (
                    <>
                      <div className="rac-stats">
                        <div className="rac-stat rac-stat-perm">
                          <IconShield />
                          <div>
                            <strong>
                              {enabledCount}
                              {permissions.length > 0 ? ` / ${permissions.length}` : ""}
                            </strong>
                            <span>Permissions Enabled</span>
                          </div>
                        </div>
                        <div className="rac-stat rac-stat-groups">
                          <IconGrid />
                          <div>
                            <strong>{groupCount}</strong>
                            <span>Permission Groups</span>
                          </div>
                        </div>
                        <div className="rac-stat rac-stat-users">
                          <IconUsers />
                          <div>
                            <strong>{usersLoading ? "…" : roleUsers.length}</strong>
                            <span>Users Assigned</span>
                          </div>
                        </div>
                        <div className="rac-stat rac-stat-wh">
                          <IconWarehouse />
                          <div>
                            <strong>
                              {usersLoading ? "…" : hasAllWarehouses ? "All" : roleWarehouses.length || "—"}
                            </strong>
                            <span>Access Scope</span>
                          </div>
                        </div>
                      </div>

                      <div className="rac-toolbar">
                        <div className="table-search rp-search">
                          <IconSearch />
                          <input
                            type="search"
                            placeholder="Search permissions…"
                            value={permFilter}
                            onChange={(e) => setPermFilter(e.target.value)}
                          />
                        </div>
                        <select className="rac-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                          <option value="all">All Groups</option>
                          {allGroups.map((g) => (
                            <option key={g.key} value={g.key}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                        <span className="rac-dirty">{dirty ? "Unsaved changes" : ""}</span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!dirty || permSaving || permLoading}
                          onClick={savePermissions}
                        >
                          {permSaving ? "Saving…" : (<><IconCheck /> Save</>)}
                        </button>
                      </div>

                      <div className="rac-table-wrap">
                        {permLoading ? (
                          <div className="roles-empty">
                            <span className="roles-spinner" />
                            Loading permissions…
                          </div>
                        ) : permissions.length === 0 ? (
                          <div className="roles-empty">
                            <p>No permissions in the catalog yet. Add them via the API, then assign access here.</p>
                          </div>
                        ) : visibleGroups.length === 0 ? (
                          <div className="roles-empty">
                            <p>No groups match your filters.</p>
                          </div>
                        ) : (
                          <table className="rac-matrix">
                            <thead>
                              <tr>
                                <th>Permission Group</th>
                                <th>Description</th>
                                <th className="rac-col-action">View</th>
                                <th className="rac-col-action">Create</th>
                                <th className="rac-col-action">Update</th>
                                <th className="rac-col-action">Delete</th>
                                <th className="rac-col-total">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleGroups.map((g) => {
                                const { on, total } = rowStats(g);
                                return (
                                  <tr key={g.key}>
                                    <td>
                                      <span className="rac-group-cell">
                                        <span className="fw-600">{g.label}</span>
                                      </span>
                                    </td>
                                    <td className="text-muted">{g.description}</td>
                                    {CRUD_ACTIONS.map((action) => {
                                      const p = g.actions[action];
                                      if (!p) {
                                        return (
                                          <td key={action} className="rac-col-action rac-na">
                                            —
                                          </td>
                                        );
                                      }
                                      const checked = assigned.has(p.id);
                                      return (
                                        <td key={action} className="rac-col-action">
                                          <input
                                            type="checkbox"
                                            className={actionClass(action)}
                                            checked={checked}
                                            onChange={() => togglePerm(p.id)}
                                            title={p.name}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="rac-col-total">
                                      <span className="rac-total-pill">
                                        {on}/{total}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                      {visibleGroups.length > 0 && (
                        <div className="rac-table-foot">
                          Showing {visibleGroups.length} of {groupCount} groups
                        </div>
                      )}
                    </>
                  ) : detailTab === "users" ? (
                    <div className="rac-list-body">
                      {usersLoading ? (
                        <div className="roles-empty">
                          <span className="roles-spinner" />
                          Loading users…
                        </div>
                      ) : roleUsers.length === 0 ? (
                        <div className="roles-empty">
                          <p>No users assigned to this role.</p>
                        </div>
                      ) : (
                        roleUsers.map((u) => (
                          <div key={u.id} className="rp-user-row">
                            <div className="role-avatar">{roleInitials(u.name)}</div>
                            <div className="rp-user-info">
                              <span className="fw-600">{u.name}</span>
                              <span className="rp-role-sub">{u.email}</span>
                            </div>
                            <span
                              className={`status-badge ${
                                (u.status || "active").toLowerCase() === "active" ? "status-active" : "status-cancelled"
                              }`}
                            >
                              {u.status || "active"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="rac-list-body">
                      {usersLoading ? (
                        <div className="roles-empty">
                          <span className="roles-spinner" />
                          Loading warehouses…
                        </div>
                      ) : roleUsers.length === 0 ? (
                        <div className="roles-empty">
                          <p>No users on this role — no warehouses to show.</p>
                        </div>
                      ) : roleWarehouses.length === 0 && !hasAllWarehouses ? (
                        <div className="roles-empty">
                          <p>Assigned users have no warehouse linked.</p>
                        </div>
                      ) : (
                        <>
                          {hasAllWarehouses && (
                            <div className="roles-all-banner">One or more users have access to all warehouses.</div>
                          )}
                          {roleWarehouses.map((w) => (
                            <div key={w.id} className="rp-user-row">
                              <div className="roles-wh-icon">
                                <IconWarehouse />
                              </div>
                              <div className="rp-user-info">
                                <span className="fw-600">{w.name}</span>
                                <span className="rp-role-sub">
                                  {w.code && <span className="track-code">{w.code}</span>}
                                  {(w.location || w.address) && (
                                    <span style={{ marginLeft: w.code ? 8 : 0 }}>{w.location || w.address}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="roles-modal-overlay" onClick={() => !saving && setModalOpen(false)} role="presentation">
          <div className="card roles-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="roles-modal-header">
              <h2>{editing ? "Edit Role" : "Create Role"}</h2>
              <button type="button" className="roles-modal-close" disabled={saving} onClick={() => setModalOpen(false)}>
                <IconX />
              </button>
            </div>

            <form onSubmit={handleRoleSave}>
              {!editing && (
                <div className="rp-presets">
                  <div className="rp-presets-label">
                    <span>Quick start</span>
                    <span className="rp-presets-hint">Optional — fills name &amp; description only</span>
                  </div>
                  <div className="rp-presets-scroll">
                    {ROLE_PRESETS.map((p) => {
                      const active = form.name === p.name;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          className={`rp-preset-chip ${active ? "active" : ""}`}
                          onClick={() => setForm({ name: p.name, description: p.description })}
                        >
                          <span className="rp-preset-name">{p.name}</span>
                          <span className={`role-scope-badge scope-${p.scope}`}>{scopeLabel(p.scope)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="roles-form-grid rp-form-pad">
                <label className="form-field">
                  <span>Name *</span>
                  <input
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Warehouse Operator"
                    maxLength={100}
                  />
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short summary of this role’s responsibilities"
                    maxLength={255}
                    rows={3}
                  />
                </label>
              </div>

              <div className="roles-modal-actions">
                {editing && (
                  <button type="button" className="btn btn-secondary roles-delete-btn" disabled={saving} onClick={() => handleDelete(editing)}>
                    <IconTrash /> Delete
                  </button>
                )}
                <div className="roles-modal-actions-right">
                  <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setModalOpen(false)}>
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

export default Roles;