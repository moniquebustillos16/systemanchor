import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePurchaseOrders } from "../../hooks/useOrders";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidatePurchaseOrders } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import { extractAdminFlag } from "../../lib/permissions";
import "../css/Orders.css";




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

const IconX = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconBox = () => (
  <svg {...svg} width="18" height="18">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconCheck = () => (
  <svg {...svg} width="15" height="15">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconTruck = () => (
  <svg {...svg} width="15" height="15">
    <rect x="1" y="3" width="15" height="13" rx="2" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconMore = () => (
  <svg {...svg} width="15" height="15">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const IconBan = () => (
  <svg {...svg} width="15" height="15">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

type Supplier = {
  id: string;
  name: string;
  product_offers?: string | null;
};
type Warehouse = { id: string; code: string; name?: string };

/** Assigned warehouses for the logged-in user (same pattern as Inventory.tsx) */
type UserWarehouseScope = {
  accessAll: boolean;
  warehouseIds: string[];
  warehouses: Warehouse[];
};
type ProductOpt = {
  id: string;
  sku: string;
  name: string;
  price?: number | string;
  qty?: number | string;
};

/** Split free-text product offers ("Steel, bolts, electrical…") into options from supplier */
function parseProductOffers(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(/[,;|/·\n]+/)) {
    const tag = part.trim();
    if (tag.length < 2) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function truncateText(s: string, max = 48): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * PO line is driven by supplier product_offers (not inventory).
 * `offer` = selected product offer name from the supplier.
 * `product_id` is optional / kept for duplicate & display of older POs.
 */
type PoLine = {
  key: string;
  offer: string;
  product_id: string;
  qty: string;
  unit_price: string;
};

type PoLineServer = {
  id?: string;
  product_id?: string;
  product_name?: string | null;
  name?: string | null;
  description?: string | null;
  qty?: number | string;
  unit_price?: number | string;
  line_total?: number | string;
  product?: { id: string; sku: string; name: string } | null;
};

/** Display name for a PO line (supplier offer or inventory product) */
function lineDisplayName(ln: PoLineServer): string {
  return (
    ln.product?.name ||
    ln.product_name ||
    ln.name ||
    ln.description ||
    (ln.product_id ? `Product #${ln.product_id}` : "Product offer")
  );
}

/** Robust qty parse (handles integer / string; ignores locale noise) */
function parseQty(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const s = String(v).trim().replace(/\s/g, "");
  // "11,3" style → try as integer first, then decimal with comma
  const asInt = Number(s.replace(/,/g, ""));
  if (Number.isFinite(asInt) && !s.includes(".")) return Math.max(0, Math.round(asInt));
  const asDec = Number(s.replace(",", "."));
  return Number.isFinite(asDec) ? Math.max(0, Math.round(asDec)) : 0;
}

/**
 * Product label from attached / cached lines only.
 * PurchaseOrderController no longer stores product_name on the PO row.
 */
function poProductLabel(po: {
  lines?: PoLineServer[] | null;
  order_items?: PoLineServer[] | null;
}): string {
  const fromLines = po.lines?.[0] || po.order_items?.[0];
  if (fromLines) {
    const n = lineDisplayName(fromLines).trim();
    if (n && n !== "Product offer") return n;
  }
  return "";
}

/**
 * Normalize lines from API response or local cache.
 * PO no longer stores product_name / qty / unit_price on the row.
 */
function extractLines(
  src: Record<string, unknown> | null | undefined
): PoLineServer[] {
  if (!src || typeof src !== "object") return [];
  const o = src;
  const candidates = [o.lines, o.order_items, o.purchase_order_items, o.purchaseOrderItems];
  for (const c of candidates) {
    if (!Array.isArray(c) || c.length === 0) continue;
    const first = c[0] as Record<string, unknown>;
    if (
      first &&
      typeof first === "object" &&
      ("product_name" in first || "name" in first || "qty" in first || "unit_price" in first)
    ) {
      return (c as PoLineServer[]).map((ln) => ({
        ...ln,
        product_name: ln.product_name || ln.name || ln.description || undefined,
        qty: ln.qty != null ? parseQty(ln.qty) : ln.qty,
        unit_price: ln.unit_price != null ? Number(ln.unit_price) : ln.unit_price,
      }));
    }
  }
  return [];
}

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  order_date: string;
  expected_date?: string | null;
  reference?: string | null;
  notes?: string | null;
  items: number;
  total: number | string;
  status: string;
  supplier?: Supplier | null;
  warehouse?: Warehouse | null;
  /** Client-side / cached lines (product details live in product_transactions) */
  lines?: PoLineServer[];
  order_items?: PoLineServer[];
};

type Stats = {
  all: number;
  pending: number;
  total_value: number;
  done: number;
};

type PoForm = {
  supplier_id: string;
  warehouse_id: string;
  order_date: string;
  expected_date: string;
  reference: string;
  notes: string;
  status: string;
  lines: PoLine[];
};

let lineKeySeq = 0;
const newLineKey = () => `line-${Date.now()}-${++lineKeySeq}`;

const emptyLine = (offer = ""): PoLine => ({
  key: newLineKey(),
  offer,
  product_id: "",
  qty: "1",
  unit_price: "0",
});

const emptyForm = (): PoForm => ({
  supplier_id: "",
  warehouse_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  expected_date: "",
  reference: "",
  notes: "",
  status: "pending",
  lines: [emptyLine()],
});

function lineTotal(line: PoLine): number {
  return (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
}

function formTotals(lines: PoLine[]): { items: number; total: number } {
  const items = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  return { items, total };
}

/** Cache line offers so the detail drawer can show them when API omits lines */
function cachePoLines(poNumber: string, lines: PoLineServer[]) {
  try {
    if (!poNumber || lines.length === 0) return;
    localStorage.setItem(`sa-po-lines:${poNumber}`, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}

function readCachedPoLines(poNumber: string): PoLineServer[] {
  try {
    const raw = localStorage.getItem(`sa-po-lines:${poNumber}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PoLineServer[]) : [];
  } catch {
    return [];
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "shipped",
  "received",
  "completed",
  "cancelled",
] as const;

const WORKFLOW_STEPS = ["pending", "processing", "shipped", "received", "completed"] as const;

function workflowIndex(status: string): number {
  return WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);
}

function formatPeso(amount: number, fractionDigits = 0): string {
  return `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Pull array from Laravel list payloads (data / nested data / bare array / resources). */
function extractList<T = unknown>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as T[];
  const nested = o.data as Record<string, unknown> | undefined;
  if (nested && Array.isArray(nested.data)) return nested.data as T[];
  if (Array.isArray(o.items)) return o.items as T[];
  if (Array.isArray(o.warehouses)) return o.warehouses as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  // Laravel ResourceCollection: { data: { data: [...] } } already handled;
  // some controllers return { warehouses: { data: [...] } }
  if (nested && Array.isArray((nested as { warehouses?: unknown }).warehouses)) {
    return (nested as { warehouses: T[] }).warehouses;
  }
  return [];
}

function formatDate(d: string) {
  if (!d) return "—";
  return d.slice(0, 10);
}

function formatDateLong(d: string) {
  if (!d) return "—";
  try {
    return new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return formatDate(d);
  }
}

/** Human label for the next workflow step */
function nextStepLabel(status: string): string | null {
  const map: Record<string, string> = {
    pending: "Process order",
    processing: "Mark as shipped",
    shipped: "Receive goods",
    received: "Complete & close",
  };
  return map[status] ?? null;
}


/* ── List/stats cache (navigate away & back = instant paint) ─ */
const PO_SOFT_TTL_MS = 60_000;
const PO_HARD_TTL_MS = 10 * 60_000;
const SS_PO_LIST = "po:lastList";
const SS_PO_STATS = "po:lastStats";
const SS_PO_META = "po:lastMeta";

type PoListSnap = {
  at: number;
  key: string;
  rows: PurchaseOrder[];
  total: number;
  lastPage: number;
};
type PoStatsSnap = { at: number; data: Stats };
type PoMetaSnap = {
  at: number;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  products: ProductOpt[];
};

type PoStore = {
  list: PoListSnap | null;
  stats: PoStatsSnap | null;
  meta: PoMetaSnap | null;
  listInflight: Map<string, Promise<void>>;
  metaInflight: Promise<void> | null;
};

function poStore(): PoStore {
  const g = globalThis as unknown as { __saPoCache?: PoStore };
  if (!g.__saPoCache) {
    g.__saPoCache = {
      list: null,
      stats: null,
      meta: null,
      listInflight: new Map(),
      metaInflight: null,
    };
  }
  return g.__saPoCache;
}

function isFresh(at: number, ttl: number) {
  return Date.now() - at < ttl;
}

function readSS<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeSS(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function listCacheKey(parts: {
  page: number;
  search: string;
  status: string;
  wh: string;
  supplier: string;
}) {
  return `p=${parts.page}|s=${parts.search}|st=${parts.status}|w=${parts.wh}|su=${parts.supplier}`;
}

function bootstrapPoList(key: string): PoListSnap | null {
  const mem = poStore().list;
  if (mem && mem.key === key && isFresh(mem.at, PO_HARD_TTL_MS)) return mem;
  const ss = readSS<PoListSnap>(SS_PO_LIST);
  if (ss && ss.key === key && isFresh(ss.at, PO_HARD_TTL_MS)) return ss;
  // any recent list for instant paint (filters may differ)
  if (mem && isFresh(mem.at, PO_HARD_TTL_MS)) return mem;
  if (ss && isFresh(ss.at, PO_HARD_TTL_MS)) return ss;
  return null;
}

function bootstrapPoStats(): Stats | null {
  const mem = poStore().stats;
  if (mem && isFresh(mem.at, PO_HARD_TTL_MS)) return mem.data;
  const ss = readSS<PoStatsSnap>(SS_PO_STATS);
  if (ss && isFresh(ss.at, PO_HARD_TTL_MS)) return ss.data;
  return null;
}

function bootstrapPoMeta(): PoMetaSnap | null {
  const mem = poStore().meta;
  if (mem && isFresh(mem.at, PO_HARD_TTL_MS)) return mem;
  const ss = readSS<PoMetaSnap>(SS_PO_META);
  if (ss && isFresh(ss.at, PO_HARD_TTL_MS)) return ss;
  return null;
}

function PurchaseOrders() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wh, setWh] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [productQuery, setProductQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Warehouse assignment scope (Inventory pattern) — declared before list query
  const [whScope, setWhScope] = useState<UserWarehouseScope | null>(null);
  const [whScopeLoading, setWhScopeLoading] = useState(true);

  // Same as Inventory effectiveWarehouseId
  const effectiveWarehouseId =
    wh !== "all" && wh
      ? wh
      : whScope && !whScope.accessAll && whScope.warehouseIds.length === 1
        ? whScope.warehouseIds[0]
        : null;

  const {
    rows: poRows,
    meta: poMeta,
    stats: poStats,
    isLoading: poLoading,
    isFetching: poFetching,
    refetchAll: refetchPOs,
  } = usePurchaseOrders({
    page,
    perPage: pageSize,
    search: debouncedSearch,
    status,
    warehouseId: effectiveWarehouseId,
    supplierId: filterSupplier === "all" || !filterSupplier ? null : filterSupplier,
    // Wait for warehouse scope so non-admin never briefly loads ALL warehouses' POs
    enabled: !whScopeLoading,
  });


  const bootKey = listCacheKey({
    page: 1,
    search: "",
    status: "all",
    wh: "all",
    supplier: "all",
  });
  const bootList = bootstrapPoList(bootKey);
  const bootStats = bootstrapPoStats();
  const bootMeta = bootstrapPoMeta();

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => bootList?.rows ?? []);
  const [stats, setStats] = useState<Stats | null>(() => bootStats);
  const [total, setTotal] = useState(() => bootList?.total ?? 0);
  const [lastPage, setLastPage] = useState(() => bootList?.lastPage ?? 1);
  const [loading, setLoading] = useState(() => !(bootList?.rows?.length));
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    () => bootMeta?.warehouses ?? []
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(
    () => bootMeta?.suppliers ?? []
  );
  const [products, setProducts] = useState<ProductOpt[]>(
    () => bootMeta?.products ?? []
  );

  // Shared React Query cache (same as Dashboard / Receiving / Location)
  const {
    rows: whRows,
    isLoading: whLoading,
    isFetching: whFetching,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true, perPage: 200 });

  /** Prefer useWarehouses; fall back to local meta bootstrap only if query empty */
  const allWarehouseOptions = useMemo(() => {
    const fromQuery = (whRows ?? [])
      .map((w) => {
        const r = w as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          code: String(r.code ?? r.name ?? r.id ?? ""),
          name: r.name != null ? String(r.name) : undefined,
        } as Warehouse;
      })
      .filter((w) => !!w.id)
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    if (fromQuery.length > 0) return fromQuery;
    return warehouses;
  }, [whRows, warehouses]);

  /**
   * Warehouse dropdown options (fast path).
   * - No scope yet → []
   * - accessAll → full list (useWarehouses / meta); fallback to scope list
   * - Assigned → show scope warehouses IMMEDIATELY (don't wait for /warehouses)
   */
  const warehouseOptions = useMemo(() => {
    if (!whScope) return [];

    if (whScope.accessAll) {
      return allWarehouseOptions.length > 0
        ? allWarehouseOptions
        : (whScope.warehouses ?? []);
    }

    if (whScope.warehouseIds.length === 0) return [];

    const allowedIds = new Set(whScope.warehouseIds.map(String));
    // Prefer richer names from full list when available
    const fromAll = allWarehouseOptions.filter((w) => allowedIds.has(String(w.id)));
    if (fromAll.length > 0) return fromAll;

    // Instant: data already on scope from /users/:id/warehouses
    return (whScope.warehouses ?? []).filter((w) => !!w.id);
  }, [whScope, allWarehouseOptions]);

  const whBusy = whLoading || whFetching;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<PoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    order: PurchaseOrder;
    status: string;
    label: string;
  } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();

   // Module permissions (same pattern as Inventory: inventory.view → purchase_orders.view)
  const canView = can("purchase_orders.view",
    "purchase-orders.view",
    "purchaseorders.view",
    "orders.view",
    "po.view",
    // legacy aliases if role still uses shipping names for this page
    "shipping.view",
    "shipments.view",
    "shipment.view"
  );
  const canCreate = can("purchase_orders.create",
    "purchase-orders.create",
    "purchaseorders.create",
    "orders.create",
    "po.create",
    "shipping.create",
    "shipments.create",
    "shipment.create"
  );
  const canUpdate = can("purchase_orders.update",
    "purchase-orders.update",
    "purchaseorders.update",
    "orders.update",
    "po.update",
    "shipping.update",
    "shipments.update",
    "shipment.update"
  );

  /** Load assigned warehouses — fast: localStorage first, then parallel API */
  const fetchUserWarehouseScope = useCallback(async () => {
    setWhScopeLoading(true);

    let userId: string | null = null;
    let accessAll = false;
    let warehousesList: Warehouse[] = [];
    let roleName = "";

    // —— Instant bootstrap from localStorage (no network) ——
    try {
      for (const key of ["user", "auth_user", "authUser", "currentUser", "sa-user"]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const u = parsed?.data ?? parsed?.user ?? parsed;
        if (!u) continue;
        userId = u?.id ? String(u.id) : userId;
        accessAll = Boolean(u?.access_all_warehouses) || accessAll;
        roleName = String(u?.role?.name ?? u?.role_name ?? roleName);
        if (extractAdminFlag(parsed) || extractAdminFlag(u)) accessAll = true;

        const fromMe = u?.warehouses ?? u?.warehouse_ids ?? null;
        if (Array.isArray(fromMe) && fromMe.length > 0) {
          warehousesList = fromMe.map((w: any) =>
            typeof w === "string"
              ? { id: String(w), code: "", name: undefined }
              : { id: String(w.id), code: w.code ?? "", name: w.name }
          );
        } else if (u?.warehouse_id) {
          warehousesList = [
            {
              id: String(u.warehouse_id),
              code: u.warehouse?.code ?? "",
              name: u.warehouse?.name,
            },
          ];
        }
        if (userId) break;
      }
    } catch {
      /* ignore */
    }

    const rn = roleName.toLowerCase().replace(/[_-]+/g, " ").trim();
    if (
      [
        "admin",
        "administrator",
        "super admin",
        "superadmin",
        "system admin",
        "system administrator",
        "root",
      ].includes(rn)
    ) {
      accessAll = true;
    }

    // Paint early if we already have something
    if (accessAll || warehousesList.length > 0) {
      setWhScope({
        accessAll,
        warehouseIds: Array.from(
          new Set(warehousesList.map((w) => w.id).filter(Boolean))
        ),
        warehouses: warehousesList,
      });
      // Keep loading true until network confirms, but dropdown can show already
    }

    try {
      // —— Parallel network: /me + /users/:id/warehouses ——
      const mePromise = api.get("/me").then((r) => r.data).catch(() => null);
      const whPromise = userId
        ? api
            .get(`/users/${userId}/warehouses`)
            .then((r) => r.data)
            .catch(() => null)
        : Promise.resolve(null);

      let [me, whJson] = await Promise.all([mePromise, whPromise]);

      if (me) {
        const u = (me as any)?.data ?? (me as any)?.user ?? me;
        userId = u?.id ? String(u.id) : userId;
        if (Boolean(u?.access_all_warehouses)) accessAll = true;
        if (extractAdminFlag(me) || extractAdminFlag(u)) accessAll = true;
        const r2 = String(u?.role?.name ?? u?.role_name ?? "")
          .toLowerCase()
          .replace(/[_-]+/g, " ")
          .trim();
        if (
          [
            "admin",
            "administrator",
            "super admin",
            "superadmin",
            "system admin",
            "system administrator",
            "root",
          ].includes(r2)
        ) {
          accessAll = true;
        }

        const fromMe = u?.warehouses ?? u?.warehouse_ids ?? null;
        if (Array.isArray(fromMe) && fromMe.length > 0 && warehousesList.length === 0) {
          warehousesList = fromMe.map((w: any) =>
            typeof w === "string"
              ? { id: String(w), code: "", name: undefined }
              : { id: String(w.id), code: w.code ?? "", name: w.name }
          );
        }
        if (!whJson && userId) {
          // /me arrived first with userId we didn't have — fetch warehouses now
          try {
            const { data } = await api.get(`/users/${userId}/warehouses`);
            whJson = data;
          } catch {
            /* ignore */
          }
        }
      }

      if (whJson) {
        const payload = (whJson as any)?.data ?? whJson;
        if (Boolean(payload?.access_all_warehouses)) accessAll = true;

        let list: any[] = [];
        const raw = payload?.warehouses ?? payload?.data ?? payload;
        if (Array.isArray(raw)) list = raw;
        else if (Array.isArray(raw?.data)) list = raw.data;
        else if (raw && typeof raw === "object") {
          list = Object.values(raw).filter(
            (v: any) => v && typeof v === "object" && v.id
          );
        }

        if (list.length > 0) {
          warehousesList = list.map((w: any) => ({
            id: String(w.id),
            code: w.code ?? "",
            name: w.name ?? "",
          }));
        }
      }

      // Primary warehouse fallback
      if (warehousesList.length === 0 && !accessAll && me) {
        const u = (me as any)?.data ?? (me as any)?.user ?? me;
        if (u?.warehouse_id) {
          warehousesList = [
            {
              id: String(u.warehouse_id),
              code: u.warehouse?.code ?? "",
              name: u.warehouse?.name,
            },
          ];
        }
      }

      setWhScope({
        accessAll,
        warehouseIds: Array.from(
          new Set(warehousesList.map((w) => w.id).filter(Boolean))
        ),
        warehouses: warehousesList,
      });
    } catch (e) {
      console.error("[PurchaseOrders] warehouse scope failed", e);
      if (!warehousesList.length && !accessAll) {
        setWhScope({ accessAll: false, warehouseIds: [], warehouses: [] });
      }
    } finally {
      setWhScopeLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUserWarehouseScope();
  }, [fetchUserWarehouseScope]);


  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  /** Suppliers + warehouses + product catalog for the create form / filters */
  const fetchMeta = useCallback(async (force = false): Promise<PoMetaSnap | null> => {
    const store = poStore();
    if (
      !force &&
      store.meta &&
      isFresh(store.meta.at, PO_SOFT_TTL_MS) &&
      store.meta.warehouses.length > 0
    ) {
      setWarehouses(store.meta.warehouses);
      setSuppliers(store.meta.suppliers);
      setProducts(store.meta.products);
      return store.meta;
    }
    if (store.metaInflight && !force) {
      await store.metaInflight;
      const m = store.meta;
      if (m) {
        setWarehouses(m.warehouses);
        setSuppliers(m.suppliers);
        setProducts(m.products);
      }
      return m;
    }

    store.metaInflight = (async () => {
      try {
        const loadWarehouses = async (): Promise<Warehouse[]> => {
          // GET /api/warehouses (WarehouseController)
          try {
            const { data: json } = await api.get("/warehouses", {
              params: { per_page: 200, all: 1 },
            });
            const list = extractList<Warehouse>(json);
            return list
              .map((w) => {
                const r = w as Warehouse & Record<string, unknown>;
                return {
                  id: String(r.id ?? ""),
                  code: String(r.code ?? r.name ?? r.id ?? ""),
                  name: r.name != null ? String(r.name) : undefined,
                };
              })
              .filter((w) => !!w.id)
              .sort((a, b) => a.code.localeCompare(b.code));
          } catch (e) {
            console.warn("[PurchaseOrders] /warehouses failed:", e);
            return [];
          }
        };

        const [supSettled, whList] = await Promise.all([
          api
            .get("/suppliers", { params: { per_page: 100 } })
            .then((r) => r.data)
            .catch(() => null),
          loadWarehouses(),
        ]);

        let nextSuppliers: Supplier[] = store.meta?.suppliers ?? [];
        if (supSettled != null) {
          const list: Supplier[] = extractList<Supplier>(supSettled);
          nextSuppliers = list
            .map((s) => ({
              id: String(s.id),
              name: s.name,
              product_offers: (s as Supplier).product_offers ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        let nextProducts: ProductOpt[] = store.meta?.products ?? [];
        try {
          const { data: prodJson } = await api.get("/inventories", {
            params: { per_page: 100 },
          });
          const list: ProductOpt[] = extractList<ProductOpt>(prodJson);
          nextProducts = list.map((p) => ({
            id: String(p.id),
            sku: p.sku,
            name: p.name,
            price: p.price,
            qty: p.qty,
          }));
        } catch {
          /* optional */
        }

        setWarehouses(whList);
        setSuppliers(nextSuppliers);
        setProducts(nextProducts);

        const snap: PoMetaSnap = {
          at: Date.now(),
          warehouses: whList,
          suppliers: nextSuppliers,
          products: nextProducts,
        };
        // Always update in-memory store so openAdd can read immediately
        store.meta = snap;
        // Persist only when we have something useful
        if (whList.length > 0 || nextSuppliers.length > 0) {
          writeSS(SS_PO_META, snap);
        }
      } catch (e) {
        console.error("[PurchaseOrders] meta fetch failed:", e);
      } finally {
        store.metaInflight = null;
      }
    })();

    await store.metaInflight;
    return store.meta;
  }, []);

  /* Phase 7: TanStack Query owns list + stats */
  useEffect(() => {
    if (!poRows) return;
    const rows = (poRows as PurchaseOrder[]).map((row) => {
      const r = row as PurchaseOrder & Record<string, unknown>;
      const lines = extractLines(r);
      const cachedLines =
        lines.length === 0 ? readCachedPoLines(String(r.po_number ?? "")) : [];
      const resolved = lines.length ? lines : cachedLines;
      return {
        ...row,
        lines: resolved.length ? resolved : row.lines,
        order_items: resolved.length ? resolved : row.order_items,
      };
    });
    setOrders(rows);
    setTotal(poMeta.total);
    setLastPage(poMeta.last_page);
    setLoading(false);
    setError(null);
  }, [poRows, poMeta]);

  useEffect(() => {
    if (!poStats) return;
    setStats(poStats as Stats);
  }, [poStats]);

  useEffect(() => {
    if (poRows.length === 0 && poLoading) setLoading(true);
    else if (!poLoading) setLoading(false);
  }, [poLoading, poRows.length]);

  useEffect(() => {
    void fetchMeta();
  }, [fetchMeta]);

  // Non-admin: never stay on "All warehouses" — lock to assigned id(s)
  useEffect(() => {
    if (!whScope || whScope.accessAll) return;
    if (whScope.warehouseIds.length === 0) return;

    const allowed = new Set(whScope.warehouseIds.map(String));
    const needsFix = wh === "all" || !allowed.has(String(wh));
    if (!needsFix) return;

    setWh(whScope.warehouseIds[0]);
    setPage(1);
  }, [whScope, wh]);


  // Auto-select first warehouse when useWarehouses data arrives while modal is open
  useEffect(() => {
    if (!showAdd) return;
    if (warehouseOptions.length === 0) return;
    setForm((f) => {
      if (f.warehouse_id && warehouseOptions.some((w) => w.id === f.warehouse_id)) return f;
      return { ...f, warehouse_id: warehouseOptions[0].id };
    });
  }, [showAdd, warehouseOptions]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", showAdd || !!viewOrder || !!confirmAction);
    return () => document.body.classList.remove("modal-open");
  }, [showAdd, viewOrder, confirmAction]);

  // Close overflow menus on outside click / Escape
  useEffect(() => {
    if (!menuOpenId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".po-action-menu-wrap")) return;
      setMenuOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  const statsView = stats ?? { all: 0, pending: 0, total_value: 0, done: 0 };

  /**
   * Orders visible under warehouse assignment (Inventory-style condition).
   * - Scope still loading → show current orders (no empty flash)
   * - accessAll (admin / access_all_warehouses) → all orders
   * - Assigned warehouses → only those POs
   * - No assignment → empty
   */
  const scopedOrders = useMemo(() => {
    if (!whScope) return orders; // loading
    if (whScope.accessAll) return orders;
    if (whScope.warehouseIds.length === 0) return [];
    const allowed = new Set(whScope.warehouseIds.map(String));
    return orders.filter((o) => {
      const wid = o.warehouse_id ?? o.warehouse?.id ?? null;
      if (!wid) return false;
      return allowed.has(String(wid));
    });
  }, [orders, whScope]);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id) ?? null;

  /** "Products to purchase" options — solely from supplier.product_offers */
  const supplierOffers = parseProductOffers(selectedSupplier?.product_offers);

  const filteredOffers = supplierOffers.filter((offer) => {
    if (!productQuery.trim()) return true;
    return offer.toLowerCase().includes(productQuery.trim().toLowerCase());
  });

  /** Optional: map an offer name to an inventory product_id when a close match exists */
  const resolveInventoryId = (offer: string): string => {
    if (!offer.trim() || products.length === 0) return "";
    const q = offer.toLowerCase();
    const exact = products.find(
      (p) => p.name.toLowerCase() === q || p.sku.toLowerCase() === q
    );
    if (exact) return exact.id;
    const partial = products.find(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        q.includes(p.name.toLowerCase())
    );
    return partial?.id ?? "";
  };

  /** Open modal immediately — warehouses from useWarehouses (shared cache). */
  const openAdd = (prefill?: Partial<PoForm>) => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create purchase orders.");
      return;
    }

    setFormError(null);
    setProductQuery("");

    const cached = poStore().meta;
    const whs = warehouseOptions;
    const sups = suppliers.length
      ? suppliers
      : cached?.suppliers?.length
        ? cached.suppliers
        : [];

    const supplierId = prefill?.supplier_id ?? sups[0]?.id ?? "";
    const supplier = sups.find((s) => s.id === supplierId);
    const offers = parseProductOffers(supplier?.product_offers);
    const firstOffer = offers[0] ?? "";
    const warehouseId = prefill?.warehouse_id ?? whs[0]?.id ?? "";

    setForm({
      ...emptyForm(),
      ...prefill,
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      lines:
        prefill?.lines && prefill.lines.length > 0
          ? prefill.lines
          : [emptyLine(firstOffer)],
    });
    setShowAdd(true);

    // Warehouses: shared React Query (fast). Suppliers/products: local meta if needed.
    if (whs.length === 0) void refetchWarehouses();

    const needMeta =
      sups.length === 0 ||
      products.length === 0 ||
      !cached ||
      !isFresh(cached.at, PO_SOFT_TTL_MS);

    if (needMeta) {
      void fetchMeta(sups.length === 0).then((meta) => {
        if (!meta) return;
        const nextSup = meta.suppliers?.length ? meta.suppliers : sups;
        if (nextSup.length) setSuppliers(nextSup);
        if (meta.products?.length) setProducts(meta.products);

        setForm((f) => {
          const sid = f.supplier_id || nextSup[0]?.id || "";
          const sup = nextSup.find((s) => s.id === sid);
          const offs = parseProductOffers(sup?.product_offers);
          const needLines =
            !f.lines.length ||
            (f.lines.length === 1 && !f.lines[0].offer.trim());
          return {
            ...f,
            supplier_id: sid,
            warehouse_id: f.warehouse_id || warehouseOptions[0]?.id || "",
            lines: needLines && offs[0] ? [emptyLine(offs[0])] : f.lines,
          };
        });
      });
    }
  };

  /** When supplier changes: reset lines to that supplier's product offers */
  const onSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const offers = parseProductOffers(supplier?.product_offers);
    setProductQuery("");
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      lines: [emptyLine(offers[0] ?? "")],
    }));
  };

  const duplicateOrder = (order: PurchaseOrder) => {
    const linesSrc = order.lines ?? order.order_items ?? readCachedPoLines(order.po_number);
    const lines: PoLine[] =
      linesSrc.length > 0
        ? linesSrc.map((ln) => {
            const name =
              ln.product?.name || ln.product_name || ln.name || ln.description || "";
            return {
              key: newLineKey(),
              offer: name,
              product_id: String(ln.product_id ?? ln.product?.id ?? ""),
              qty: String(Number(ln.qty) || 1),
              unit_price: String(Number(ln.unit_price) || 0),
            };
          })
        : [emptyLine()];

    openAdd({
      supplier_id: order.supplier_id ?? order.supplier?.id ?? suppliers[0]?.id ?? "",
      warehouse_id: order.warehouse_id ?? order.warehouse?.id ?? warehouses[0]?.id ?? "",
      reference: order.reference ? `Copy of ${order.reference}` : `Copy of ${order.po_number}`,
      notes: order.notes ?? "",
      status: "pending",
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: "",
      lines,
    });
    setViewOrder(null);
    showToast("info", "Duplicating PO", `Draft based on ${order.po_number}`);
  };

  const copyPoNumber = async (po: string) => {
    try {
      await navigator.clipboard.writeText(po);
      showToast("success", "Copied", po);
    } catch {
      showToast("info", "PO number", po);
    }
  };

  const closeAdd = () => {
    if (saving) return;
    setShowAdd(false);
    setFormError(null);
  };

  const setLine = (key: string, patch: Partial<PoLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };

  /** Select a product-to-purchase from supplier offers */
  const onOfferChange = (key: string, offer: string) => {
    const invId = resolveInventoryId(offer);
    const inv = invId ? products.find((p) => p.id === invId) : undefined;
    setLine(key, {
      offer,
      product_id: invId,
      unit_price: inv ? String(Number(inv.price) || 0) : undefined,
    });
  };

  const addLine = () => {
    const used = new Set(form.lines.map((l) => l.offer.toLowerCase()).filter(Boolean));
    const next = supplierOffers.find((o) => !used.has(o.toLowerCase())) ?? "";
    setForm((f) => ({
      ...f,
      lines: [...f.lines, emptyLine(next)],
    }));
  };

  const removeLine = (key: string) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((l) => l.key !== key),
    }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.supplier_id) {
      setFormError("Supplier is required. Add suppliers first or check the Suppliers API.");
      return;
    }

    if (warehouseOptions.length > 0 && !form.warehouse_id) {
      setFormError("Select a warehouse for receiving.");
      return;
    }

    if (supplierOffers.length === 0) {
      setFormError(
        "This supplier has no product offers. Add product offers on the Suppliers page first."
      );
      return;
    }

    const validLines = form.lines.filter((l) => l.offer.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) {
      setFormError("Select a product to purchase and set quantity greater than zero.");
      return;
    }

    const { items: itemsTotal, total: orderTotal } = formTotals(validLines);
    const primaryOffer = validLines[0].offer.trim();

    // Matches hardened PurchaseOrderController@store
    const payload = {
      supplier_id: form.supplier_id,
      warehouse_id: form.warehouse_id || null,
      order_date: form.order_date || null,
      expected_date: form.expected_date || null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      product_name: primaryOffer,
      items: Math.max(1, Math.round(itemsTotal)),
      total: orderTotal,
      status: form.status || "pending",
    };

    setSaving(true);
    try {
      const { data: body } = await api.post("/purchase-orders", payload);
      const data = (body.data ?? body) as Record<string, unknown>;
      const poId = String(data.id ?? "");
      const poNumber = String(data.po_number ?? `PO-${Date.now().toString().slice(-6)}`);

      const createdLines: PoLineServer[] = validLines.map((l, i) => {
        const q = Math.max(1, Math.round(Number(l.qty) || 1));
        const price = Number(l.unit_price) || 0;
        return {
          id: `local-${i + 1}`,
          product_id: l.product_id || undefined,
          product_name: l.offer.trim(),
          name: l.offer.trim(),
          qty: q,
          unit_price: price,
          line_total: q * price,
          product: {
            id: l.product_id || `offer-${l.offer.trim()}`,
            sku: "",
            name: l.offer.trim(),
          },
        };
      });

      // ProductTransactionController — one purchase transaction per line
      let txOk = 0;
      let txFail = 0;
      await Promise.all(
        validLines.map(async (l) => {
          const q = Math.max(1, Math.round(Number(l.qty) || 1));
          const price = Number(l.unit_price) || 0;
          try {
            await api.post("/product-transactions", {
              product_id:
                l.product_id && UUID_RE.test(l.product_id) ? l.product_id : null,
              product_name: l.offer.trim(),
              transaction_type: "purchase",
              reference_id: poId && UUID_RE.test(poId) ? poId : null,
              reference_number: poNumber,
              partner_id: form.supplier_id,
              partner_type: "supplier",
              quantity: q,
              unit_price: price,
              status: form.status || "pending",
            });
            txOk += 1;
          } catch {
            txFail += 1;
          }
        })
      );

      const created: PurchaseOrder = {
        id: poId || String(Date.now()),
        po_number: poNumber,
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id || null,
        order_date: String(data.order_date ?? form.order_date),
        expected_date: form.expected_date || null,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        items: Number(data.items) || itemsTotal,
        total: Number(data.total) || orderTotal,
        status: String(data.status || form.status || "pending"),
        supplier:
          (data.supplier as PurchaseOrder["supplier"]) ??
          (selectedSupplier
            ? { id: selectedSupplier.id, name: selectedSupplier.name }
            : null),
        warehouse:
          (data.warehouse as PurchaseOrder["warehouse"]) ??
          warehouseOptions.find((w) => w.id === form.warehouse_id) ??
          null,
        lines: createdLines,
        order_items: createdLines,
      };

      cachePoLines(created.po_number, createdLines);

      setShowAdd(false);
      showToast(
        "success",
        "PO created",
        `${created.po_number} · ${primaryOffer}${validLines.length > 1 ? ` +${validLines.length - 1}` : ""} · ${formatPeso(orderTotal)}`
      );
      if (txFail > 0) {
        setTimeout(() => {
          showToast(
            "info",
            "Partial product transactions",
            `${txOk} saved, ${txFail} failed — check Product Transactions`
          );
        }, 500);
      }
      setPage(1);
      await refetchPOs();
      void invalidatePurchaseOrders();
      setViewOrder(created);
      setViewLoading(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create PO");
    } finally {
      setSaving(false);
    }
  };

  type PoAction = {
    id: string;
    label: string;
    status: string;
    icon: React.ReactNode;
    variant: "primary" | "secondary" | "danger";
    confirm?: boolean;
    hint?: string;
  };

  /** Primary forward action in the PO lifecycle */
  const primaryAction = (s: string): PoAction | null => {
    if (!canUpdate) return null;
    const map: Record<string, PoAction> = {
      pending: {
        id: "process",
        label: "Process",
        status: "processing",
        icon: <IconCheck />,
        variant: "primary",
        hint: "Supplier is working on this order",
      },
      processing: {
        id: "ship",
        label: "Ship",
        status: "shipped",
        icon: <IconTruck />,
        variant: "primary",
        hint: "Goods are in transit",
      },
      shipped: {
        id: "receive",
        label: "Receive",
        status: "received",
        icon: <IconBox />,
        variant: "primary",
        hint: "Goods arrived at warehouse — ready for stock-in",
      },
      received: {
        id: "complete",
        label: "Complete",
        status: "completed",
        icon: <IconCheck />,
        variant: "primary",
        hint: "Close the PO after inventory is posted",
      },
    };
    return map[s] ?? null;
  };

  /** Extra actions available from the overflow menu / detail panel */
  const extraActions = (s: string): PoAction[] => {
    if (!canUpdate) return [];
    const actions: PoAction[] = [];
    if (s !== "cancelled" && s !== "completed") {
      actions.push({
        id: "cancel",
        label: "Cancel order",
        status: "cancelled",
        icon: <IconBan />,
        variant: "danger",
        confirm: true,
        hint: "Permanently cancel this purchase order",
      });
    }
    if (s === "cancelled") {
      actions.push({
        id: "reopen",
        label: "Reopen as pending",
        status: "pending",
        icon: <IconCheck />,
        variant: "secondary",
        hint: "Restore a cancelled PO to pending",
      });
    }
    if (s === "completed") {
      actions.push({
        id: "reopen-received",
        label: "Reopen as received",
        status: "received",
        icon: <IconBox />,
        variant: "secondary",
      });
    }
    // Allow jumping backward one step when useful
    if (s === "processing") {
      actions.push({
        id: "back-pending",
        label: "Back to pending",
        status: "pending",
        icon: <IconMore />,
        variant: "secondary",
      });
    }
    if (s === "shipped") {
      actions.push({
        id: "back-processing",
        label: "Back to processing",
        status: "processing",
        icon: <IconMore />,
        variant: "secondary",
      });
    }
    return actions;
  };

  const updateStatus = async (order: PurchaseOrder, nextStatus: string, label?: string) => {
    if (!canUpdate) { showToast("error", "Permission denied", "You cannot update purchase orders."); return; }
    const prevStatus = order.status;
    const updated: PurchaseOrder = { ...order, status: nextStatus };

    // Optimistic UI — apply immediately, no full refetch
    setUpdatingId(order.id);
    setMenuOpenId(null);
    setConfirmAction(null);
    setOrders((rows) => rows.map((r) => (r.id === order.id ? updated : r)));
    if (viewOrder?.id === order.id) setViewOrder(updated);
    setStats((s) => {
      if (!s) return s;
      const next = { ...s };
      if (prevStatus === "pending" && nextStatus !== "pending") {
        next.pending = Math.max(0, next.pending - 1);
      } else if (prevStatus !== "pending" && nextStatus === "pending") {
        next.pending += 1;
      }
      const wasDone = prevStatus === "completed" || prevStatus === "received";
      const isDone = nextStatus === "completed" || nextStatus === "received";
      if (!wasDone && isDone) next.done += 1;
      if (wasDone && !isDone) next.done = Math.max(0, next.done - 1);
      return next;
    });

    try {
      const { data: body } = await api.put(`/purchase-orders/${order.id}`, {
        status: nextStatus,
        
      });
            void invalidatePurchaseOrders();
      // Merge server payload when present
      const serverOrder: PurchaseOrder | null =
        body?.data && typeof body.data === "object"
          ? { ...updated, ...body.data }
          : body?.id
            ? { ...updated, ...body }
            : null;

      if (serverOrder) {
        setOrders((rows) => rows.map((r) => (r.id === order.id ? { ...r, ...serverOrder } : r)));
        if (viewOrder?.id === order.id) {
          setViewOrder((v) => (v ? { ...v, ...serverOrder } : v));
        }
      }

      showToast(
        "success",
        label || "Status updated",
        `${order.po_number} is now ${nextStatus}`
      );

      if (nextStatus === "received") {
        setTimeout(() => {
          showToast(
            "info",
            "Ready for stock-in",
            "Open Stock Movements to post received qty into inventory."
          );
        }, 400);
      }

      // Background stats reconcile (non-blocking)
      api.get("/purchase-orders/stats")
        .then((r) => r.data)
        .then((json) => {
          if (json) setStats(json);
        })
        .catch(() => {
          /* keep optimistic stats */
        });
    } catch (err) {
      // Rollback on failure
      const rolled: PurchaseOrder = { ...order, status: prevStatus };
      setOrders((rows) => rows.map((r) => (r.id === order.id ? rolled : r)));
      if (viewOrder?.id === order.id) setViewOrder(rolled);
      setStats((s) => {
        if (!s) return s;
        const next = { ...s };
        if (prevStatus === "pending" && nextStatus !== "pending") {
          next.pending += 1;
        } else if (prevStatus !== "pending" && nextStatus === "pending") {
          next.pending = Math.max(0, next.pending - 1);
        }
        const wasDone = prevStatus === "completed" || prevStatus === "received";
        const isDone = nextStatus === "completed" || nextStatus === "received";
        if (!wasDone && isDone) next.done = Math.max(0, next.done - 1);
        if (wasDone && !isDone) next.done += 1;
        return next;
      });
      showToast(
        "error",
        "Update failed",
        err instanceof Error ? err.message : "Could not update status — reverted"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const runAction = (order: PurchaseOrder, action: PoAction) => {
    if (!canUpdate) { showToast("error", "Permission denied", "You cannot update purchase orders."); return; }
    if (action.confirm) {
      setConfirmAction({ order, status: action.status, label: action.label });
      setMenuOpenId(null);
      return;
    }
    void updateStatus(order, action.status, action.label);
  };

  /**
   * Enrich line items for the detail sidebar.
   * Prefer supplier product_name/offer; fall back to inventory catalog by product_id.
   */
  const enrichLines = useCallback(
    (lines: PoLineServer[] | undefined, catalog: ProductOpt[]): PoLineServer[] => {
      if (!lines?.length) return [];
      return lines.map((ln) => {
        const offerName =
          ln.product_name || ln.name || ln.description || ln.product?.name || null;
        const pid = String(ln.product_id ?? ln.product?.id ?? "");
        const found = pid ? catalog.find((p) => String(p.id) === pid) : undefined;

        if (ln.product?.name && ln.product?.sku) {
          return {
            ...ln,
            product_name: ln.product_name || ln.product.name,
          };
        }

        if (found) {
          return {
            ...ln,
            product_id: pid || found.id,
            product_name: offerName || found.name,
            product: {
              id: found.id,
              sku: found.sku,
              name: offerName || found.name,
            },
          };
        }

        // Supplier offer only (no inventory match) — still show in sidebar
        if (offerName) {
          return {
            ...ln,
            product_name: offerName,
            product: ln.product ?? {
              id: pid || `offer-${offerName}`,
              sku: "",
              name: offerName,
            },
          };
        }

        return ln;
      });
    },
    []
  );

  const openView = async (order: PurchaseOrder) => {
    // Prefer any lines already on the row / from a just-created PO
    const existingLines = extractLines(order as unknown as Record<string, unknown>);
    const cached = readCachedPoLines(order.po_number);
    const seedLines =
      existingLines.length > 0
        ? existingLines
        : order.lines?.length
          ? order.lines
          : order.order_items?.length
            ? order.order_items
            : cached;

    setViewOrder({
      ...order,
      lines: seedLines.length ? seedLines : order.lines,
      order_items: seedLines.length ? seedLines : order.order_items,
    });
    setViewLoading(true);
    setMenuOpenId(null);

    // Ensure product catalog is available for name resolution
    let catalog = products;
    if (catalog.length === 0) {
      try {
        const { data: prodJson } = await api.get("/inventories", { params: { per_page: 200 } });
        const list: ProductOpt[] = Array.isArray(prodJson) ? prodJson : prodJson.data ?? [];
        catalog = list.map((p) => ({
          id: String(p.id),
          sku: p.sku,
          name: p.name,
          price: p.price,
          qty: p.qty,
        }));
        setProducts(catalog);
      } catch {
        /* ignore */
      }
    }

    try {
      let full: PurchaseOrder | null = null;

      // Controller show() loads supplier, warehouse, items (+ lines / order_items aliases)
      try {
        const { data: body } = await api.get(`/purchase-orders/${order.id}`);
        full = body?.data ?? body;
      } catch {
        /* keep list row */
      }

      if (full?.id) {
        let rawLines = extractLines(full as unknown as Record<string, unknown>);
        if (rawLines.length === 0) {
          rawLines = extractLines(order as unknown as Record<string, unknown>);
        }
        if (rawLines.length === 0) {
          rawLines = readCachedPoLines(full.po_number || order.po_number);
        }
        const lines = enrichLines(rawLines, catalog);
        if (lines.length) cachePoLines(full.po_number || order.po_number, lines);
        setViewOrder({
          ...order,
          ...full,
          lines,
          order_items: lines,
          supplier: full.supplier ?? order.supplier,
          warehouse: full.warehouse ?? order.warehouse,
        });
      } else {
        const raw =
          extractLines(order as unknown as Record<string, unknown>).length > 0
            ? extractLines(order as unknown as Record<string, unknown>)
            : readCachedPoLines(order.po_number);
        const lines = enrichLines(raw, catalog);
        setViewOrder({ ...order, lines, order_items: lines });
      }
    } catch {
      const raw =
        extractLines(order as unknown as Record<string, unknown>).length > 0
          ? extractLines(order as unknown as Record<string, unknown>)
          : readCachedPoLines(order.po_number);
      const lines = enrichLines(raw, catalog);
      setViewOrder({ ...order, lines, order_items: lines });
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="orders-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {permsLoaded && !canView ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div className="empty-state">
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
                <p className="text-muted">
                  You do not have permission to view purchase orders. Ask an admin to grant{" "}
                  <code>purchase_orders.view</code>.
                </p>
              </div>
            </div>
          ) : (
          <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Purchase Orders</h1>
              <p className="page-subtitle">
                Order from suppliers · product lines recorded as transactions · receive into warehouse · ₱
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void refetchPOs();
                  void refetchWarehouses();
                  void fetchMeta(true);
                  showToast("success", "Refreshed", "Orders and suppliers reloaded.");
                }}
                disabled={poFetching || loading}
              >
                <IconRefresh /> {poFetching ? "Refreshing…" : "Refresh"}
              </button>
              {canCreate && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openAdd()}
                disabled={saving}
                title="Create a new purchase order"
              >
                <IconPlus /> New Purchase Order
              </button>
              )}
            </div>
          </div>

          <div className="order-steps">
            <div className="order-step">
              <span className="os-num">1</span>
              <div>
                <strong>Create</strong>
                <span>Supplier + product offers</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">2</span>
              <div>
                <strong>Process</strong>
                <span>Supplier prepares order</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">3</span>
              <div>
                <strong>Ship &amp; receive</strong>
                <span>In transit → warehouse</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">4</span>
              <div>
                <strong>Complete</strong>
                <span>Close after stock-in</span>
              </div>
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

          <div className="stats-grid">
            <button
              type="button"
              className={`stat-card${status === "all" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left" }}
              onClick={() => {
                setStatus("all");
                setPage(1);
              }}
            >
              <div className="stat-label">All Orders</div>
              <div className="stat-value">{loading ? "…" : statsView.all.toLocaleString()}</div>
              <div className="stat-hint">Click to show all</div>
            </button>
            <button
              type="button"
              className={`stat-card${status === "pending" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left" }}
              onClick={() => {
                setStatus(status === "pending" ? "all" : "pending");
                setPage(1);
              }}
            >
              <div className="stat-label">Need Action</div>
              <div className="stat-value warning">
                {loading ? "…" : statsView.pending.toLocaleString()}
              </div>
              <div className="stat-hint">Pending &amp; processing</div>
            </button>
            <div className="stat-card">
              <div className="stat-label">Total Value</div>
              <div className="stat-value">
                {loading ? "…" : formatPeso(Number(statsView.total_value))}
              </div>
              <div className="stat-hint">All PO spend</div>
            </div>
            <button
              type="button"
              className={`stat-card${status === "completed" || status === "received" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left" }}
              onClick={() => {
                setStatus(
                  status === "completed" || status === "received" ? "all" : "completed"
                );
                setPage(1);
              }}
            >
              <div className="stat-label">Done</div>
              <div className="stat-value success">
                {loading ? "…" : statsView.done.toLocaleString()}
              </div>
              <div className="stat-hint">Received / completed</div>
            </button>
          </div>

          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search by PO number or supplier…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-filters">
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={wh}
                  onChange={(e) => {
                    setWh(e.target.value);
                    setPage(1);
                  }}
                  disabled={whScopeLoading}
                >
                  {/* Only admin / access_all sees "All warehouses" (Inventory pattern) */}
                  {whScope?.accessAll && (
                    <option value="all">All warehouses</option>
                  )}
                  {warehouseOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name ? `${w.code} — ${w.name}` : w.code}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSupplier}
                  onChange={(e) => {
                    setFilterSupplier(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Product lines</th>
                    <th>Ordered</th>
                    <th>Expected</th>
                    <th>Units</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Next</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j}>
                            <div
                              className="skel"
                              style={{
                                width: j === 0 ? 140 : j === 1 ? 110 : j === 2 ? 120 : 56,
                                height: 12,
                                background:
                                  "linear-gradient(90deg, var(--sa-cream-2) 25%, var(--sa-beige) 50%, var(--sa-cream-2) 75%)",
                                backgroundSize: "200% 100%",
                                borderRadius: 6,
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : scopedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 10,
                            padding: 24,
                          }}
                        >
                          <IconBox />
                          <p style={{ margin: 0, fontWeight: 550 }}>No orders match your filters</p>
                          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                            Create a PO from a supplier’s product offers to get started.
                          </p>
                          {canCreate && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => openAdd()}
                            disabled={saving}
                          >
                            <IconPlus /> New Purchase Order
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    scopedOrders.map((o) => {
                      const next = nextStepLabel(o.status);
                      const lines = o.lines ?? o.order_items ?? [];
                      const productLabel = poProductLabel(o);
                      const lineCount = lines.length;
                      const units =
                        parseQty(o.items) ||
                        lines.reduce((s, ln) => s + parseQty(ln.qty), 0);
                      const extraOffers =
                        lineCount > 1
                          ? lines
                              .slice(1, 3)
                              .map((ln) => lineDisplayName(ln))
                              .filter(Boolean)
                          : [];
                      return (
                        <tr
                          key={o.id}
                          className={viewOrder?.id === o.id ? "po-row-selected" : undefined}
                          style={{ cursor: "pointer" }}
                          onClick={() => openView(o)}
                          title="Click to view details"
                        >
                          <td>
                            <div className="product-cell">
                              <div
                                className="product-avatar"
                                style={{
                                  background: "rgba(196, 160, 122, 0.14)",
                                  color: "var(--sa-brown)",
                                }}
                              >
                                <IconBox />
                              </div>
                              <div>
                                <div className="product-name">{o.po_number}</div>
                                {o.reference ? (
                                  <div className="product-meta">Ref: {o.reference}</div>
                                ) : (
                                  <div className="product-meta">
                                    {formatDateLong(o.order_date)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="fw-600">{o.supplier?.name ?? "—"}</div>
                            {o.warehouse && (
                              <div className="product-meta">
                                {o.warehouse.code}
                                {o.warehouse.name ? ` · ${o.warehouse.name}` : ""}
                              </div>
                            )}
                          </td>
                          <td>
                            {productLabel ? (
                              <div className="po-product-stack">
                                <div className="fw-600" title={productLabel}>
                                  {truncateText(productLabel, 40)}
                                </div>
                                {extraOffers.length > 0 && (
                                  <div className="product-meta">
                                    +{lineCount - 1} more
                                    {extraOffers[0] ? ` · ${truncateText(extraOffers[0], 20)}` : ""}
                                  </div>
                                )}
                                {lineCount <= 1 && units > 0 && (
                                  <div className="product-meta">
                                    Qty {units.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">
                                {units > 0 ? `${units.toLocaleString()} units` : "No lines"}
                              </span>
                            )}
                          </td>
                          <td className="text-muted">{formatDateLong(o.order_date)}</td>
                          <td className="text-muted">
                            {o.expected_date ? formatDateLong(o.expected_date) : "—"}
                          </td>
                          <td>
                            <span className="fw-600">
                              {(units || Number(o.items) || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="fw-600">{formatPeso(Number(o.total))}</td>
                          <td>
                            <span className={`status-badge status-${o.status}`}>
                              {o.status}
                            </span>
                          </td>
                          <td>
                            {next ? (
                              <span className="po-next-step">{next}</span>
                            ) : o.status === "completed" || o.status === "cancelled" ? (
                              <span className="text-muted">Closed</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <span className="pagination-info">
                Page {page} of {lastPage} · {total.toLocaleString()} total
              </span>
              <div className="pagination-btns">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </button>
                {Array.from({ length: lastPage }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), page + 2)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n === page ? "active" : ""}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </main>
      </div>

      {/* Create PO modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={closeAdd}>
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: "100%", padding: 24, maxHeight: "90vh", overflow: "auto" }}
            role="dialog"
            aria-labelledby="po-create-title"
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
                <h2 id="po-create-title" style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>
                  New Purchase Order
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sa-muted)" }}>
                  Pick a supplier, then choose from their product offers · totals in ₱
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={closeAdd} disabled={saving}>
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

            <form onSubmit={handleAdd}>
              <div className="form-grid-2">
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Supplier *</label>
                  <select
                    required
                    value={form.supplier_id}
                    onChange={(e) => onSupplierChange(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">— Select supplier —</option>
                    {suppliers.map((s) => {
                      const offers = parseProductOffers(s.product_offers);
                      let suffix = "";
                      if (offers.length > 0) {
                        const label =
                          offers.slice(0, 3).join(", ") +
                          (offers.length > 3 ? ` +${offers.length - 3}` : "");
                        suffix = ` · ${truncateText(label)}`;
                      }
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  {suppliers.length === 0 && (
                    <span className="po-field-hint">No suppliers loaded — check Suppliers API</span>
                  )}
                  {selectedSupplier && supplierOffers.length > 0 && (
                    <div className="po-supplier-offers">
                      <div className="po-supplier-offers-head">
                        <span className="po-supplier-offers-label">Product offers</span>
                        <span className="po-supplier-offers-meta">
                          {supplierOffers.length} available for this PO
                        </span>
                      </div>
                      <div className="po-offer-chips">
                        {supplierOffers.map((kw) => (
                          <button
                            key={kw}
                            type="button"
                            className="po-offer-chip"
                            title={`Add “${kw}” as a line`}
                            disabled={saving}
                            onClick={() => {
                              const exists = form.lines.some(
                                (l) => l.offer.toLowerCase() === kw.toLowerCase()
                              );
                              if (exists) {
                                setProductQuery(kw);
                                return;
                              }
                              const emptyIdx = form.lines.findIndex((l) => !l.offer.trim());
                              if (emptyIdx >= 0) {
                                const target = form.lines[emptyIdx];
                                onOfferChange(target.key, kw);
                              } else {
                                setForm((f) => ({
                                  ...f,
                                  lines: [...f.lines, emptyLine(kw)],
                                }));
                              }
                            }}
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedSupplier && supplierOffers.length === 0 && (
                    <span className="po-field-hint">
                      No product offers on this supplier. Add them on the Suppliers page (e.g.
                      Steel, bolts) — those become the “Products to purchase” options.
                    </span>
                  )}
                </div>

                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Warehouse {warehouseOptions.length > 0 ? "*" : ""}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={form.warehouse_id}
                      onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                      disabled={saving || whBusy || whScopeLoading}
                      style={{ flex: 1 }}
                      required={warehouseOptions.length > 0}
                    >
                      {warehouseOptions.length === 0 ? (
                        <option value="">
                          {whBusy || whScopeLoading ? "Loading warehouses…" : "— No warehouses —"}
                        </option>
                      ) : (
                        <>
                          <option value="">— Select warehouse —</option>
                          {warehouseOptions.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name ? `${w.code} — ${w.name}` : w.code}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {warehouseOptions.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={whBusy || whScopeLoading || saving}
                        onClick={() => void refetchWarehouses()}
                        title="Reload warehouses"
                      >
                        {whBusy ? "…" : "Retry"}
                      </button>
                    )}
                  </div>
                  {warehouseOptions.length === 0 && !whBusy && (
                    <span className="po-field-hint" style={{ display: "block", marginTop: 6 }}>
                      No warehouses loaded. Open Warehouses and create at least one site, then
                      click Retry.
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label>Order date</label>
                  <input
                    type="date"
                    value={form.order_date}
                    onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>Expected delivery</label>
                  <input
                    type="date"
                    value={form.expected_date}
                    onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>Reference</label>
                  <input
                    type="text"
                    placeholder="Supplier quote / PR number…"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    disabled={saving}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Notes</label>
                  <input
                    type="text"
                    placeholder="Delivery instructions, payment terms…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Products to purchase — from selected supplier's product_offers only */}
              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Products to purchase</span>
                    {form.supplier_id && (
                      <span className="po-lines-hint">
                        {supplierOffers.length > 0
                          ? `Choose offers · recorded as product transactions`
                          : "This supplier has no product offers yet"}
                      </span>
                    )}
                    {!form.supplier_id && (
                      <span className="po-lines-hint">Select a supplier to load their product offers</span>
                    )}
                  </div>
                  <div className="po-lines-toolbar">
                    {supplierOffers.length > 4 && (
                      <input
                        type="text"
                        className="po-product-filter"
                        placeholder="Filter offers…"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        disabled={saving || !form.supplier_id}
                      />
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addLine}
                      disabled={saving || !form.supplier_id || supplierOffers.length === 0}
                    >
                      <IconPlus /> Add line
                    </button>
                  </div>
                </div>

                {form.supplier_id && supplierOffers.length === 0 && (
                  <p className="po-lines-empty po-lines-soft">
                    No product offers on this supplier. Open the Suppliers page and add offers
                    (e.g. Steel, bolts, electrical components) so they appear here.
                  </p>
                )}

                <div className="po-lines-list">
                  {form.lines.map((line, idx) => {
                    const options =
                      line.offer &&
                      !filteredOffers.some(
                        (o) => o.toLowerCase() === line.offer.toLowerCase()
                      )
                        ? [line.offer, ...filteredOffers]
                        : filteredOffers;
                    return (
                      <div key={line.key} className="po-line-row">
                        <div className="form-field po-line-product">
                          {idx === 0 && <label>Product offer *</label>}
                          <select
                            value={line.offer}
                            onChange={(e) => onOfferChange(line.key, e.target.value)}
                            disabled={saving || !form.supplier_id || supplierOffers.length === 0}
                            required
                          >
                            <option value="">— Select product offer —</option>
                            {options.map((offer) => (
                              <option key={offer} value={offer}>
                                {offer}
                              </option>
                            ))}
                          </select>
                          {line.offer && (
                            <span className="po-line-meta po-offer-match">
                              From supplier product offers
                            </span>
                          )}
                        </div>
                        <div className="form-field po-line-qty">
                          {idx === 0 && <label>Qty *</label>}
                          <div className="po-qty-wrap">
                            <input
                              type="number"
                              min={0.0001}
                              step="any"
                              value={line.qty}
                              onChange={(e) => setLine(line.key, { qty: e.target.value })}
                              disabled={saving}
                              required
                            />
                            <div className="po-qty-btns">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  setLine(line.key, {
                                    qty: String(Math.max(0, (Number(line.qty) || 0) + 1)),
                                  })
                                }
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  setLine(line.key, {
                                    qty: String(Math.max(0, (Number(line.qty) || 0) + 10)),
                                  })
                                }
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="form-field po-line-price">
                          {idx === 0 && <label>Unit ₱</label>}
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => setLine(line.key, { unit_price: e.target.value })}
                            disabled={saving}
                          />
                        </div>
                        <div className="po-line-total">
                          {idx === 0 && <label>Line</label>}
                          <span>{formatPeso(lineTotal(line), 2)}</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon po-line-remove"
                          title="Remove line"
                          disabled={saving || form.lines.length <= 1}
                          onClick={() => removeLine(line.key)}
                        >
                          <IconX />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="po-lines-footer">
                  <div>
                    <div style={{ fontSize: 12, color: "var(--sa-muted)" }}>Order summary</div>
                    <span>
                      {form.lines.filter((l) => l.offer.trim()).length} line
                      {form.lines.filter((l) => l.offer.trim()).length === 1 ? "" : "s"}
                      {" · "}
                      {formTotals(form.lines).items.toLocaleString()} unit
                      {formTotals(form.lines).items === 1 ? "" : "s"}
                      {selectedSupplier ? ` · ${selectedSupplier.name}` : ""}
                    </span>
                  </div>
                  <strong>{formatPeso(formTotals(form.lines).total, 2)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
                <button type="button" className="btn btn-secondary" onClick={closeAdd} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    saving ||
                    suppliers.length === 0 ||
                    !form.supplier_id ||
                    supplierOffers.length === 0
                  }
                >
                  {saving ? "Saving…" : "Create PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer — same pattern as Roles */}
      {viewOrder && (() => {
        const primary = primaryAction(viewOrder.status);
        const extras = extraActions(viewOrder.status);
        const busy = updatingId === viewOrder.id;
        // Lines from client cache / form — product details live in product_transactions
        const rawLines =
          (viewOrder.lines?.length ? viewOrder.lines : null) ??
          (viewOrder.order_items?.length ? viewOrder.order_items : null) ??
          extractLines(viewOrder as unknown as Record<string, unknown>) ??
          readCachedPoLines(viewOrder.po_number);
        const lines = enrichLines(rawLines ?? [], products);
        const linesTotal = lines.reduce((sum, ln) => {
          const qty = parseQty(ln.qty);
          const price = Number(ln.unit_price) || 0;
          return sum + (Number(ln.line_total) || qty * price);
        }, 0);
        const rootProductName =
          poProductLabel(viewOrder) || (lines[0] ? lineDisplayName(lines[0]) : "");
        const rootQty =
          parseQty(viewOrder.items) ||
          lines.reduce((s, ln) => s + parseQty(ln.qty), 0) ||
          0;
        const rootUnitPrice = Number(lines[0]?.unit_price) || 0;
        const rootLineTotal =
          linesTotal || Number(viewOrder.total) || rootQty * rootUnitPrice;

        return (
          <div
            className="roles-drawer-overlay"
            onClick={() => !busy && setViewOrder(null)}
            role="presentation"
          >
            <aside
              className="roles-drawer po-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`Purchase order ${viewOrder.po_number}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="roles-drawer-header">
                <div className="role-cell">
                  <div className="role-avatar role-avatar-lg">PO</div>
                  <div>
                    <h2
                      title="Click to copy"
                      style={{ cursor: "pointer" }}
                      onClick={() => copyPoNumber(viewOrder.po_number)}
                    >
                      {viewOrder.po_number}
                    </h2>
                    <p className="roles-drawer-sub">
                      {viewOrder.supplier?.name ?? "Purchase order"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="roles-modal-close"
                  onClick={() => setViewOrder(null)}
                  disabled={busy}
                  aria-label="Close"
                >
                  <IconX />
                </button>
              </div>

              <div className="roles-drawer-meta po-drawer-meta">
                <div>
                  <span className="meta-label">Status</span>
                  <span className={`status-badge status-${viewOrder.status}`}>
                    {viewOrder.status}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Units</span>
                  <span className="meta-value">
                    {viewLoading ? "…" : rootQty.toLocaleString() || Number(viewOrder.items).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Total</span>
                  <span className="meta-value">{formatPeso(Number(viewOrder.total), 2)}</span>
                </div>
                <div>
                  <span className="meta-label">Ordered</span>
                  <span className="meta-value">{formatDateLong(viewOrder.order_date)}</span>
                </div>
              </div>

              <div className="roles-drawer-body po-drawer-body">
                {viewLoading ? (
                  <div className="roles-empty" style={{ padding: 32 }}>
                    <span className="roles-spinner" />
                    Loading details…
                  </div>
                ) : (
                  <div className="roles-overview po-drawer-sections po-drawer-minimal">
                    {/* Product Purchase — primary content */}
                    <section className="po-drawer-section">
                      <h3>
                        Product Purchase
                        {(lines.length > 0 || rootProductName) && (
                          <span className="po-drawer-count">
                            {lines.length > 0
                              ? `${lines.length} line${lines.length === 1 ? "" : "s"}`
                              : "1 line"}
                          </span>
                        )}
                      </h3>
                      {lines.length > 0 ? (
                        <div className="po-purchase-list">
                          {lines.map((ln, i) => {
                            const qty = Number(ln.qty) || 0;
                            const price = Number(ln.unit_price) || 0;
                            const lt = Number(ln.line_total) || qty * price;
                            const name = lineDisplayName(ln);
                            return (
                              <div
                                key={ln.id ?? `${ln.product_id}-${name}-${i}`}
                                className="po-purchase-row"
                              >
                                <div className="po-purchase-main">
                                  <span className="po-purchase-name">{name || "—"}</span>
                                  <span className="po-purchase-meta">
                                    {qty.toLocaleString()} × {formatPeso(price, 2)}
                                  </span>
                                </div>
                                <span className="po-purchase-total">{formatPeso(lt, 2)}</span>
                              </div>
                            );
                          })}
                          <div className="po-purchase-row po-purchase-footer">
                            <span>Total</span>
                            <span className="fw-600">
                              {formatPeso(linesTotal || Number(viewOrder.total), 2)}
                            </span>
                          </div>
                        </div>
                      ) : rootProductName ? (
                        <div className="po-purchase-list">
                          <div className="po-purchase-row">
                            <div className="po-purchase-main">
                              <span className="po-purchase-name">{rootProductName}</span>
                              <span className="po-purchase-meta">
                                {rootQty.toLocaleString()} × {formatPeso(rootUnitPrice, 2)}
                              </span>
                            </div>
                            <span className="po-purchase-total">
                              {formatPeso(rootLineTotal, 2)}
                            </span>
                          </div>
                          <div className="po-purchase-row po-purchase-footer">
                            <span>Total</span>
                            <span className="fw-600">{formatPeso(rootLineTotal, 2)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="po-drawer-empty-msg">No products on this order.</p>
                      )}
                    </section>

                    {/* Details — compact */}
                    <section className="po-drawer-section">
                      <h3>Details</h3>
                      <dl className="po-drawer-dl po-drawer-dl-compact">
                        <div>
                          <dt>Supplier</dt>
                          <dd>{viewOrder.supplier?.name ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Warehouse</dt>
                          <dd>
                            {viewOrder.warehouse
                              ? viewOrder.warehouse.name
                                ? `${viewOrder.warehouse.code} — ${viewOrder.warehouse.name}`
                                : viewOrder.warehouse.code
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Expected</dt>
                          <dd>
                            {viewOrder.expected_date
                              ? formatDateLong(viewOrder.expected_date)
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Reference</dt>
                          <dd>{viewOrder.reference || "—"}</dd>
                        </div>
                        {viewOrder.notes ? (
                          <div className="po-drawer-dl-full">
                            <dt>Notes</dt>
                            <dd>{viewOrder.notes}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    {/* Workflow — compact strip */}
                    {viewOrder.status !== "cancelled" && (
                      <section className="po-drawer-section">
                        <h3>Workflow</h3>
                        <div className="po-workflow">
                          {WORKFLOW_STEPS.map((step, i) => {
                            const cur = workflowIndex(viewOrder.status);
                            return (
                              <div
                                key={step}
                                className={`po-workflow-step ${cur >= i ? "done" : ""} ${cur === i ? "active" : ""}`}
                              >
                                <span className="po-workflow-dot" />
                                <span className="po-workflow-label">{step}</span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Status — single control */}
                    <section className="po-drawer-section">
                      <h3>Status</h3>
                      <div className="form-field">
                        <select
                          value={viewOrder.status}
                          disabled={busy || !canUpdate}
                          title={!canUpdate ? "No permission to update" : undefined}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === viewOrder.status) return;
                            if (next === "cancelled") {
                              setConfirmAction({
                                order: viewOrder,
                                status: "cancelled",
                                label: "Cancel order",
                              });
                              return;
                            }
                            void updateStatus(viewOrder, next, `Set to ${next}`);
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </section>
                  </div>
                )}
              </div>

              <div className="roles-drawer-footer po-drawer-footer">
                <div className="po-drawer-footer-left">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => duplicateOrder(viewOrder)}
                  >
                    <IconPlus /> Duplicate
                  </button>
                  {extras
                    .filter((a) => a.variant === "danger")
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="btn btn-danger-outline"
                        disabled={busy}
                        onClick={() => runAction(viewOrder, a)}
                      >
                        {a.icon}
                        {a.label}
                      </button>
                    ))}
                </div>
                <div className="po-drawer-footer-right">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setViewOrder(null)}
                    disabled={busy}
                  >
                    Close
                  </button>
                  {primary && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => runAction(viewOrder, primary)}
                    >
                      {primary.icon}
                      {busy ? "Updating…" : primary.label}
                    </button>
                  )}
                </div>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* Confirm destructive action */}
      {confirmAction && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onClick={() => !updatingId && setConfirmAction(null)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400, width: "100%", padding: 24, textAlign: "center" }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{confirmAction.label}?</h2>
            <p style={{ margin: "0 0 20px", color: "var(--sa-muted)", fontSize: 14, lineHeight: 1.5 }}>
              <strong>{confirmAction.order.po_number}</strong> will be set to{" "}
              <strong>{confirmAction.status}</strong>. This can usually be reversed later if needed.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!updatingId}
                onClick={() => setConfirmAction(null)}
              >
                Keep as is
              </button>
              <button
                type="button"
                className="btn btn-danger-outline"
                disabled={!!updatingId}
                onClick={() =>
                  updateStatus(confirmAction.order, confirmAction.status, confirmAction.label)
                }
              >
                {updatingId ? "Updating…" : confirmAction.label}
              </button>
            </div>
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

export default PurchaseOrders;