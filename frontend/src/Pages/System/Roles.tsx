import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import "../css/System.css";

/* ------------------------------------------------------------------ */
/* Icons (static – never re-create)                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Types & constants                                                  */
/* ------------------------------------------------------------------ */

const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;
type CrudAction = (typeof CRUD_ACTIONS)[number];

type Role = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  status?: "active" | "inactive";
  /** Populated when backend is called with with_counts=1 */
  permission_count?: number;
  user_count?: number;
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
  section: string;
  sectionOrder: number;
  moduleOrder: number;
  actions: Partial<Record<CrudAction, Permission>>;
  extras: Permission[];
};

/** Canonical nav sections & modules — matches sidebar order */
const MODULE_CATALOG: {
  section: string;
  sectionOrder: number;
  modules: { key: string; label: string; aliases: string[]; description: string }[];
}[] = [
  {
    section: "MAIN",
    sectionOrder: 0,
    modules: [
      { key: "dashboard", label: "Dashboard", aliases: ["dashboard", "home", "overview"], description: "Main dashboard and overview widgets" },
      { key: "inventory", label: "Inventory", aliases: ["inventory", "stock", "items", "products", "skus"], description: "Stock levels, items, and product catalog" },
      { key: "stock_movements", label: "Stock Movements", aliases: ["stock_movements", "stock_movement", "movements", "transfers", "adjustments"], description: "Transfers, adjustments, and stock history" },
    ],
  },
  {
    section: "ORDERS",
    sectionOrder: 1,
    modules: [
      { key: "purchase_orders", label: "Purchase Orders", aliases: ["purchase_orders", "purchase_order", "po", "purchases"], description: "Inbound purchase orders and suppliers buys" },
      { key: "sales_orders", label: "Sales Orders", aliases: ["sales_orders", "sales_order", "so", "orders", "sales"], description: "Customer sales orders and fulfillment" },
      { key: "receiving", label: "Receiving", aliases: ["receiving", "receipts", "inbound"], description: "Inbound receiving and put-away" },
      { key: "shipping", label: "Shipping", aliases: ["shipping", "shipments", "outbound", "dispatch"], description: "Outbound shipping and carrier handoff" },
      { key: "returns", label: "Returns", aliases: ["returns", "rma", "return"], description: "Customer and supplier returns" },
    ],
  },
  {
    section: "WAREHOUSE",
    sectionOrder: 2,
    modules: [
      { key: "locations", label: "Locations", aliases: ["locations", "location", "bins", "zones"], description: "Bins, zones, and warehouse locations" },
      { key: "capacity", label: "Capacity", aliases: ["capacity", "space", "utilization"], description: "Space utilization and capacity planning" },
      { key: "cycle_count", label: "Cycle Count", aliases: ["cycle_count", "cycle_counts", "counts", "stocktake", "physical_count"], description: "Cycle counts and stocktakes" },
    ],
  },
  {
    section: "PARTNERS",
    sectionOrder: 3,
    modules: [
      { key: "suppliers", label: "Suppliers", aliases: ["suppliers", "supplier", "vendors", "vendor"], description: "Supplier master data" },
      { key: "customers", label: "Customers", aliases: ["customers", "customer", "clients"], description: "Customer master data" },
    ],
  },
  {
    section: "INSIGHTS",
    sectionOrder: 4,
    modules: [
      { key: "reports", label: "Reports", aliases: ["reports", "report"], description: "Operational and financial reports" },
      { key: "analytics", label: "Analytics", aliases: ["analytics", "insights", "metrics"], description: "Analytics and performance insights" },
    ],
  },
  {
    section: "SYSTEM",
    sectionOrder: 5,
    modules: [
      { key: "users", label: "Users", aliases: ["users", "user", "accounts"], description: "User accounts and access assignment" },
      { key: "roles", label: "Roles", aliases: ["roles", "role", "permissions", "permission", "access"], description: "Roles and permission management" },
      { key: "settings", label: "Settings", aliases: ["settings", "setting", "config", "configuration", "system"], description: "System configuration and preferences" },
    ],
  },
];

const MODULE_LOOKUP: Map<string, { section: string; sectionOrder: number; moduleOrder: number; label: string; description: string; key: string }> = (() => {
  const map = new Map<string, { section: string; sectionOrder: number; moduleOrder: number; label: string; description: string; key: string }>();
  for (const sec of MODULE_CATALOG) {
    sec.modules.forEach((m, idx) => {
      const meta = {
        section: sec.section,
        sectionOrder: sec.sectionOrder,
        moduleOrder: idx,
        label: m.label,
        description: m.description,
        key: m.key,
      };
      map.set(m.key, meta);
      for (const a of m.aliases) map.set(a, meta);
    });
  }
  return map;
})();

function resolveModule(groupRaw: string): {
  section: string;
  sectionOrder: number;
  moduleOrder: number;
  label: string;
  description: string;
  key: string;
} {
  const norm = groupRaw.toLowerCase().replace(/\s+/g, "_").replace(/[.-]+/g, "_");
  const direct = MODULE_LOOKUP.get(norm);
  if (direct) return direct;

  // Fuzzy: match if any alias is contained in the group or vice versa
  for (const [alias, meta] of MODULE_LOOKUP) {
    if (norm.includes(alias) || alias.includes(norm)) return meta;
  }

  const label = groupRaw
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return {
    section: "OTHER",
    sectionOrder: 99,
    moduleOrder: 999,
    label: label || "Other",
    description: `${label || "Other"} module`,
    key: norm || "other",
  };
}

/* ------------------------------------------------------------------ */
/* Pure helpers (stable, no React)                                    */
/* ------------------------------------------------------------------ */

function roleInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

/** Lightweight scope hint from role name (no preset list). */
function scopeFromName(name: string): "system" | "warehouse" | "readonly" | "custom" {
  const key = name.trim().toLowerCase();
  if (key === "admin" || key.includes("admin") || key.includes("system")) return "system";
  if (key === "viewer" || key.includes("viewer") || key.includes("read only") || key.includes("readonly")) return "readonly";
  if (
    key.includes("warehouse") ||
    key.includes("operator") ||
    key.includes("picker") ||
    key.includes("packer") ||
    key.includes("receiving") ||
    key.includes("supervisor") ||
    key.includes("inventory") ||
    key.includes("sales")
  )
    return "warehouse";
  return "custom";
}

/** True when the selected role is Admin — SYSTEM section is locked & always on. */
function isAdminRole(name: string | null | undefined): boolean {
  if (!name) return false;
  const key = name.trim().toLowerCase();
  return key === "admin" || key === "administrator" || key === "system admin" || key === "system administrator";
}

function scopeLabel(scope: "system" | "warehouse" | "readonly" | "custom" | undefined): string {
  if (scope === "system") return "SYSTEM";
  if (scope === "readonly") return "READ ONLY";
  if (scope === "warehouse") return "WAREHOUSE";
  return "CUSTOM";
}

