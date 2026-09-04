import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import {
  useRolesList,
  usePermissionsCatalog,
  useRolePermissions,
  useRoleUsers,
  useWarehousesCatalog,
} from "../../hooks/useRolesPage";
import { invalidateRoles } from "../../lib/invalidate";
import { queryClient, queryKeys } from "../../lib/queryClient";
import "../css/System.css";

/* ------------------------------------------------------------------ */
/* Icons                                                              */
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

/**
 * MUST stay in sync with Sidebar NAV_MODULES.
 * key = canonical module name used in permission strings (e.g. inventory.view)
 * aliases = every possible token that can appear in a permission name
 */
const MODULE_CATALOG: {
  section: string;
  sectionOrder: number;
  modules: { key: string; label: string; aliases: string[]; description: string }[];
}[] = [
  {
    section: "MAIN",
    sectionOrder: 0,
    modules: [
      {
        key: "dashboard",
        label: "Dashboard",
        aliases: ["dashboard", "home", "overview"],
        description: "Main dashboard and overview widgets",
      },
      {
        key: "inventory",
        label: "Inventory",
        aliases: [
          "inventory",
          "inventories",
          "stock",
          "items",
          "item",
          "products",
          "product",
          "skus",
          "sku",
        ],
        description: "Stock levels, items, and product catalog",
      },
      {
        key: "stock_movements",
        label: "Stock Movements",
        aliases: [
          "stock_movements",
          "stock_movement",
          "movements",
          "movement",
          "transfers",
          "transfer",
          "adjustments",
          "adjustment",
        ],
        description: "Transfers, adjustments, and stock history",
      },
    ],
  },
  {
    section: "ORDERS",
    sectionOrder: 1,
    modules: [
      {
        key: "purchase_orders",
        label: "Purchase Orders",
        aliases: ["purchase_orders", "purchase_order", "po", "purchases", "purchase"],
        description: "Inbound purchase orders and suppliers buys",
      },
      {
        key: "sales_orders",
        label: "Sales Orders",
        aliases: ["sales_orders", "sales_order", "so",  "sales"],
        description: "Customer sales orders and fulfillment",
      },
      {
        key: "receiving",
        label: "Receiving",
        aliases: [
          "receiving",
          "receipts",
          "receipt",
          "inbound",
          "goods_receipts",
          "goods_receiving",
        ],
        description: "Inbound receiving and put-away",
      },
      {
        key: "shipping",
        label: "Shipping",
        aliases: ["shipping", "shipments", "shipment", "outbound", "dispatch"],
        description: "Outbound shipping and carrier handoff",
      },
      {
        key: "returns",
        label: "Returns",
        aliases: ["returns", "return", "rma"],
        description: "Customer and supplier returns",
      },
    ],
  },
  {
    section: "WAREHOUSE",
    sectionOrder: 2,
    modules: [
      {
        key: "locations",
        label: "Locations",
        aliases: [
          "locations",
          "location",
          "warehouses",
          "warehouse",
          "bins",
          "bin",
          "zones",
          "zone",
        ],
        description: "Bins, zones, and warehouse locations",
      },
      {
        key: "capacity",
        label: "Capacity",
        aliases: ["capacity", "space", "utilization"],
        description: "Space utilization and capacity planning",
      },
      {
        key: "cycle_count",
        label: "Cycle Count",
        aliases: [
          "cycle_count",
          "cycle_counts",
          "counts",
          "count",
          "stocktake",
          "physical_count",
        ],
        description: "Cycle counts and stocktakes",
      },
    ],
  },
  {
    section: "PARTNERS",
    sectionOrder: 3,
    modules: [
      {
        key: "suppliers",
        label: "Suppliers",
        aliases: ["suppliers", "supplier", "vendors", "vendor"],
        description: "Supplier master data",
      },
      {
        key: "customers",
        label: "Customers",
        aliases: ["customers", "customer", "clients", "client"],
        description: "Customer master data",
      },
    ],
  },
  {
    section: "INSIGHTS",
    sectionOrder: 4,
    modules: [
      {
        key: "reports",
        label: "Reports",
        aliases: ["reports", "report"],
        description: "Operational and financial reports",
      },
      {
        key: "analytics",
        label: "Analytics",
        aliases: ["analytics", "insights", "metrics"],
        description: "Analytics and performance insights",
      },
    ],
  },
  {
    section: "SYSTEM",
    sectionOrder: 5,
    modules: [
      {
        key: "users",
        label: "Users",
        aliases: ["users", "user", "accounts", "account"],
        description: "User accounts and access assignment",
      },
      {
        key: "roles",
        label: "Roles",
        aliases: ["roles", "role", "permissions", "permission", "access"],
        description: "Roles and permission management",
      },
      {
        key: "settings",
        label: "Settings",
        aliases: [
          "settings",
          "setting",
          "config",
          "configuration",
          "system",
          "company",
        ],
        description: "System configuration and preferences",
      },
    ],
  },
];

