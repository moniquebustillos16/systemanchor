import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  memo,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import api from "../../api/axios";
import "../css/Sidebar.css";

/* ------------------------------------------------------------------ */
/* Logo                                                               */
/* ------------------------------------------------------------------ */

const IconLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
      fill="rgba(255,254,251,0.12)"
      stroke="#FFFEFB"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M24 12V32" stroke="#FFFEFB" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="24" cy="12" r="2.8" fill="#FFFEFB" />
    <path d="M15 26h18" stroke="#FFFEFB" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M17 33l7 7 7-7"
      stroke="#FFFEFB"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Icons (static – never re-create)                                   */
/* ------------------------------------------------------------------ */

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const icons: Record<string, React.ReactNode> = {
  home: (
    <svg {...svgProps}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  box: (
    <svg {...svgProps}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  repeat: (
    <svg {...svgProps}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  file: (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  cart: (
    <svg {...svgProps}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  package: (
    <svg {...svgProps}>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  truck: (
    <svg {...svgProps}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  rotate: (
    <svg {...svgProps}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  building: (
    <svg {...svgProps}>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  pie: (
    <svg {...svgProps}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  "check-square": (
    <svg {...svgProps}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  users: (
    <svg {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  user: (
    <svg {...svgProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  "file-text": (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  "bar-chart": (
    <svg {...svgProps}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  "user-plus": (
    <svg {...svgProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  shield: (
    <svg {...svgProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  settings: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Nav structure                                                      */
/* ------------------------------------------------------------------ */

type NavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
};

type NavSection = {
  section: string;
  items: NavItem[];
};

const NAV: NavSection[] = [
  {
    section: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "home", path: "/dashboard" },
      { id: "products", label: "Inventory", icon: "box", path: "/products" },
      { id: "stock-movements", label: "Stock Movements", icon: "repeat", path: "/stock-movements" },
    ],
  },
  {
    section: "Orders",
    items: [
      { id: "purchase-orders", label: "Purchase Orders", icon: "file", path: "/purchase-orders" },
      { id: "sales-orders", label: "Sales Orders", icon: "cart", path: "/sales-orders" },
      { id: "goods-receiving", label: "Receiving", icon: "package", path: "/goods-receiving" },
      { id: "shipping", label: "Shipping", icon: "truck", path: "/shipping" },
      { id: "returns", label: "Returns", icon: "rotate", path: "/returns" },
    ],
  },
  {
    section: "Warehouse",
    items: [
      { id: "warehouses", label: "Locations", icon: "building", path: "/warehouses" },
      { id: "capacity", label: "Capacity", icon: "pie", path: "/capacity" },
      { id: "cycle-count", label: "Cycle Count", icon: "check-square", path: "/cycle-count" },
    ],
  },
  {
    section: "Partners",
    items: [
      { id: "suppliers", label: "Suppliers", icon: "users", path: "/suppliers" },
      { id: "customers", label: "Customers", icon: "user", path: "/customers" },
    ],
  },
  {
    section: "Insights",
    items: [
      { id: "reports", label: "Reports", icon: "file-text", path: "/reports" },
      { id: "analytics", label: "Analytics", icon: "bar-chart", path: "/analytics" },
    ],
  },
  {
    section: "System",
    items: [
      { id: "users", label: "Users", icon: "user-plus", path: "/users" },
      { id: "roles", label: "Roles", icon: "shield", path: "/roles" },
      { id: "company-settings", label: "Settings", icon: "settings", path: "/company-settings" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Scroll persistence                                                 */
/* ------------------------------------------------------------------ */

const SCROLL_KEY = "sa-sidebar-nav-scroll";

function readSavedScroll(): number {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY);
    if (v != null) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    /* sessionStorage unavailable */
  }
  return 0;
}

function writeSavedScroll(top: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(top));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Permission gating — SAME module keys/aliases as Roles MODULE_CATALOG */
/* ------------------------------------------------------------------ */

/**
 * Normalize permission tokens for comparison.
 * Keep dots so "inventory.view" stays module="inventory" + action="view".
 * (Replacing "." with "_" broke canView and hid Inventory / other items.)
 */
function normPerm(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Nav item id → module keys (must match Roles.tsx MODULE_CATALOG aliases).
 * Only .view / .read (etc.) on these modules unlock the nav item.
 * (e.g. inventory.view → show Inventory; inventory.create alone → hide).
 */
const NAV_MODULES: Record<string, string[]> = {
  dashboard: ["dashboard", "home", "overview"],
  products: ["inventory", "inventories", "stock", "items", "item", "products", "product", "skus", "sku"],
  "stock-movements": [
    "stock_movements",
    "stock_movement",
    "movements",
    "movement",
    "transfers",
    "transfer",
    "adjustments",
    "adjustment",
  ],
  "purchase-orders": ["purchase_orders", "purchase_order", "po", "purchases", "purchase"],
  "sales-orders": ["sales_orders", "sales_order", "so", "orders", "order", "sales"],
  "goods-receiving": [
    "receiving",
    "receipts",
    "receipt",
    "inbound",
    "goods_receipts",
    "goods_receiving",
  ],
  shipping: ["shipping", "shipments", "shipment", "outbound", "dispatch"],
  returns: ["returns", "return", "rma"],
  warehouses: ["locations", "location", "warehouses", "warehouse", "bins", "bin", "zones", "zone"],
  capacity: ["capacity", "space", "utilization"],
  "cycle-count": [
    "cycle_count",
    "cycle_counts",
    "counts",
    "count",
    "stocktake",
    "physical_count",
  ],
  suppliers: ["suppliers", "supplier", "vendors", "vendor"],
  customers: ["customers", "customer", "clients", "client"],
  reports: ["reports", "report"],
  analytics: ["analytics", "insights", "metrics"],
  users: ["users", "user", "accounts", "account"],
  roles: ["roles", "role", "permissions", "permission", "access"],
  "company-settings": [
    "settings",
    "setting",
    "config",
    "configuration",
    "system",
    "company",
  ],
};

/** Flatten any API permission payload into normalized name strings. */
function coercePermList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const p of raw) {
    if (typeof p === "string") {
      const n = normPerm(p);
      if (n) out.push(n);
    } else if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const name = o.name ?? o.permission ?? o.key ?? o.slug;
      if (typeof name === "string") {
        const n = normPerm(name);
        if (n) out.push(n);
      }
    }
  }
  return out;
}

function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;

  const top = coercePermList(j.permissions);
  if (top.length) return top;

  const data = j.data as Record<string, unknown> | undefined;
  if (data) {
    const fromData = coercePermList(data.permissions);
    if (fromData.length) return fromData;
  }

  const user = (j.user || data?.user) as Record<string, unknown> | undefined;
  if (user) {
    const fromUser = coercePermList(user.permissions);
    if (fromUser.length) return fromUser;

    const named = coercePermList(user.permission_names);
    if (named.length) return named;

    const role = user.role as Record<string, unknown> | undefined;
    if (role) {
      const fromRole = coercePermList(role.permissions);
      if (fromRole.length) return fromRole;
    }
  }

  const dataRole = data?.role as Record<string, unknown> | undefined;
  if (dataRole) {
    const fromRole = coercePermList(dataRole.permissions);
    if (fromRole.length) return fromRole;
  }

  return [];
}

function isAdminRoleName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const key = name.trim().toLowerCase();
  // Only real admin roles — do NOT match every name containing "admin" in a phrase
  // unless it is clearly an admin role (Admin, System Admin, Administrator).
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

function extractAdminFlag(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const j = json as Record<string, unknown>;
  const data = j.data as Record<string, unknown> | undefined;
  const user = (j.user || data?.user) as Record<string, unknown> | undefined;

  // Explicit flags some APIs send
  if (user?.is_admin === true || user?.isAdmin === true || data?.is_admin === true) {
    return true;
  }

  const roleName =
    (user?.role as Record<string, unknown> | undefined)?.name ||
    user?.role_name ||
    (data?.role as Record<string, unknown> | undefined)?.name ||
    (j.role as Record<string, unknown> | undefined)?.name ||
    j.role_name;

  if (isAdminRoleName(roleName)) return true;

  // Full-access markers already in the permission list
  const perms = extractPermissions(json);
  if (perms.some((p) => p === "*" || p === "admin" || p.endsWith(".*"))) {
    return true;
  }

  return false;
}

/** Actions that mean “can open this page in the sidebar”. */
const VIEW_ACTIONS = new Set(["view", "read", "list", "index", "show", "access"]);

/**
 * Show nav item ONLY when the user has a VIEW/READ permission for that module.
 * Unchecking .view in Roles must hide the item — create/update/delete alone are not enough.
 *
 * SHOW:  inventory.view, products.read, stock.list
 * HIDE:  inventory.create, inventory.update, inventory.delete (without .view)
 */
function canView(perms: string[], itemId: string): boolean {
  if (!perms.length) return false;

  for (const raw of perms) {
    const p = normPerm(raw);
    if (p === "*" || p === "admin" || p === "super_admin" || p === "superadmin") {
      return true;
    }
  }

  const modules = NAV_MODULES[itemId];
  if (!modules || modules.length === 0) return true;

  const modSet = new Set(modules.map(normPerm));

  for (const raw of perms) {
    const p = normPerm(raw);

    // Bare name with no action (rare) — treat as view grant
    if (!p.includes(".")) {
      if (modSet.has(p)) return true;
      continue;
    }

    const [moduleKey, action] = p.split(".");
    if (!moduleKey || !modSet.has(moduleKey)) continue;

    // Only view/read/list (or module.*) unlock the sidebar entry
    if (action && VIEW_ACTIONS.has(action)) return true;
    if (action === "*") return true;
  }

  return false;
}

/** Module-level cache + inflight so Strict Mode / remounts share one load */
let permsCache: { list: string[]; at: number } | null = null;
let permsInflight: Promise<string[]> | null = null;
const PERMS_TTL_MS = 5 * 60_000;

function isPermsFresh(): boolean {
  return !!permsCache && Date.now() - permsCache.at < PERMS_TTL_MS;
}

function clearPermsCache() {
  permsCache = null;
  permsInflight = null;
  const store = sharedMeStore();
  store.entry = null;
  store.inflight = null;
}

/**
 * App-wide /me cache — shared with Inventory / Topbar (globalThis.__saMeCache).
 * Only ONE network /me per TTL window across Sidebar + pages.
 */
type SharedMe = {
  entry: { data: unknown; at: number } | null;
  inflight: Promise<unknown> | null;
};
function sharedMeStore(): SharedMe {
  const g = globalThis as unknown as { __saMeCache?: SharedMe };
  if (!g.__saMeCache) g.__saMeCache = { entry: null, inflight: null };
  return g.__saMeCache;
}

async function fetchMeShared(force = false): Promise<unknown> {
  const store = sharedMeStore();
  if (!force && store.entry && Date.now() - store.entry.at < PERMS_TTL_MS) {
    return store.entry.data;
  }
  if (!force && store.inflight) return store.inflight;

  // force=true: drop in-flight so we always hit the network after a role save
  if (force) {
    store.entry = null;
    store.inflight = null;
  }

  store.inflight = api
    .get("/me", {
      timeout: 20_000,
      // cache-bust so browsers / proxies do not serve a stale permission set
      params: force ? { _ts: Date.now() } : undefined,
    })
    .then((res) => {
      const body = res?.data ?? res;
      store.entry = { data: body, at: Date.now() };
      return body;
    })
    .finally(() => {
      store.inflight = null;
    });

  return store.inflight;
}

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type SidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

function Sidebar({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  defaultCollapsed = false,
}: SidebarProps = {}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState<string[]>(
    () => permsCache?.list ?? []
  );
  const [permsLoaded, setPermsLoaded] = useState(() => !!permsCache);

  const navRef = useRef<HTMLElement>(null);
  const scrollTopRef = useRef(readSavedScroll());

  /* ---- scroll helpers ---- */

  const saveScroll = useCallback((top: number) => {
    scrollTopRef.current = top;
    writeSavedScroll(top);
  }, []);

  const handleNavScroll = useCallback(() => {
    if (navRef.current) saveScroll(navRef.current.scrollTop);
  }, [saveScroll]);

  const restoreScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const target = scrollTopRef.current;
    if (el.scrollTop !== target) el.scrollTop = target;
  }, []);

  useLayoutEffect(() => {
    restoreScroll();
  }, [location.pathname, restoreScroll]);

  useEffect(() => {
    restoreScroll();
    const id1 = requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
    const t = setTimeout(restoreScroll, 50);
    return () => {
      cancelAnimationFrame(id1);
      clearTimeout(t);
    };
  }, [location.pathname, restoreScroll]);

  useLayoutEffect(() => {
    scrollTopRef.current = readSavedScroll();
    restoreScroll();
  }, [restoreScroll]);

  /* ---- collapse ---- */

  const toggleSidebar = useCallback(() => {
    const next = !collapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    else setInternalCollapsed(next);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  /* ---- permissions (localStorage → shared /me; aligned with Roles matrix names) ---- */

  useEffect(() => {
    // Instant hydrate from cache (covers Strict Mode remount + page revisits)
    if (isPermsFresh()) {
      setUserPermissions(permsCache!.list);
      setPermsLoaded(true);
      return;
    }

    let cancelled = false;

    const apply = (list: string[]) => {
      if (cancelled) return;
      const normalized = list.map(normPerm);
      permsCache = { list: normalized, at: Date.now() };
      setUserPermissions(normalized);
      setPermsLoaded(true);
    };

    const loadPerms = async (): Promise<string[]> => {
      // 1) Prefer /me (source of truth after role permission changes)
      try {
        const json = await fetchMeShared();
        if (extractAdminFlag(json)) return ["*"];
        const list = extractPermissions(json);
        if (list.length > 0) return list.map(normPerm);
        // Empty from API is valid — user truly has no grants
        if (json) return [];
      } catch {
        /* network / CORS – try local snapshots */
      }

      // 2) localStorage / sessionStorage fallback when offline /me fails
      for (const key of [
        "permissions",
        "user_permissions",
        "auth_permissions",
        "user",
        "auth_user",
        "authUser",
        "currentUser",
        "sa-user",
      ]) {
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string")) {
            return (parsed as string[]).map(normPerm);
          }
          if (extractAdminFlag(parsed)) return ["*"];
          const list = extractPermissions(parsed);
          if (list.length > 0) return list.map(normPerm);
        } catch {
          /* try next */
        }
      }

      // Network failed and no local cache: keep nav usable
      return ["*"];
    };

    // Deduplicate concurrent Sidebar mounts (Strict Mode)
    if (!permsInflight) {
      permsInflight = loadPerms().finally(() => {
        permsInflight = null;
      });
    }

    permsInflight.then(apply).catch(() => {
      if (!cancelled) apply(["*"]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // After Roles save / logout: window.dispatchEvent(new Event("sa-permissions-refresh"))
  useEffect(() => {
    const onRefresh = () => {
      // Drop every layer of cache so the next /me is a real network call
      clearPermsCache();
      setPermsLoaded(false);

      void (async () => {
        try {
          const json = await fetchMeShared(true); // force network
          let list: string[];
          if (extractAdminFlag(json)) {
            list = ["*"];
          } else {
            list = extractPermissions(json).map(normPerm);
          }
          permsCache = { list, at: Date.now() };
          // New array reference so React always re-filters nav items
          setUserPermissions([...list]);
        } catch {
          /* keep previous list if network fails */
        } finally {
          setPermsLoaded(true);
        }
      })();
    };
    const onLogout = () => {
      clearPermsCache();
      setUserPermissions([]);
      setPermsLoaded(false);
    };
    window.addEventListener("sa-permissions-refresh", onRefresh);
    window.addEventListener("sa-logout", onLogout);
    return () => {
      window.removeEventListener("sa-permissions-refresh", onRefresh);
      window.removeEventListener("sa-logout", onLogout);
    };
  }, []);

  /* ---- active route ---- */

  const isActive = useCallback(
    (path: string) => {
      if (path === "/dashboard") {
        return location.pathname === "/dashboard" || location.pathname === "/";
      }
      if (path === "/products") {
        return location.pathname === "/products" || location.pathname === "/inventory";
      }
      return location.pathname === path || location.pathname.startsWith(path + "/");
    },
    [location.pathname]
  );

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (navRef.current) saveScroll(navRef.current.scrollTop);
      e.currentTarget.blur();
      e.stopPropagation();
    },
    [saveScroll]
  );

  /* ---- render ---- */

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      id="sidebar"
      aria-expanded={!collapsed}
    >
      <div
        className="sidebar-header sidebar-toggle-hit"
        onClick={toggleSidebar}
        data-tooltip="Collapse / Expand"
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSidebar();
          }
        }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
      >
        <div className="sidebar-logo" aria-hidden="true">
          <IconLogo />
        </div>
        <div className="sidebar-brand-wrap">
          <span className="sidebar-brand">System Anchor</span>
          <span className="sidebar-tagline">Warehouse Management</span>
        </div>
      </div>

      <nav
        className="sidebar-nav"
        id="sidebar-nav"
        aria-label="Main navigation"
        ref={navRef}
        onScroll={handleNavScroll}
      >
        {NAV.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !permsLoaded || canView(userPermissions, item.id)
          );
          if (visibleItems.length === 0) return null;

          const hasActive = visibleItems.some((item) => isActive(item.path));

          return (
            <div
              key={section.section}
              className={`nav-section ${hasActive ? "has-active" : ""}`}
            >
              <div className="nav-section-title" aria-hidden={collapsed}>
                {section.section}
              </div>
              <div className="nav-group" role="list">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={() => `nav-item ${isActive(item.path) ? "active" : ""}`}
                    title={collapsed ? item.label : undefined}
                    end={item.path === "/dashboard"}
                    preventScrollReset
                    onClick={handleNavClick}
                    role="listitem"
                    aria-current={isActive(item.path) ? "page" : undefined}
                  >
                    {icons[item.icon]}
                    <span>{item.label}</span>
                    {collapsed && (
                      <span className="tooltip" role="tooltip">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default memo(Sidebar);