/** All permission IDs that belong to the SYSTEM section (Users, Roles, Settings). */
function systemPermissionIds(groups: PermGroup[]): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    if (g.section !== "SYSTEM") continue;
    for (const a of CRUD_ACTIONS) {
      const p = g.actions[a];
      if (p?.id) ids.push(p.id);
    }
    for (const p of g.extras) {
      if (p?.id) ids.push(p.id);
    }
  }
  return ids;
}

function buildGroups(perms: Permission[]): PermGroup[] {
  const map = new Map<string, PermGroup>();

  // Only groups that exist in the API catalog — never invent modules
  // (e.g. there is no quality.* permission in the DB).
  for (const p of perms) {
    const { group, crud } = parsePermName(p.name);
    const meta = resolveModule(group);
    const key = meta.key;

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: meta.label,
        description: meta.description,
        section: meta.section,
        sectionOrder: meta.sectionOrder,
        moduleOrder: meta.moduleOrder,
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
    if (p.description && (g.description === meta.description || g.description.endsWith(" module"))) {
      g.description = p.description;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.label.localeCompare(b.label);
  });
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

/**
 * Normalize API list payloads from any of:
 *   T[] | { data: T[] } | { data: { data: T[] } } | { success, data: T[] }
 * Also accepts a full Axios response ({ data: body }).
 */
function extractList<T>(json: any): T[] {
  if (!json) return [];
  // Full Axios response accidentally passed through
  if (json.data !== undefined && json.status !== undefined && json.headers !== undefined) {
    return extractList<T>(json.data);
  }
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.data?.data)) return json.data.data;
  if (Array.isArray(json.roles)) return json.roles;
  if (Array.isArray(json.permissions)) return json.permissions;
  // Laravel paginator shape
  if (Array.isArray(json.data?.data)) return json.data.data;
  return [];
}

/* ------------------------------------------------------------------ */
/* Module-level cache + in-flight map (survives Strict Mode remounts) */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 5 * 60_000; // 5 minutes – role/perm catalogs change rarely

type CacheEntry<T> = { data: T; at: number };

const rolesCache: { entry: CacheEntry<Role[]> | null; inflight: Promise<Role[]> | null } = {
  entry: null,
  inflight: null,
};
const permissionsCache: { entry: CacheEntry<Permission[]> | null; inflight: Promise<Permission[]> | null } = {
  entry: null,
  inflight: null,
};
const warehousesCache: { entry: CacheEntry<Warehouse[]> | null; inflight: Promise<Warehouse[]> | null } = {
  entry: null,
  inflight: null,
};
const rolePermsCache = new Map<string, CacheEntry<Set<string>>>();
const rolePermsInflight = new Map<string, Promise<Set<string>>>();
const roleUsersCache = new Map<string, CacheEntry<RoleUser[]>>();
const roleUsersInflight = new Map<string, Promise<RoleUser[]>>();
const ROLE_USERS_TTL_MS = 60_000; // 1 min – users change more often than catalogs

/** Prevents Strict Mode / remount from firing duplicate bootstrap network calls */
let catalogBootstrapStarted = false;

/** Remember which permissions-sync endpoint works so later saves hit only one URL.
 *  Prefer POST /sync first — Laravel custom actions are almost always POST, and the
 *  previous PUT-first probe caused a fast 405 then an 8s successful POST.
 *  Persist the winner in sessionStorage so a full page reload does not re-probe. */
type SyncRoute = { method: "put" | "post"; path: "sync" | "plain" };

const SYNC_ROUTE_STORAGE_KEY = "rac.knownSyncRoute";