const MODULE_LOOKUP: Map<
  string,
  {
    section: string;
    sectionOrder: number;
    moduleOrder: number;
    label: string;
    description: string;
    key: string;
  }
> = (() => {
  const map = new Map<
    string,
    {
      section: string;
      sectionOrder: number;
      moduleOrder: number;
      label: string;
      description: string;
      key: string;
    }
  >();
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

function resolveModule(groupRaw: string) {
  const norm = groupRaw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[.-]+/g, "_");

  // Exact match only
  const direct = MODULE_LOOKUP.get(norm);
  if (direct) return direct;

  // Fallback for unknown modules
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
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function roleInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeAction(raw: string): CrudAction | null {
  const a = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (["view", "read", "show", "list", "index", "get", "access"].includes(a))
    return "view";
  if (
    ["create", "add", "store", "write", "insert", "new", "export", "schedule"].includes(
      a
    )
  )
    return "create";
  if (
    [
      "update",
      "edit",
      "modify",
      "put",
      "patch",
      "manage",
      "sync",
      "complete",
      "process",
      "approve",
      "start",
    ].includes(a)
  )
    return "update";
  if (["delete", "destroy", "remove", "trash", "cancel"].includes(a)) return "delete";
  if (/(^|_)(view|read|show|list|index)(_|$)/.test(a)) return "view";
  if (/(^|_)(create|add|store|write|export)(_|$)/.test(a)) return "create";
  if (/(^|_)(update|edit|modify|manage|sync|complete)(_|$)/.test(a)) return "update";
  if (/(^|_)(delete|destroy|remove|trash)(_|$)/.test(a)) return "delete";
  return null;
}

function parsePermName(name: string): {
  group: string;
  action: string;
  crud: CrudAction | null;
} {
  const cleaned = String(name || "").trim();
  const parts = cleaned.split(/[._-]/).filter(Boolean);
  if (parts.length < 2) {
    const crud = normalizeAction(cleaned) || "view";
    return {
      group: cleaned || "other",
      action: cleaned.toLowerCase() || "view",
      crud,
    };
  }
  const actionRaw = parts[parts.length - 1];
  const group = parts.slice(0, -1).join("_");
  const crud =
    normalizeAction(actionRaw) || normalizeAction(parts.slice(1).join("_"));
  return { group: group || parts[0], action: actionRaw.toLowerCase(), crud };
}

function scopeFromName(name: string): "system" | "warehouse" | "readonly" | "custom" {
  const key = name.trim().toLowerCase();
  if (key === "admin" || key.includes("admin") || key.includes("system"))
    return "system";
  if (
    key === "viewer" ||
    key.includes("viewer") ||
    key.includes("read only") ||
    key.includes("readonly")
  )
    return "readonly";
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

/**
 * Exact-match admin detection (aligned with Sidebar).
 * Does NOT treat every name containing the word "admin" as full admin.
 */
function isAdminRole(name: string | null | undefined): boolean {
  if (!name) return false;
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ");
  return (
    key === "admin" ||
    key === "administrator" ||
    key === "system admin" ||
    key === "system administrator" ||
    key === "super admin" ||
    key === "superadmin" ||
    key === "root"
  );
}

function scopeLabel(
  scope: "system" | "warehouse" | "readonly" | "custom" | undefined
): string {
  if (scope === "system") return "SYSTEM";
  if (scope === "readonly") return "READ ONLY";
  if (scope === "warehouse") return "WAREHOUSE";
  return "CUSTOM";
}

function buildGroups(perms: Permission[]): PermGroup[] {
  const map = new Map<string, PermGroup>();
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
    if (
      p.description &&
      (g.description === meta.description || g.description.endsWith(" module"))
    ) {
      g.description = p.description;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.label.localeCompare(b.label);
  });
}

function warehousesFromUsers(
  users: RoleUser[],
  allWarehouses: Warehouse[] | unknown
): Warehouse[] {
  const list: Warehouse[] = Array.isArray(allWarehouses)
    ? (allWarehouses as Warehouse[])
    : [];
  if (users.some((u) => u.access_all_warehouses)) {
    return list.length > 0 ? list : [];
  }
  const index = new Map(list.map((w) => [w.id, w]));
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
      seen.set(
        u.warehouse_id,
        found || {
          id: u.warehouse_id,
          name: `Warehouse ${u.warehouse_id.slice(0, 8)}`,
        }
      );
    }
  }
  return Array.from(seen.values());
}