function loadKnownSyncRoute(): SyncRoute | null {
  try {
    const raw = sessionStorage.getItem(SYNC_ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncRoute;
    // Only accept POST — a stored PUT caused: fast 405 (~0.2ms) then slow POST (~7–10s).
    if (parsed.method === "post" && (parsed.path === "sync" || parsed.path === "plain")) {
      return parsed;
    }
    // Drop stale PUT (or anything else) from older builds
    sessionStorage.removeItem(SYNC_ROUTE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

function persistKnownSyncRoute(route: SyncRoute | null) {
  try {
    // Never persist PUT — this API's sync route is POST-only
    if (route && route.method === "post") {
      sessionStorage.setItem(SYNC_ROUTE_STORAGE_KEY, JSON.stringify(route));
    } else {
      sessionStorage.removeItem(SYNC_ROUTE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Your API uses POST /roles/{id}/permissions/sync (PUT returns 405 in ~0ms then POST takes ~7–10s). */
const DEFAULT_SYNC_ROUTE: SyncRoute = { method: "post", path: "sync" };
let knownSyncRoute: SyncRoute = loadKnownSyncRoute() ?? DEFAULT_SYNC_ROUTE;

function syncUrl(roleId: string, path: "sync" | "plain"): string {
  return path === "sync" ? `/roles/${roleId}/permissions/sync` : `/roles/${roleId}/permissions`;
}

/** Soft timeout — backend sync can be slow; UI stays optimistic so the page does not freeze. */
const SAVE_TIMEOUT_MS = 30_000;

/**
 * After role-permission sync: drop any client-side permission snapshots and tell
 * Sidebar (and other listeners) to re-fetch /me so the nav matches the new grants.
 */
function notifyPermissionsChanged() {
  // Only permission snapshots — do NOT wipe auth tokens / user session objects
  const keys = ["permissions", "user_permissions", "auth_permissions"];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  // Shared /me cache used by Sidebar + Inventory
  try {
    const g = globalThis as unknown as {
      __saMeCache?: { entry: unknown; inflight: unknown };
    };
    if (g.__saMeCache) {
      g.__saMeCache.entry = null;
      g.__saMeCache.inflight = null;
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("sa-permissions-refresh"));
  } catch {
    /* ignore */
  }
}

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.at < CACHE_TTL_MS;
}

/** Clean user-facing error; empty string = cancelled / ignore */
function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  const e = err as any;
  if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError") {
    return "";
  }
  const msg =
    e?.response?.data?.message ||
    (e?.response?.data?.errors &&
      Object.values(e.response.data.errors).flat().filter(Boolean).join(" ")) ||
    e?.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : fallback;
}

/** Hydrate counts + selection from a roles list without blocking paint */
function countsFromRoles(list: Role[]) {
  const nextPerm: Record<string, number> = {};
  const nextUser: Record<string, number> = {};
  for (const r of list) {
    if (typeof r.permission_count === "number") nextPerm[r.id] = r.permission_count;
    if (typeof r.user_count === "number") nextUser[r.id] = r.user_count;
  }
  return { nextPerm, nextUser };
}

/* ------------------------------------------------------------------ */
/* Memoized role card (avoids re-work on every parent render)         */
/* ------------------------------------------------------------------ */

type RoleCardProps = {
  role: Role;
  active: boolean;
  permCount?: number;
  userCount?: number;
  onSelect: (id: string) => void;
};

const RoleCard = React.memo(function RoleCard({ role, active, permCount, userCount, onSelect }: RoleCardProps) {
  const scope = scopeFromName(role.name);
  return (
    <button
      type="button"
      className={`rac-role-card ${active ? "active" : ""}`}
      onClick={() => onSelect(role.id)}
    >
      <div className="rac-role-icon">{roleInitials(role.name)}</div>
      <div className="rac-role-body">
        <div className="rac-role-title">
          <span className="fw-600">{role.name}</span>
          <span className={`role-scope-badge scope-${scope}`}>
            {scopeLabel(scope)}
          </span>
        </div>
        <div className="rac-role-meta">
          <span>
            <IconLock /> {permCount !== undefined ? permCount : "—"} permissions
          </span>
          <span>
            <IconUsers /> {userCount !== undefined ? userCount : "—"} users
          </span>
        </div>
      </div>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

function Roles() {
  /* ---- core data – seed from module cache for instant first paint ---- */
  const [roles, setRoles] = useState<Role[]>(() =>
    rolesCache.entry ? rolesCache.entry.data : []
  );
  const [permissions, setPermissions] = useState<Permission[]>(() =>
    permissionsCache.entry ? permissionsCache.entry.data : []
  );
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>(() =>
    warehousesCache.entry ? warehousesCache.entry.data : []
  );
  const [search, setSearch] = useState("");
  // Only show spinner when we have zero cached roles
  const [loading, setLoading] = useState(() => !rolesCache.entry);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  /* ---- selection & permissions ---- */
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    rolesCache.entry?.data?.[0]?.id ?? null
  );
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [assignedOrig, setAssignedOrig] = useState<Set<string>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permFilter, setPermFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("permissions");

  /* ---- users / warehouses (lazy) ---- */
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [roleWarehouses, setRoleWarehouses] = useState<Warehouse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoadedFor, setUsersLoadedFor] = useState<string | null>(null);
  const [permCounts, setPermCounts] = useState<Record<string, number>>(() => {
    if (!rolesCache.entry) return {};
    return countsFromRoles(rolesCache.entry.data).nextPerm;
  });
  const [userCounts, setUserCounts] = useState<Record<string, number>>(() => {
    if (!rolesCache.entry) return {};
    return countsFromRoles(rolesCache.entry.data).nextUser;
  });

  /* ---- modal ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  /* ---- abort / once-load refs ---- */
  const permAbort = useRef<AbortController | null>(null);
  const usersAbort = useRef<AbortController | null>(null);
  const saveAbort = useRef<AbortController | null>(null);
  const roleSaveAbort = useRef<AbortController | null>(null);
  /** Sync lock — setState(permSaving) is async; without this, double-click aborts the 1st POST (~0.1ms) and starts a 2nd. */
  const saveLockRef = useRef(false);
  const lastPermRoleId = useRef<string | null>(null);
  const autoRetryRef = useRef(0);
  const mountedRef = useRef(true);
  /** Role IDs that should get SYSTEM permissions pre-checked (new roles). */
  const seedSystemDefaultsRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ================================================================ */
  /* Data fetching                                                    */
  /* ================================================================ */

  /** Stable – cache + inflight. Never abort shared in-flight (Strict Mode safe). */
  const fetchRoles = useCallback(async (q = "", force = false) => {
    const searchKey = q.trim();

    const hydrateFromCache = (cached: Role[]) => {
      setRoles(cached);
      setLoading(false);
      const { nextPerm, nextUser } = countsFromRoles(cached);
      if (Object.keys(nextPerm).length) setPermCounts((prev) => ({ ...prev, ...nextPerm }));
      if (Object.keys(nextUser).length) setUserCounts((prev) => ({ ...prev, ...nextUser }));
      // Only change selection when current id is missing — avoids re-triggering perm loads
      setSelectedId((prev) => {
        if (prev && cached.some((r) => r.id === prev)) return prev;
        if (!prev && cached[0]?.id) return cached[0].id;
        if (prev && !cached.some((r) => r.id === prev)) return cached[0]?.id ?? null;
        return prev;
      });
    };

    // Fresh non-empty cache → instant, no network
    if (!force && !searchKey && isFresh(rolesCache.entry) && rolesCache.entry!.data.length > 0) {
      hydrateFromCache(rolesCache.entry!.data);
      return;
    }

    // Stale or empty → paint what we have, revalidate below
    if (!force && !searchKey && rolesCache.entry && rolesCache.entry.data.length > 0) {
      hydrateFromCache(rolesCache.entry.data);
    } else if (!rolesCache.entry || rolesCache.entry.data.length === 0) {
      setLoading(true);
    }
    setError(null);

    // Always join an in-flight catalog request (even on force) to avoid parallel duplicates
    if (!searchKey && rolesCache.inflight) {
      try {
        const list = await rolesCache.inflight;
        if (mountedRef.current) hydrateFromCache(list);
      } catch {
        /* owner handles */
      }
      return;
    }

    const params = new URLSearchParams({
      per_page: "200",
      sort: "name",
      dir: "asc",
      paginate: "false",
    });
    if (searchKey) params.set("search", searchKey);

    const request = api.get(`/roles?${params}`).then((res: any) => {
      // Support both raw Axios response and interceptors that unwrap `.data`
      const body = res && typeof res === "object" && "data" in res && res.status !== undefined
        ? res.data
        : res?.data !== undefined && !Array.isArray(res)
          ? res.data
          : res;
      return extractList<Role>(body);
    });

    // Register in-flight BEFORE await so concurrent callers join this promise
    if (!searchKey) rolesCache.inflight = request;

    try {
      const list = await request;
      if (!searchKey) {
        // Never lock in an empty list as "fresh" — likely a parse/auth glitch
        if (list.length > 0 || !rolesCache.entry) {
          rolesCache.entry = { data: list, at: Date.now() };
        }
      }
      if (mountedRef.current) {
        hydrateFromCache(list);
        autoRetryRef.current = 0;
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (!msg || !mountedRef.current) return;

      // Soft retry when we have nothing to show
      if (autoRetryRef.current < 2 && !(rolesCache.entry?.data?.length)) {
        autoRetryRef.current += 1;
        const delay = 400 * Math.pow(2, autoRetryRef.current - 1);
        setTimeout(() => {
          if (mountedRef.current) fetchRoles(q, false);
        }, delay);
        return;
      }

      if (!(rolesCache.entry?.data?.length)) {
        setError(msg || "Failed to load roles");
      }
      setLoading(false);
    } finally {
      if (!searchKey && rolesCache.inflight === request) {
        rolesCache.inflight = null;
      }
    }
  }, []);

  const fetchPermissions = useCallback(async (force = false) => {
    // Fresh → done
    if (!force && isFresh(permissionsCache.entry)) {
      setPermissions(permissionsCache.entry!.data);
      return;
    }
    // Stale → paint now, refresh in background
    if (!force && permissionsCache.entry) {
      setPermissions(permissionsCache.entry.data);
    }
    // Join in-flight regardless of force — never double-hit the catalog
    if (permissionsCache.inflight) {
      try {
        const list = await permissionsCache.inflight;
        if (mountedRef.current) setPermissions(list);
      } catch {
        /* owner handles */
      }
      return;
    }

    // paginate=false → plain array, no withCount('roles') subquery per row
    const request = api.get("/permissions?per_page=500&paginate=false").then((res: any) => {
      const body =
        res && typeof res === "object" && "data" in res && res.status !== undefined
          ? res.data
          : res?.data !== undefined && !Array.isArray(res)
            ? res.data
            : res;
      return extractList<Permission>(body);
    });
    permissionsCache.inflight = request;

    try {
      const list = await request;
      permissionsCache.entry = { data: list, at: Date.now() };
      if (mountedRef.current) setPermissions(list);
    } catch (err) {
      // Soft fail – keep any stale catalog data
      getErrorMessage(err);
    } finally {
      if (permissionsCache.inflight === request) {
        permissionsCache.inflight = null;
      }
    }
  }, []);

  const fetchWarehouses = useCallback(async (force = false) => {
    // WarehouseController@index returns Warehouse::all() as a plain JSON array
    if (!force && isFresh(warehousesCache.entry)) {
      setAllWarehouses(warehousesCache.entry.data);
      return;
    }
    if (!force && warehousesCache.entry) {
      setAllWarehouses(warehousesCache.entry.data);
    }
    try {
      let list: Warehouse[];
      if (warehousesCache.inflight && !force) {
        list = await warehousesCache.inflight;
      } else {
        const request = api.get("/warehouses").then(({ data: json }) => {
          // Plain array from Warehouse::all(), or { data: [...] } wrappers
          const raw = Array.isArray(json)
            ? json
            : Array.isArray(json?.data)
              ? json.data
              : Array.isArray(json?.data?.data)
                ? json.data.data
                : [];
          return raw.map((w: any) => ({
            id: String(w.id),
            name: String(w.name ?? ""),
            code: w.code != null ? String(w.code) : undefined,
            location: w.location ?? w.address ?? null,
            address: w.address ?? w.location ?? null,
          })) as Warehouse[];
        });
        warehousesCache.inflight = request;
        try {
          list = await request;
        } finally {
          warehousesCache.inflight = null;
        }
        warehousesCache.entry = { data: list, at: Date.now() };
      }
      setAllWarehouses(list);
    } catch {
      /* optional – warehouse catalog may be empty */
    }
  }, []);

  /** Load permissions for a role – cache + inflight dedupe + stale-while-revalidate */
  const loadRolePermissions = useCallback(async (roleId: string, force = false) => {
    const cached = rolePermsCache.get(roleId) ?? null;

    // Fresh cache → instant, no network
    if (!force && isFresh(cached)) {
      lastPermRoleId.current = roleId;
      if (cached!.data.size === 0 && seedSystemDefaultsRef.current.has(roleId)) {
        const catalog = permissionsCache.entry?.data ?? [];
        const sysIds = systemPermissionIds(buildGroups(catalog));
        if (sysIds.length > 0) {
          setAssigned(new Set(sysIds));
          setAssignedOrig(new Set()); // dirty until save
          setPermCounts((prev) => ({ ...prev, [roleId]: sysIds.length }));
          seedSystemDefaultsRef.current.delete(roleId);
          setPermLoading(false);
          return;
        }
        seedSystemDefaultsRef.current.delete(roleId);
      }
      setAssigned(new Set(cached!.data));
      setAssignedOrig(new Set(cached!.data));
      setPermCounts((prev) => ({ ...prev, [roleId]: cached!.data.size }));
      setPermLoading(false);
      return;
    }

    // Stale cache → paint immediately, then revalidate in background
    if (!force && cached) {
      lastPermRoleId.current = roleId;
      setAssigned(new Set(cached.data));
      setAssignedOrig(new Set(cached.data));
      setPermCounts((prev) => ({ ...prev, [roleId]: cached.data.size }));
      setPermLoading(false); // UI is usable; quiet refresh below
    }

    // Already in-flight for this role → await the same promise (never abort+restart)
    if (rolePermsInflight.has(roleId)) {
      lastPermRoleId.current = roleId;
      if (!cached) setPermLoading(true);
      try {
        const ids = await rolePermsInflight.get(roleId)!;
        if (lastPermRoleId.current !== roleId) return;
        setAssigned(new Set(ids));
        setAssignedOrig(new Set(ids));
        setPermCounts((prev) => ({ ...prev, [roleId]: ids.size }));
      } catch {
        /* network / abort handled by the owner of the promise */
      } finally {
        if (lastPermRoleId.current === roleId) setPermLoading(false);
      }
      return;
    }

    // Switching roles: abort only the *previous role's* request
    if (lastPermRoleId.current && lastPermRoleId.current !== roleId) {
      permAbort.current?.abort();
    }
    lastPermRoleId.current = roleId;
    const ac = new AbortController();
    permAbort.current = ac;
    // Hard cap — backend has been seen at 30s+; don't leave the matrix locked forever
    const timeoutId = setTimeout(() => ac.abort(), SAVE_TIMEOUT_MS);

    // Only blank the matrix when we have zero data for this role
    if (!cached) {
      setAssigned(new Set());
      setAssignedOrig(new Set());
      setPermLoading(true);
    }

    const parseIds = (json: any): Set<string> => {
      const raw =
        json?.data?.permission_ids ??
        json?.permission_ids ??
        json?.data?.permissions ??
        json?.permissions ??
        extractList(json);

      if (!Array.isArray(raw)) return new Set();
      return new Set(
        raw
          .map((p: any) => (typeof p === "string" ? p : p?.id || p?.permission_id))
          .filter(Boolean)
      );
    };

    const fetchIds = async (): Promise<Set<string>> => {
      // ids_only=1 → tiny payload (just UUIDs). Catalog already has names.
      // If this takes 30s, the backend is loading full models / running N+1 — fix the API.
      try {
        const { data: json } = await api.get(`/roles/${roleId}/permissions`, {
          params: { ids_only: 1 },
          signal: ac.signal,
          timeout: SAVE_TIMEOUT_MS,
        });
        return parseIds(json);
      } catch (err: any) {
        // Fallback without query param in case the server only matches the plain path
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          const { data: json } = await api.get(`/roles/${roleId}/permissions`, {
            signal: ac.signal,
            timeout: SAVE_TIMEOUT_MS,
          });
          return parseIds(json);
        }
        throw err;
      }
    };

    const promise = fetchIds();
    rolePermsInflight.set(roleId, promise);

    try {
      const ids = await promise;
      if (ac.signal.aborted || lastPermRoleId.current !== roleId) return;

      // New role: pre-check SYSTEM (Users, Roles, Settings) so the admin can uncheck, then Save
      let finalIds = ids;
      if (ids.size === 0 && seedSystemDefaultsRef.current.has(roleId)) {
        const catalog = permissionsCache.entry?.data ?? [];
        const sysIds = systemPermissionIds(buildGroups(catalog));
        if (sysIds.length > 0) {
          finalIds = new Set(sysIds);
          // Orig empty → shows "Unsaved changes" until Save
          rolePermsCache.set(roleId, { data: new Set(), at: Date.now() });
          setAssigned(finalIds);
          setAssignedOrig(new Set());
          setPermCounts((prev) => ({ ...prev, [roleId]: finalIds.size }));
          seedSystemDefaultsRef.current.delete(roleId);
          return;
        }
        seedSystemDefaultsRef.current.delete(roleId);
      }

      rolePermsCache.set(roleId, { data: finalIds, at: Date.now() });
      setAssigned(finalIds);
      setAssignedOrig(new Set(finalIds));
      setPermCounts((prev) => ({ ...prev, [roleId]: finalIds.size }));
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError") {
        // Timed out or superseded — unlock UI; user can retry by re-selecting the role
        if (lastPermRoleId.current === roleId && !cached && mountedRef.current) {
          showToast(
            "error",
            "Slow server",
            "Loading assigned permissions timed out. Re-select the role to retry."
          );
        }
        return;
      }
      // Keep stale data on error – only clear when we never had any
      if (lastPermRoleId.current === roleId && !cached) {
        setAssigned(new Set());
        setAssignedOrig(new Set());
      }
    } finally {
      clearTimeout(timeoutId);
      rolePermsInflight.delete(roleId);
      if (!ac.signal.aborted && lastPermRoleId.current === roleId) setPermLoading(false);
      else if (ac.signal.aborted && lastPermRoleId.current === roleId) setPermLoading(false);
    }
  }, [showToast]);

  /** Users + derived warehouses – only when Users/Warehouses tab is opened */
  const loadRoleUsersAndWarehouses = useCallback(
    async (roleId: string, force = false) => {
      // Session-level "already shown for this role" short-circuit
      if (!force && usersLoadedFor === roleId) return;

      const cached = roleUsersCache.get(roleId) ?? null;
      const cacheFresh = cached && Date.now() - cached.at < ROLE_USERS_TTL_MS;

      // Instant paint from cache
      if (!force && cacheFresh) {
        setRoleUsers(cached!.data);
        setUserCounts((prev) => ({ ...prev, [roleId]: cached!.data.length }));
        setRoleWarehouses(warehousesFromUsers(cached!.data, allWarehouses));
        setUsersLoadedFor(roleId);
        setUsersLoading(false);
        return;
      }

      // Stale cache → paint then quiet revalidate
      if (!force && cached) {
        setRoleUsers(cached.data);
        setUserCounts((prev) => ({ ...prev, [roleId]: cached.data.length }));
        setRoleWarehouses(warehousesFromUsers(cached.data, allWarehouses));
        setUsersLoadedFor(roleId);
        setUsersLoading(false);
      }

      // Join in-flight request for this role
      if (roleUsersInflight.has(roleId)) {
        if (!cached) setUsersLoading(true);
        try {
          const users = await roleUsersInflight.get(roleId)!;
          if (!mountedRef.current) return;
          setRoleUsers(users);
          setUserCounts((prev) => ({ ...prev, [roleId]: users.length }));
          setRoleWarehouses(warehousesFromUsers(users, allWarehouses));
          setUsersLoadedFor(roleId);
        } catch {
          /* owner handles */
        } finally {
          if (mountedRef.current) setUsersLoading(false);
        }
        return;
      }

      usersAbort.current?.abort();
      const ac = new AbortController();
      usersAbort.current = ac;

      if (!cached) setUsersLoading(true);

      const fetchUsers = async (): Promise<RoleUser[]> => {
        // role_id filter is applied server-side; keep a light client filter as safety net
        const params = new URLSearchParams({
          role_id: roleId,
          per_page: "200",
          paginate: "false",
        });
        const { data: json } = await api.get(`/users?${params}`, { signal: ac.signal });
        let users: RoleUser[] = extractList(json);
        users = users.filter((u) => u.role?.id === roleId || u.role_id === roleId);
        return users;
      };

      const promise = fetchUsers();
      roleUsersInflight.set(roleId, promise);

      try {
        const users = await promise;
        if (ac.signal.aborted) return;
        roleUsersCache.set(roleId, { data: users, at: Date.now() });
        setRoleUsers(users);
        setUserCounts((prev) => ({ ...prev, [roleId]: users.length }));
        setRoleWarehouses(warehousesFromUsers(users, allWarehouses));
        setUsersLoadedFor(roleId);
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        if (!cached) {
          setRoleUsers([]);
          setRoleWarehouses([]);
        }
      } finally {
        roleUsersInflight.delete(roleId);
        if (!ac.signal.aborted && mountedRef.current) setUsersLoading(false);
      }
    },
    [allWarehouses, usersLoadedFor]
  );

  /* ================================================================ */
  /* Effects                                                          */
  /* ================================================================ */

  // Bootstrap once per session — module flag survives Strict Mode remounts.
  // Remounts ONLY hydrate from cache / join in-flight — never start a second network call.
  useEffect(() => {
    mountedRef.current = true;

    const hydrateRoles = (list: Role[]) => {
      setRoles(list);
      setLoading(false);
      const { nextPerm, nextUser } = countsFromRoles(list);
      if (Object.keys(nextPerm).length) setPermCounts((prev) => ({ ...prev, ...nextPerm }));
      if (Object.keys(nextUser).length) setUserCounts((prev) => ({ ...prev, ...nextUser }));
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        if (!prev && list[0]?.id) return list[0].id;
        if (prev && !list.some((r) => r.id === prev)) return list[0]?.id ?? null;
        return prev;
      });
    };

    if (!catalogBootstrapStarted) {
      catalogBootstrapStarted = true;
      void fetchRoles("");
      void fetchPermissions();
    } else {
      // Strict Mode remount / revisit: paint cache, or join in-flight — no new requests
      if (rolesCache.entry) {
        hydrateRoles(rolesCache.entry.data);
      } else if (rolesCache.inflight) {
        rolesCache.inflight.then((list) => {
          if (mountedRef.current) hydrateRoles(list);
        }).catch(() => {});
      }
      if (permissionsCache.entry) {
        setPermissions(permissionsCache.entry.data);
      } else if (permissionsCache.inflight) {
        permissionsCache.inflight.then((list) => {
          if (mountedRef.current) setPermissions(list);
        }).catch(() => {});
      }
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quiet revalidate when tab becomes visible and cache is stale
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isFresh(rolesCache.entry)) fetchRoles("", false);
      if (!isFresh(permissionsCache.entry)) fetchPermissions(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchRoles, fetchPermissions]);

  // When selected role changes → load assigned permission IDs only (skip if already loaded)
  useEffect(() => {
    if (!selectedId) {
      setAssigned(new Set());
      setAssignedOrig(new Set());
      setRoleUsers([]);
      setRoleWarehouses([]);
      setUsersLoadedFor(null);
      lastPermRoleId.current = null;
      setPermLoading(false);
      return;
    }

    // Same role already handled this session — paint cache / join in-flight, never double-fetch
    if (lastPermRoleId.current === selectedId) {
      const cached = rolePermsCache.get(selectedId);
      if (cached) {
        setAssigned(new Set(cached.data));
        setAssignedOrig(new Set(cached.data));
        setPermCounts((prev) => ({ ...prev, [selectedId]: cached.data.size }));
        setPermLoading(false);
        return;
      }
      if (rolePermsInflight.has(selectedId)) {
        void loadRolePermissions(selectedId, false);
      }
      return;
    }

    setDetailTab("permissions");
    setPermFilter("");
    setGroupFilter("all");
    setRoleUsers([]);
    setRoleWarehouses([]);
    setUsersLoadedFor(null);
    void loadRolePermissions(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Lazy-load users + warehouses ONLY when those tabs open
  useEffect(() => {
    if (!selectedId) return;
    if (detailTab === "users" || detailTab === "warehouses") {
      // Ensure warehouse catalog exists before deriving scope
      fetchWarehouses().then(() => loadRoleUsersAndWarehouses(selectedId));
    }
  }, [detailTab, selectedId, loadRoleUsersAndWarehouses, fetchWarehouses]);

  // Re-derive warehouses if the warehouse catalog arrives after users were already loaded
  useEffect(() => {
    if (usersLoadedFor && roleUsers.length > 0 && allWarehouses.length > 0) {
      setRoleWarehouses(warehousesFromUsers(roleUsers, allWarehouses));
    }
  }, [allWarehouses, usersLoadedFor, roleUsers]);

  // Escape closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !permSaving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, permSaving]);

  /* ================================================================ */
  /* Derived values (memoized)                                        */
  /* ================================================================ */

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) || null, [roles, selectedId]);
  const selectedScope = useMemo(() => (selected ? scopeFromName(selected.name) : "custom"), [selected]);
  const selectedIsAdmin = useMemo(() => isAdminRole(selected?.name), [selected]);

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

  // Groups are expensive – compute once when permissions change
  const allGroups = useMemo(() => buildGroups(permissions), [permissions]);
  const systemIds = useMemo(() => systemPermissionIds(allGroups), [allGroups]);
  const systemIdSet = useMemo(() => new Set(systemIds), [systemIds]);

  // Admin role: SYSTEM perms always checked & locked (cannot uncheck)
  useEffect(() => {
    if (!selectedId || !selectedIsAdmin) return;
    if (systemIds.length === 0) return;
    setAssigned((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of systemIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setAssignedOrig((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of systemIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedId, selectedIsAdmin, systemIds]);

  // Drop SYSTEM filter when switching to a non-admin role
  useEffect(() => {
    if (!selectedIsAdmin && groupFilter === "section:SYSTEM") {
      setGroupFilter("all");
    }
  }, [selectedIsAdmin, groupFilter]);

  // Non-admin new role: do not seed SYSTEM (section is hidden for non-admin)
  // Admin new role is handled by the lock effect above.

  const sectionOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const g of allGroups) {
      // SYSTEM only visible for Admin role
      if (g.section === "SYSTEM" && !selectedIsAdmin) continue;
      if (seen.has(g.section)) continue;
      seen.add(g.section);
      opts.push({ value: `section:${g.section}`, label: g.section });
    }
    return opts;
  }, [allGroups, selectedIsAdmin]);

  const visibleGroups = useMemo(() => {
    let list = allGroups;
    // Hide SYSTEM section entirely unless the selected role is Admin
    if (!selectedIsAdmin) {
      list = list.filter((g) => g.section !== "SYSTEM");
    }
    if (groupFilter !== "all") {
      if (groupFilter.startsWith("section:")) {
        const sec = groupFilter.slice("section:".length);
        list = list.filter((g) => g.section === sec);
      } else {
        list = list.filter((g) => g.key === groupFilter);
      }
    }
    const q = permFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.section.toLowerCase().includes(q) ||
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
  }, [allGroups, groupFilter, permFilter, selectedIsAdmin]);

  /** Groups with section header markers for matrix rendering */
  const matrixRows = useMemo(() => {
    const rows: ({ type: "section"; section: string } | { type: "group"; group: PermGroup })[] = [];
    let lastSection = "";
    for (const g of visibleGroups) {
      if (g.section !== lastSection) {
        rows.push({ type: "section", section: g.section });
        lastSection = g.section;
      }
      rows.push({ type: "group", group: g });
    }
    return rows;
  }, [visibleGroups]);

  const enabledCount = assigned.size;
  const groupCount = allGroups.length;
  const hasAllWarehouses = roleUsers.some((u) => u.access_all_warehouses);

  /* ================================================================ */
  /* Actions                                                          */
  /* ================================================================ */

  const togglePerm = useCallback(
    (id: string | undefined) => {
      if (!id) return;
      // Admin SYSTEM permissions are locked — cannot uncheck
      if (selectedIsAdmin && systemIdSet.has(id)) return;
      setAssigned((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [selectedIsAdmin, systemIdSet]
  );

  const rowStats = useCallback(
    (g: PermGroup) => {
      const ids = [
        ...CRUD_ACTIONS.map((a) => g.actions[a]?.id).filter(Boolean),
        ...g.extras.map((p) => p.id),
      ] as string[];
      const on = ids.filter((id) => assigned.has(id)).length;
      return { on, total: ids.length };
    },
    [assigned]
  );

  const savePermissions = async () => {
    // Synchronous lock — permSaving state updates too late to stop a double-click
    if (!selectedId || permSaving || saveLockRef.current) return;
    saveLockRef.current = true;

    let permission_ids = Array.from(assigned);
    if (selectedIsAdmin) {
      const merged = new Set(permission_ids);
      for (const id of systemIds) merged.add(id);
      permission_ids = Array.from(merged);
    } else {
      permission_ids = permission_ids.filter((id) => !systemIdSet.has(id));
    }

    const savedSet = new Set(permission_ids);
    const prevAssigned = new Set(assigned);
    const prevOrig = new Set(assignedOrig);
    const prevCount = permCounts[selectedId];
    const roleId = selectedId;

    // Do NOT abort a save already in flight — that produced the ~0.12ms cancelled + ~6s retry pair.
    // Only create a controller for timeout / unmount cancellation.
    const ac = new AbortController();
    saveAbort.current = ac;
    const timeoutId = setTimeout(() => ac.abort(), SAVE_TIMEOUT_MS);

    // Optimistic UI — checkboxes + dirty flag update immediately; network runs in background
    setAssigned(savedSet);
    setAssignedOrig(new Set(savedSet));
    setPermCounts((prev) => ({ ...prev, [roleId]: savedSet.size }));
    rolePermsCache.set(roleId, { data: new Set(savedSet), at: Date.now() });
    setPermSaving(true);

    // Always POST — this API rejects PUT with 405 (~0.2ms) then a second POST (~7–10s).
    const route: SyncRoute =
      knownSyncRoute.method === "post" ? knownSyncRoute : DEFAULT_SYNC_ROUTE;

    try {
      const url = syncUrl(roleId, route.path);
      await api.post(
        url,
        { permission_ids },
        { signal: ac.signal, timeout: SAVE_TIMEOUT_MS }
      );
      knownSyncRoute = route;
      persistKnownSyncRoute(route);

      if (ac.signal.aborted) {
        if (mountedRef.current) {
          showToast(
            "error",
            "Still saving…",
            "Server is slow. Permissions may already be updated — refresh to confirm."
          );
        }
        return;
      }

      if (mountedRef.current) {
        showToast("success", "Saved", "Permissions updated.");
        notifyPermissionsChanged();
      }
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError") {
        if (mountedRef.current) {
          showToast(
            "error",
            "Still saving…",
            "Server is slow. Permissions may already be updated — refresh to confirm."
          );
        }
        return;
      }
      // If /sync is missing, one fallback to POST /permissions (still POST-only)
      const status = e?.response?.status;
      if (status === 404 && route.path === "sync") {
        try {
          await api.post(
            syncUrl(roleId, "plain"),
            { permission_ids },
            { signal: ac.signal, timeout: SAVE_TIMEOUT_MS }
          );
          knownSyncRoute = { method: "post", path: "plain" };
          persistKnownSyncRoute(knownSyncRoute);
          if (mountedRef.current) {
            showToast("success", "Saved", "Permissions updated.");
            notifyPermissionsChanged();
          }
          return;
        } catch (e2: any) {
          e = e2;
        }
      }
      const msg = getErrorMessage(e, e?.message || "Could not save");
      // Roll back optimistic state only on real failure (not timeout — handled above)
      if (mountedRef.current) {
        setAssigned(prevAssigned);
        setAssignedOrig(prevOrig);
        setPermCounts((prev) => {
          const next = { ...prev };
          if (prevCount === undefined) delete next[roleId];
          else next[roleId] = prevCount;
          return next;
        });
        rolePermsCache.set(roleId, { data: prevOrig, at: Date.now() });
        if (msg) showToast("error", "Error", msg);
      }
    } finally {
      clearTimeout(timeoutId);
      if (saveAbort.current === ac) saveAbort.current = null;
      saveLockRef.current = false;
      if (mountedRef.current) setPermSaving(false);
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
    const name = form.name.trim();
    if (!name) {
      showToast("error", "Validation", "Role name is required.");
      return;
    }
    if (name.length < 2) {
      showToast("error", "Validation", "Role name must be at least 2 characters.");
      return;
    }
    if (name.length > 100) {
      showToast("error", "Validation", "Role name must be 100 characters or fewer.");
      return;
    }
    // Client-side uniqueness check against already-loaded roles
    const duplicate = roles.some(
      (r) =>
        r.name.toLowerCase() === name.toLowerCase() &&
        (!editing || r.id !== editing.id)
    );
    if (duplicate) {
      showToast("error", "Validation", `A role named "${name}" already exists.`);
      return;
    }

    if (saving) return;

    roleSaveAbort.current?.abort();
    const ac = new AbortController();
    roleSaveAbort.current = ac;
    const timeoutId = setTimeout(() => ac.abort(), SAVE_TIMEOUT_MS);

    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim() || null,
      };
      const config = { signal: ac.signal, timeout: SAVE_TIMEOUT_MS };

      let saved: Role;
      if (editing) {
        const { data: json } = await api.put(`/roles/${editing.id}`, payload, config);
        saved = (json?.data ?? json) as Role;
        // Optimistic local update — no full list refetch
        const next = roles.map((r) =>
          r.id === editing.id
            ? { ...r, name: saved.name ?? name, description: saved.description ?? payload.description }
            : r
        );
        setRoles(next);
        rolesCache.entry = { data: next, at: Date.now() };
        setSelectedId(editing.id);
      } else {
        const { data: json } = await api.post("/roles", payload, config);
        saved = (json?.data ?? json) as Role;
        const newRole: Role = {
          id: String(saved.id),
          name: saved.name ?? name,
          description: saved.description ?? payload.description,
          permission_count: 0,
          user_count: 0,
        };
        // Insert sorted by name for instant UI
        const next = [...roles, newRole].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setRoles(next);
        rolesCache.entry = { data: next, at: Date.now() };
        setPermCounts((prev) => ({ ...prev, [newRole.id]: 0 }));
        setUserCounts((prev) => ({ ...prev, [newRole.id]: 0 }));
        // Seed empty perm cache so selecting the new role does not flash a network spinner
        // when the role truly has zero permissions (non-admin). Admin still seeds SYSTEM.
        if (isAdminRole(newRole.name)) {
          seedSystemDefaultsRef.current.add(newRole.id);
        } else {
          rolePermsCache.set(newRole.id, { data: new Set(), at: Date.now() });
        }
        setSelectedId(newRole.id);
      }

      if (mountedRef.current) {
        showToast("success", editing ? "Updated" : "Created", editing ? "Role updated." : "Role created.");
        setModalOpen(false);
      }
    } catch (err: any) {
      const msg = getErrorMessage(err, "Save failed");
      if (mountedRef.current && msg) {
        showToast("error", "Error", msg);
      }
    } finally {
      clearTimeout(timeoutId);
      if (roleSaveAbort.current === ac) roleSaveAbort.current = null;
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"? Assigned permissions will be detached.`)) return;
    try {
      await api.delete(`/roles/${role.id}`, { timeout: SAVE_TIMEOUT_MS });
      showToast("success", "Deleted", "Role removed.");
      const next = roles.filter((r) => r.id !== role.id);
      setRoles(next);
      rolesCache.entry = { data: next, at: Date.now() };
      rolePermsCache.delete(role.id);
      roleUsersCache.delete(role.id);
      roleUsersInflight.delete(role.id);
      setPermCounts((prev) => {
        const n = { ...prev };
        delete n[role.id];
        return n;
      });
      setUserCounts((prev) => {
        const n = { ...prev };
        delete n[role.id];
        return n;
      });
      if (selectedId === role.id) {
        setSelectedId(next[0]?.id ?? null);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Could not delete role");
      if (msg) showToast("error", "Error", msg);
    }
  };

  const actionClass = (action: CrudAction) => `rac-action rac-action-${action}`;

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */

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
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => { rolesCache.entry = null; fetchRoles("", true); }}>
                Retry
              </button>
            </div>
          )}

          <div className="rac-layout">
            {/* ---------- Roles list ---------- */}
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
                {loading && roles.length === 0 ? (
                  <div className="roles-empty">
                    <span className="roles-spinner" />
                    Loading…
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <div className="roles-empty">
                    <p>{loading ? "Loading…" : "No roles yet."}</p>
                    {!loading && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                        <IconPlus /> Create Role
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRoles.map((r) => (
                    <RoleCard
                      key={r.id}
                      role={r}
                      active={r.id === selectedId}
                      permCount={permCounts[r.id]}
                      userCount={userCounts[r.id]}
                      onSelect={setSelectedId}
                    />
                  ))
                )}
              </div>
            </aside>

            {/* ---------- Detail panel ---------- */}
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
                          <span className={`role-scope-badge scope-${selectedScope}`}>
                            {scopeLabel(selectedScope)}
                          </span>
                        </div>
                        <p className="rac-detail-desc">
                          {selected.description || "No description"}
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
                      <IconUsers /> Users (
                      {usersLoadedFor === selectedId
                        ? usersLoading
                          ? "…"
                          : roleUsers.length
                        : selectedId
                          ? userCounts[selectedId] ?? "—"
                          : "—"}
                      )
                    </button>
                    <button
                      type="button"
                      className={`rac-tab ${detailTab === "warehouses" ? "active" : ""}`}
                      onClick={() => setDetailTab("warehouses")}
                    >
                      <IconWarehouse /> Warehouses (
                      {usersLoadedFor === selectedId
                        ? usersLoading
                          ? "…"
                          : hasAllWarehouses
                            ? "All"
                            : roleWarehouses.length
                        : "—"}
                      )
                    </button>
                  </div>

                  {/* ---- Permissions tab ---- */}
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
                            <strong>
                              {usersLoadedFor === selectedId
                                ? usersLoading
                                  ? "…"
                                  : roleUsers.length
                                : selectedId
                                  ? userCounts[selectedId] ?? "—"
                                  : "—"}
                            </strong>
                            <span>Users Assigned</span>
                          </div>
                        </div>
                        <div className="rac-stat rac-stat-wh">
                          <IconWarehouse />
                          <div>
                            <strong>
                              {usersLoadedFor === selectedId
                                ? usersLoading
                                  ? "…"
                                  : hasAllWarehouses
                                    ? "All"
                                    : roleWarehouses.length || "—"
                                : "—"}
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
                        <select
                          className="rac-select"
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                        >
                          <option value="all">All Sections</option>
                          {sectionOptions.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
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
                          {permSaving ? "Saving…" : (
                            <>
                              <IconCheck /> Save
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rac-table-wrap">
                        {visibleGroups.length === 0 && !permLoading ? (
                          <div className="roles-empty">
                            <p>No groups match your filters.</p>
                          </div>
                        ) : allGroups.length === 0 && permLoading ? (
                          <div className="roles-empty">
                            <span className="roles-spinner" />
                            Loading permission catalog…
                          </div>
                        ) : (
                          <>
                            {permLoading && (
                              <div className="rac-perm-loading-bar" aria-live="polite">
                                <span className="roles-spinner" /> Loading assigned permissions…
                              </div>
                            )}
                            <table className={`rac-matrix ${permLoading ? "rac-matrix-loading" : ""}`}>
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
                                {matrixRows.map((row) => {
                                  if (row.type === "section") {
                                    return (
                                      <tr key={`sec-${row.section}`} className="rac-section-row">
                                        <td
                                          colSpan={7}
                                          style={{
                                            padding: "10px 12px 6px",
                                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                                            background: "transparent",
                                          }}
                                        >
                                          <span
                                            className="rac-section-label-row"
                                            style={{
                                              display: "inline-block",
                                              fontSize: 11,
                                              fontWeight: 600,
                                              letterSpacing: "0.08em",
                                              textTransform: "uppercase",
                                              color: "rgba(255,255,255,0.45)",
                                            }}
                                          >
                                            {row.section}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  }
                                  const g = row.group;
                                  const { on, total } = rowStats(g);
                                  const hasAnyAction = CRUD_ACTIONS.some((a) => g.actions[a]);
                                  const systemLocked = selectedIsAdmin && g.section === "SYSTEM";
                                  return (
                                    <tr
                                      key={g.key}
                                      className={!hasAnyAction ? "rac-group-empty" : undefined}
                                      title={systemLocked ? "System access is required for Admin and cannot be changed" : undefined}
                                    >
                                      <td>
                                        <span className="rac-group-cell">
                                          <span className="fw-600">{g.label}</span>
                                          {systemLocked && (
                                            <span
                                              style={{
                                                marginLeft: 8,
                                                fontSize: 10,
                                                fontWeight: 600,
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                                color: "rgba(255,255,255,0.4)",
                                              }}
                                            >
                                              Locked
                                            </span>
                                          )}
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
                                        const checked = systemLocked ? true : assigned.has(p.id);
                                        return (
                                          <td key={action} className="rac-col-action">
                                            <input
                                              type="checkbox"
                                              className={actionClass(action)}
                                              checked={checked}
                                              disabled={permLoading || systemLocked}
                                              onChange={() => togglePerm(p.id)}
                                              title={systemLocked ? "Required for Admin — cannot be changed" : p.name}
                                            />
                                          </td>
                                        );
                                      })}
                                      <td className="rac-col-total">
                                        <span className="rac-total-pill">
                                          {permLoading ? "…" : `${on}/${total}`}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                      {visibleGroups.length > 0 && (
                        <div className="rac-table-foot">
                          Showing {visibleGroups.length} of {groupCount} groups
                        </div>
                      )}
                    </>
                  ) : detailTab === "users" ? (
                    /* ---- Users tab ---- */
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
                                (u.status || "active").toLowerCase() === "active"
                                  ? "status-active"
                                  : "status-cancelled"
                              }`}
                            >
                              {u.status || "active"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* ---- Warehouses tab ---- */
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
                            <div className="roles-all-banner">
                              One or more users have access to all warehouses.
                            </div>
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
                                    <span style={{ marginLeft: w.code ? 8 : 0 }}>
                                      {w.location || w.address}
                                    </span>
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

      {/* ---------- Create / Edit modal ---------- */}
      {modalOpen && (
        <div
          className="roles-modal-overlay"
          onClick={() => !saving && setModalOpen(false)}
          role="presentation"
        >
          <div
            className="card roles-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="roles-modal-header">
              <h2>{editing ? "Edit Role" : "Create Role"}</h2>
              <button
                type="button"
                className="roles-modal-close"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleRoleSave}>
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
                  <button
                    type="button"
                    className="btn btn-secondary roles-delete-btn"
                    disabled={saving}
                    onClick={() => handleDelete(editing)}
                  >
                    <IconTrash /> Delete
                  </button>
                )}
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

export default Roles;