function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
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

function actionClass(action: CrudAction): string {
  if (action === "view") return "rac-check rac-check-view";
  if (action === "create") return "rac-check rac-check-create";
  if (action === "update") return "rac-check rac-check-update";
  return "rac-check rac-check-delete";
}

/* ------------------------------------------------------------------ */
/* Permission sync                                                    */
/* ------------------------------------------------------------------ */

type SyncRoute = { method: "put" | "post"; path: "sync" | "plain" };

const SYNC_ROUTE_STORAGE_KEY = "rac.knownSyncRoute";
const SAVE_TIMEOUT_MS = 30_000;

function loadKnownSyncRoute(): SyncRoute | null {
  try {
    const raw = sessionStorage.getItem(SYNC_ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncRoute;
    if (
      parsed.method === "post" &&
      (parsed.path === "sync" || parsed.path === "plain")
    ) {
      return parsed;
    }
    sessionStorage.removeItem(SYNC_ROUTE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

function persistKnownSyncRoute(route: SyncRoute | null) {
  try {
    if (route && route.method === "post") {
      sessionStorage.setItem(SYNC_ROUTE_STORAGE_KEY, JSON.stringify(route));
    } else {
      sessionStorage.removeItem(SYNC_ROUTE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

const DEFAULT_SYNC_ROUTE: SyncRoute = { method: "post", path: "sync" };
let knownSyncRoute: SyncRoute = loadKnownSyncRoute() ?? DEFAULT_SYNC_ROUTE;

function syncUrl(roleId: string, path: "sync" | "plain"): string {
  return path === "sync"
    ? `/roles/${roleId}/permissions/sync`
    : `/roles/${roleId}/permissions`;
}

function notifyPermissionsChanged() {
  const keys = ["permissions", "user_permissions", "auth_permissions"];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
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

/* ------------------------------------------------------------------ */
/* Role card                                                          */
/* ------------------------------------------------------------------ */

type RoleCardProps = {
  role: Role;
  active: boolean;
  permCount?: number;
  userCount?: number;
  onSelect: (id: string) => void;
};

const RoleCard = React.memo(function RoleCard({
  role,
  active,
  permCount,
  userCount,
  onSelect,
}: RoleCardProps) {
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
  const rolesQ = useRolesList();
  const permsQ = usePermissionsCatalog();
  const warehousesQ = useWarehousesCatalog();

  const roles = rolesQ.rows as Role[];
  const permissions = permsQ.rows as Permission[];
  const allWarehouses: Warehouse[] = Array.isArray(warehousesQ.rows)
    ? (warehousesQ.rows as Warehouse[])
    : [];

  const loading = rolesQ.isLoading && roles.length === 0;
  const error =
    rolesQ.isError && roles.length === 0
      ? getErrorMessage(rolesQ.error, "Unable to load roles")
      : null;

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("permissions");
  const [permFilter, setPermFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [assignedRoleId, setAssignedRoleId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const skipAssignedSyncRef = useRef(false);
  const didAutoSelectRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);

  const [toast, setToast] = useState<{
    type: string;
    title: string;
    msg: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const rolePermsQ = useRolePermissions(selectedId, { enabled: !!selectedId });
  const roleUsersQ = useRoleUsers(selectedId, {
    enabled: !!selectedId && (detailTab === "users" || detailTab === "warehouses"),
  });

  const roleUsers = roleUsersQ.rows as RoleUser[];
  const usersLoading = roleUsersQ.isLoading;
  const usersLoadedFor = roleUsersQ.data !== undefined ? selectedId : null;
  // Only block the matrix when there is no assigned-permission data yet.
  // A stale refetch keeps the current matrix usable.
  const permLoading = rolePermsQ.isLoading && !rolePermsQ.data;
  const catalogLoading = permsQ.isLoading && permissions.length === 0;

  const serverPermKey = useMemo(
    () => Array.from(rolePermsQ.ids).sort().join(","),
    [rolePermsQ.ids]
  );

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId]
  );
  const selectedScope = selected ? scopeFromName(selected.name) : undefined;
  const selectedIsAdmin = isAdminRole(selected?.name);
  const catalogReady = permissions.length > 0;
  const adminLocked = selectedIsAdmin && catalogReady;

  /* Auto-select first role once only */
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (!selectedId && roles.length > 0) {
      didAutoSelectRef.current = true;
      setSelectedId(roles[0].id);
    }
  }, [roles, selectedId]);

  /* Real role switch only — clear matrix */
  useEffect(() => {
    if (selectedId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedId;

    setAssigned(new Set());
    setAssignedRoleId(null);
    setDirty(false);
    skipAssignedSyncRef.current = false;
  }, [selectedId]);

  /* Hydrate assigned when THIS role's query has settled */
  useEffect(() => {
    if (!selectedId) return;

    // Wait for role-permissions fetch to finish
    if (rolePermsQ.isLoading || rolePermsQ.isFetching) return;

    // Admin needs catalog before expanding to "all"
    const roleName = roles.find((r) => r.id === selectedId)?.name;
    const isAdmin = isAdminRole(roleName);
    if (isAdmin && permissions.length === 0) return;

    if (skipAssignedSyncRef.current) {
      skipAssignedSyncRef.current = false;
      return;
    }

    // Don't overwrite in-progress edits for this role
    if (dirty && assignedRoleId === selectedId) return;

    // Already hydrated this role with same server data (non-admin)
    if (assignedRoleId === selectedId && !dirty && !isAdmin) return;

    // Admin already fully expanded
    if (
      isAdmin &&
      assignedRoleId === selectedId &&
      permissions.length > 0 &&
      assigned.size >= permissions.length
    ) {
      return;
    }

    const next = new Set<string>();
    if (isAdmin) {
      for (const p of permissions) {
        if (p?.id) next.add(String(p.id));
      }
    } else {
      for (const id of rolePermsQ.ids) {
        if (id) next.add(String(id));
      }
    }

    setAssigned(next);
    setAssignedRoleId(selectedId);
    setDirty(false);
  }, [
    selectedId,
    serverPermKey,
    rolePermsQ.isLoading,
    rolePermsQ.isFetching,
    rolePermsQ.data,
    dirty,
    assignedRoleId,
    permissions,
    roles,
    assigned.size,
  ]);

  const permCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of roles) {
      if (typeof r.permission_count === "number") m[r.id] = r.permission_count;
    }
    return m;
  }, [roles]);

  const userCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of roles) {
      if (typeof r.user_count === "number") m[r.id] = r.user_count;
    }
    return m;
  }, [roles]);

  const allGroups = useMemo(() => buildGroups(permissions), [permissions]);

  const sectionOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const g of allGroups) {
      if (!seen.has(g.section)) {
        seen.add(g.section);
        opts.push({ value: g.section, label: g.section });
      }
    }
    return opts;
  }, [allGroups]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }, [roles, search]);

  const visibleGroups = useMemo(() => {
    let list = allGroups;
    if (groupFilter !== "all") list = list.filter((g) => g.section === groupFilter);
    const q = permFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.key.includes(q)
      );
    }
    return list;
  }, [allGroups, groupFilter, permFilter]);

  type MatrixRow =
    | { type: "section"; section: string }
    | { type: "group"; group: PermGroup };

  const matrixRows = useMemo(() => {
    const rows: MatrixRow[] = [];
    let lastSection = "";
    for (const g of visibleGroups) {
      if (g.section !== lastSection) {
        lastSection = g.section;
        rows.push({ type: "section", section: g.section });
      }
      rows.push({ type: "group", group: g });
    }
    return rows;
  }, [visibleGroups]);

  const groupCount = allGroups.length;
  const enabledCount = adminLocked ? permissions.length : assigned.size;

  const roleWarehouses = useMemo(
    () => warehousesFromUsers(roleUsers, allWarehouses),
    [roleUsers, allWarehouses]
  );
  const hasAllWarehouses = roleUsers.some((u) => u.access_all_warehouses);

  const matrixReady =
    !!selectedId &&
    (adminLocked || (assignedRoleId === selectedId && !rolePermsQ.isLoading));

  function rowStats(g: PermGroup) {
    let on = 0;
    let total = 0;
    for (const a of CRUD_ACTIONS) {
      const p = g.actions[a];
      if (!p) continue;
      total += 1;
      if (adminLocked || (matrixReady && assigned.has(p.id))) on += 1;
    }
    return { on, total };
  }

  const canEditPerms =
    !!selectedId &&
    !adminLocked &&
    !permLoading &&
    assignedRoleId === selectedId;

  const canSavePerms = canEditPerms && dirty && !permSaving;

  const togglePerm = (id: string) => {
    if (!canEditPerms || !id) return;
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAssignedRoleId(selectedId);
    setDirty(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (role: Role, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(role);
    setForm({ name: role.name || "", description: role.description || "" });
    setModalOpen(true);
  };

  const refreshCatalog = useCallback(async () => {
    await invalidateRoles();
    await Promise.all([rolesQ.refetch(), permsQ.refetch()]);
  }, [rolesQ, permsQ]);

  const handleRoleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      showToast("error", "Validation", "Name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, description: form.description.trim() || null };
      if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        showToast("success", "Updated", "Role updated.");
      } else {
        const { data } = await api.post("/roles", payload);
        const newId = data?.data?.id || data?.id;
        showToast("success", "Created", "Role created.");
        if (newId) setSelectedId(String(newId));
      }
      setModalOpen(false);
      await refreshCatalog();
    } catch (err) {
      showToast(
        "error",
        "Error",
        getErrorMessage(err, "Save failed") || "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    setSaving(true);
    try {
      await api.delete(`/roles/${role.id}`);
      showToast("success", "Deleted", `"${role.name}" removed.`);
      if (selectedId === role.id) setSelectedId(null);
      setModalOpen(false);
      await refreshCatalog();
    } catch (err) {
      showToast(
        "error",
        "Error",
        getErrorMessage(err, "Delete failed") || "Delete failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedId) return;

    if (adminLocked || selectedIsAdmin) {
      setDirty(false);
      showToast("info", "Admin", "Admin always has full access.");
      return;
    }

    if (!dirty || permSaving) return;

    if (assignedRoleId != null && assignedRoleId !== selectedId) {
      showToast(
        "error",
        "Error",
        "Permission state is out of sync. Re-select the role and try again."
      );
      setDirty(false);
      return;
    }

    const roleIdToSave = selectedId;
    setPermSaving(true);

    const ids = Array.from(assigned).map(String).filter(Boolean);
    const payload = { permission_ids: ids, permissions: ids };

    const tryRoutes: SyncRoute[] = [
      knownSyncRoute,
      { method: "post", path: "sync" },
      { method: "post", path: "plain" },
      { method: "put", path: "sync" },
      { method: "put", path: "plain" },
    ];
    const seen = new Set<string>();
    const routes = tryRoutes.filter((r) => {
      const k = `${r.method}:${r.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let lastErr: unknown = null;
    try {
      for (const route of routes) {
        try {
          const url = syncUrl(roleIdToSave, route.path);
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), SAVE_TIMEOUT_MS);
          try {
            if (route.method === "post") {
              await api.post(url, payload, { signal: ctrl.signal });
            } else {
              await api.put(url, payload, { signal: ctrl.signal });
            }
          } finally {
            clearTimeout(t);
          }

          knownSyncRoute = route;
          persistKnownSyncRoute(route);

          if (selectedId === roleIdToSave) {
            setDirty(false);
            skipAssignedSyncRef.current = true;
          }

          showToast("success", "Saved", "Permissions updated.");

          await queryClient.invalidateQueries({
            queryKey: queryKeys.roles.permissions(roleIdToSave),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.roles.all,
          });
          notifyPermissionsChanged();
          return;
        } catch (err) {
          lastErr = err;
          const status = (err as any)?.response?.status;
          if (status && status !== 404 && status !== 405) break;
        }
      }
      showToast(
        "error",
        "Error",
        getErrorMessage(lastErr, "Failed to save permissions") ||
          "Failed to save permissions"
      );
    } finally {
      setPermSaving(false);
    }
  };

  const handleSelectRole = (id: string) => {
    if (id === selectedId) return;
    if (dirty && assignedRoleId === selectedId && !selectedIsAdmin) {
      if (!window.confirm("Discard unsaved permission changes?")) return;
    }
    setDirty(false);
    setSelectedId(id);
    setDetailTab("permissions");
  };

  return (
    <div className="system-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Roles & Access</h1>
              <p className="page-subtitle">
                Define roles and manage module permissions
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreate}
              >
                <IconPlus /> Create Role
              </button>
            </div>
          </div>

          <div className="rac-layout">
            <aside className="rac-sidebar card">
              <div className="rac-sidebar-head">
                <div className="table-search rp-search">
                  <IconSearch />
                  <input
                    type="search"
                    placeholder="Search roles…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search roles"
                  />
                </div>
              </div>

              <div className="rac-role-list">
                {loading ? (
                  <div className="roles-empty" style={{ padding: 24 }}>
                    <span className="roles-spinner" />
                    Loading roles…
                  </div>
                ) : error ? (
                  <div className="roles-empty" style={{ padding: 24 }}>
                    <p>{error}</p>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => rolesQ.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <div className="roles-empty" style={{ padding: 24 }}>
                    <p>
                      {search.trim()
                        ? "No roles match your search."
                        : "No roles yet."}
                    </p>
                    {!search.trim() && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={openCreate}
                      >
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
                      onSelect={handleSelectRole}
                    />
                  ))
                )}
              </div>
            </aside>

            <section className="rac-detail card">
              {!selected ? (
                <div className="roles-empty" style={{ padding: 48 }}>
                  <IconShield />
                  <p className="rp-empty-title">Select a role</p>
                  <p className="rp-empty-hint">
                    Choose a role on the left to manage permissions.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rac-detail-head">
                    <div className="rac-detail-title">
                      <div className="rac-role-icon rac-role-icon-lg">
                        {roleInitials(selected.name)}
                      </div>
                      <div>
                        <div className="rac-detail-name">
                          <h2>{selected.name}</h2>
                          <span
                            className={`role-scope-badge scope-${selectedScope}`}
                          >
                            {scopeLabel(selectedScope)}
                          </span>
                        </div>
                        <p className="rac-detail-desc">
                          {selected.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => openEdit(selected, e)}
                    >
                      <IconEdit /> Edit Role
                    </button>
                  </div>

                  <div className="rac-tabs">
                    <button
                      type="button"
                      className={`rac-tab ${
                        detailTab === "permissions" ? "active" : ""
                      }`}
                      onClick={() => setDetailTab("permissions")}
                    >
                      <IconLock /> Permissions
                    </button>
                    <button
                      type="button"
                      className={`rac-tab ${
                        detailTab === "users" ? "active" : ""
                      }`}
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
                      className={`rac-tab ${
                        detailTab === "warehouses" ? "active" : ""
                      }`}
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

                  {detailTab === "permissions" ? (
                    <>
                      <div className="rac-stats">
                        <div className="rac-stat rac-stat-perm">
                          <IconShield />
                          <div>
                            <strong>
                              {enabledCount}
                              {permissions.length > 0
                                ? ` / ${permissions.length}`
                                : ""}
                            </strong>
                            <span>Permissions enabled</span>
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
                        <span className="rac-dirty">
                          {adminLocked
                            ? "Full access (locked)"
                            : dirty
                              ? "Unsaved changes"
                              : ""}
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!canSavePerms}
                          onClick={savePermissions}
                        >
                          {permSaving ? (
                            "Saving…"
                          ) : (
                            <>
                              <IconCheck /> Save
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rac-table-wrap">
                        {visibleGroups.length === 0 &&
                        !permLoading &&
                        !catalogLoading ? (
                          <div className="roles-empty">
                            <p>No groups match your filters.</p>
                          </div>
                        ) : allGroups.length === 0 &&
                          (permLoading || catalogLoading) ? (
                          <div className="roles-empty">
                            <span className="roles-spinner" />
                            Loading permission catalog…
                          </div>
                        ) : (
                          <>
                            {permLoading && (
                              <div
                                className="rac-perm-loading-bar"
                                aria-live="polite"
                              >
                                <span className="roles-spinner" /> Loading
                                assigned permissions…
                              </div>
                            )}
                            <table
                              className={`rac-matrix ${
                                permLoading ? "rac-matrix-loading" : ""
                              }`}
                            >
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
                                      <tr
                                        key={`sec-${row.section}`}
                                        className="rac-section-row"
                                      >
                                        <td
                                          colSpan={7}
                                          style={{
                                            padding: "10px 12px 6px",
                                            borderBottom:
                                              "1px solid rgba(255,255,255,0.06)",
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
                                  const hasAnyAction = CRUD_ACTIONS.some(
                                    (a) => g.actions[a]
                                  );
                                  return (
                                    <tr
                                      key={g.key}
                                      className={
                                        !hasAnyAction
                                          ? "rac-group-empty"
                                          : undefined
                                      }
                                      title={
                                        adminLocked
                                          ? "Admin has full access — cannot be changed"
                                          : undefined
                                      }
                                    >
                                      <td>
                                        <span className="rac-group-cell">
                                          <span className="fw-600">
                                            {g.label}
                                          </span>
                                          {adminLocked && (
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
                                      <td className="text-muted">
                                        {g.description}
                                      </td>
                                      {CRUD_ACTIONS.map((action) => {
                                        const p = g.actions[action];
                                        if (!p) {
                                          return (
                                            <td
                                              key={action}
                                              className="rac-col-action rac-na"
                                            >
                                              —
                                            </td>
                                          );
                                        }
                                        const checked = adminLocked
                                          ? true
                                          : matrixReady && assigned.has(p.id);
                                        return (
                                          <td
                                            key={action}
                                            className="rac-col-action"
                                          >
                                            <input
                                              type="checkbox"
                                              className={actionClass(action)}
                                              checked={checked}
                                              disabled={
                                                permLoading ||
                                                adminLocked ||
                                                !matrixReady
                                              }
                                              onChange={() => togglePerm(p.id)}
                                              title={
                                                adminLocked
                                                  ? "Admin — full access"
                                                  : p.name
                                              }
                                            />
                                          </td>
                                        );
                                      })}
                                      <td className="rac-col-total">
                                        <span className="rac-total-pill">
                                          {permLoading || !matrixReady
                                            ? "…"
                                            : `${on}/${total}`}
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
                            <div className="role-avatar">
                              {roleInitials(u.name)}
                            </div>
                            <div className="rp-user-info">
                              <span className="fw-600">{u.name}</span>
                              <span className="rp-role-sub">{u.email}</span>
                            </div>
                            <span
                              className={`status-badge ${
                                (u.status || "active").toLowerCase() ===
                                "active"
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
                    <div className="rac-list-body">
                      {usersLoading ? (
                        <div className="roles-empty">
                          <span className="roles-spinner" />
                          Loading warehouses…
                        </div>
                      ) : roleUsers.length === 0 ? (
                        <div className="roles-empty">
                          <p>
                            No users on this role — no warehouses to show.
                          </p>
                        </div>
                      ) : roleWarehouses.length === 0 &&
                        !hasAllWarehouses ? (
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
                                  {w.code && (
                                    <span className="track-code">{w.code}</span>
                                  )}
                                  {(w.location || w.address) && (
                                    <span
                                      style={{ marginLeft: w.code ? 8 : 0 }}
                                    >
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
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Warehouse Operator"
                    maxLength={100}
                  />
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
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

export default Roles;