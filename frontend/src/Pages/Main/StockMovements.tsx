import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePermissions } from "../../hooks/useCurrentUser";
import { fetchWarehousesCached } from "../../hooks/useWarehouses";
import { useStockMovementsList } from "../../hooks/useStockMovements";
import { invalidateStockMovements } from "../../lib/invalidate";
import "../css/Main.css";


function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  const j = json as { data?: T[] | { data?: T[] } };
  if (Array.isArray(j.data)) return j.data;
  if (j.data && typeof j.data === "object" && Array.isArray((j.data as { data?: T[] }).data)) {
    return (j.data as { data: T[] }).data;
  }
  return [];
}

/* ── Module cache (survives Strict M`ode) ───────────────────── */
const SM_TTL = 60_000;
type CE<T> = { data: T; at: number };
const productsCache: { entry: CE<any[]> | null; inflight: Promise<any[]> | null } = { entry: null, inflight: null };
const warehousesCache: { entry: CE<any[]> | null; inflight: Promise<any[]> | null } = { entry: null, inflight: null };
const historyCache = new Map<string, CE<any[]>>();
const historyInflight = new Map<string, Promise<any[]>>();
function isFresh<T>(e: CE<T> | null | undefined): e is CE<T> {
  return !!e && Date.now() - e.at < SM_TTL;
}
let smMetaBootstrapped = false;

const SS_HIST = "sm:lastHistory";
const SS_PROD = "sm:lastProducts";
const SS_WH = "sm:lastWarehouses";

function readSS<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
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

/* ===================== ICONS ===================== */

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconDownload = () => (
  <svg {...svg} width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconUpload = () => (
  <svg {...svg} width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconTransfer = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IconAdjust = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

const IconPlus = () => (
  <svg {...svg} width="16" height="16">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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

/* ===================== TYPES ===================== */

type MoveType = "in" | "out" | "transfer" | "adjust";

type ProductOpt = {
  id: string;
  sku: string;
  name: string;
  qty?: number | string;
  warehouse_id?: string | null;
  warehouse?: { id: string; code: string } | null;
};

type WarehouseOpt = { id: string; code: string; name?: string };

type ApiMovement = {
  id: string;
  movement_number: string;
  type: string;
  qty: number | string;
  reference: string | null;
  notes: string | null;
  status: string;
  movement_date: string;
  product?: { id: string; sku: string; name: string } | null;
  from_warehouse?: { id: string; code: string } | null;
  to_warehouse?: { id: string; code: string } | null;
  fromWarehouse?: { id: string; code: string } | null;
  toWarehouse?: { id: string; code: string } | null;
};

const TYPE_META: Record<
  MoveType,
  {
    label: string;
    short: string;
    className: string;
    icon: React.ReactNode;
    api: string;
    hint: string;
    effect: string;
  }
> = {
  in: {
    label: "Stock In",
    short: "In",
    className: "type-in",
    icon: <IconDownload />,
    api: "IN",
    hint: "Receive goods into a warehouse (PO receiving, returns, found stock).",
    effect: "Increases on-hand quantity at the destination warehouse.",
  },
  out: {
    label: "Stock Out",
    short: "Out",
    className: "type-out",
    icon: <IconUpload />,
    api: "OUT",
    hint: "Issue stock for sales, consumption, or write-off from a warehouse.",
    effect: "Decreases on-hand quantity at the source warehouse.",
  },
  transfer: {
    label: "Transfer",
    short: "Xfer",
    className: "type-transfer",
    icon: <IconTransfer />,
    api: "TRANSFER",
    hint: "Move inventory between two warehouses without changing total stock.",
    effect: "Decreases From WH and increases To WH by the same quantity.",
  },
  adjust: {
    label: "Adjustment",
    short: "Adj",
    className: "type-adjust",
    icon: <IconAdjust />,
    api: "ADJUSTMENT",
    hint: "Correct system qty after cycle count, damage, shrinkage, or found stock.",
    effect: "Sets or corrects quantity based on the selected reason.",
  },
};

const ADJUST_REASONS = [
  { value: "cycle-count", label: "Cycle count — set absolute quantity" },
  { value: "damage", label: "Damage / write-off (−)" },
  { value: "shrinkage", label: "Shrinkage (−)" },
  { value: "found", label: "Found stock (+)" },
  { value: "other", label: "Other — set absolute quantity" },
] as const;

function toFrontType(apiType: string): MoveType {
  const t = (apiType || "").toUpperCase();
  if (t === "IN") return "in";
  if (t === "OUT") return "out";
  if (t === "TRANSFER") return "transfer";
  return "adjust";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function qtyDisplay(type: MoveType, q: number): string {
  if (type === "out") return `−${q.toLocaleString()}`;
  if (type === "adjust") return q.toLocaleString();
  return `+${q.toLocaleString()}`;
}

function num(v: number | string | null | undefined): number {
  return Number(v ?? 0);
}

/* ===================== COMPONENT ===================== */

function StockMovements() {
  const [history, setHistory] = useState<ApiMovement[]>(() => {
    const first = historyCache.values().next().value;
    if (first?.data?.length) return first.data as ApiMovement[];
    const snap = readSS<{ rows: ApiMovement[]; at: number }>(SS_HIST);
    if (snap?.rows?.length && Date.now() - (snap.at || 0) < 10 * 60_000) return snap.rows;
    return [];
  });
  const [products, setProducts] = useState<ProductOpt[]>(() => {
    if (productsCache.entry?.data?.length) return productsCache.entry.data as ProductOpt[];
    const snap = readSS<{ rows: ProductOpt[]; at: number }>(SS_PROD);
    if (snap?.rows?.length && Date.now() - (snap.at || 0) < 30 * 60_000) return snap.rows;
    return [];
  });
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>(() => {
    if (warehousesCache.entry?.data?.length) return warehousesCache.entry.data as WarehouseOpt[];
    const snap = readSS<{ rows: WarehouseOpt[]; at: number }>(SS_WH);
    if (snap?.rows?.length && Date.now() - (snap.at || 0) < 30 * 60_000) return snap.rows;
    return [];
  });
  // No full-page loading gate (show shell immediately after login)
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

    const {
    rows: movementRows,
    isLoading: movLoading,
    isFetching: movFetching,
    refetch: refetchMovements,
    } = useStockMovementsList({
    page: 1,
    perPage: 50,
    search: debouncedSearch,
    type:
      filterType === "all"
        ? ""
        : ({ in: "IN", out: "OUT", transfer: "TRANSFER", adjust: "ADJUSTMENT" } as Record<string, string>)[
            filterType
          ] ?? filterType,
    enabled: true,
  });

  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [moveType, setMoveType] = useState<MoveType>("in");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("cycle-count");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", modalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [modalOpen]);

  // Escape closes modal
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, submitting]);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();


  const canView = can("movements.view",
    "stock_movements.view",
    "stock-movements.view",
    
  );
  const canCreate = can("movements.create",
    "stock_movements.create",
    "stock-movements.create",
   
  );

  const loadWarehouses = useCallback(async (force = false): Promise<WarehouseOpt[]> => {
    if (!force && isFresh(warehousesCache.entry)) return warehousesCache.entry.data as WarehouseOpt[];
    if (!force && warehousesCache.inflight) return warehousesCache.inflight as Promise<WarehouseOpt[]>;

    const work = (async () => {
      try {
        const rows = (await fetchWarehousesCached())
          .map((w) => ({
            id: String(w.id ?? ""),
            code: String(w.code ?? ""),
            name: w.name != null ? String(w.name) : undefined,
          }))
          .filter((w) => w.id)
          .sort((a, b) => a.code.localeCompare(b.code));
        return rows;
      } catch {
        return [] as WarehouseOpt[];
      }
    })();

    warehousesCache.inflight = work;
    try {
      const rows = await work;
      warehousesCache.entry = { data: rows, at: Date.now() };
      writeSS(SS_WH, { rows, at: Date.now() });
      return rows;
    } finally {
      warehousesCache.inflight = null;
    }
  }, []);

  const loadProducts = useCallback(async (force = false): Promise<ProductOpt[]> => {
    if (!force && isFresh(productsCache.entry)) return productsCache.entry.data as ProductOpt[];
    if (!force && productsCache.inflight) return productsCache.inflight as Promise<ProductOpt[]>;

    const work = (async () => {
      try {
        const { data: json } = await api.get("/inventories", {
          params: { per_page: 50, paginate: true },
          timeout: 30_000,
        });
        return extractArr<ProductOpt>(json).map((p) => ({ ...p, id: String(p.id) }));
      } catch (e) {
        console.warn("[StockMovements] loadProducts failed:", e);
        return (productsCache.entry?.data as ProductOpt[]) ?? [];
      }
    })();

    productsCache.inflight = work;
    try {
      const rows = await work;
      if (rows.length) {
        productsCache.entry = { data: rows, at: Date.now() };
        writeSS(SS_PROD, { rows, at: Date.now() });
      }
      return rows;
    } finally {
      productsCache.inflight = null;
    }
  }, []);

  const loadHistory = useCallback(async (force = false) => {
    const params: Record<string, string | number> = { per_page: 50 };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (filterType !== "all") {
      const map: Record<string, string> = {
        in: "IN",
        out: "OUT",
        transfer: "TRANSFER",
        adjust: "ADJUSTMENT",
      };
      params.type = map[filterType] ?? filterType;
    }

    const cacheKey = JSON.stringify(params);
    const cached = historyCache.get(cacheKey);
    if (!force && isFresh(cached)) {
      setHistory(cached!.data as ApiMovement[]);
      return cached!.data as ApiMovement[];
    }
    if (cached) setHistory(cached.data as ApiMovement[]);

    if (!force && historyInflight.has(cacheKey)) {
      try {
        const rows = (await historyInflight.get(cacheKey)!) as ApiMovement[];
        setHistory(rows);
        return rows;
      } catch {
        return (cached?.data as ApiMovement[]) ?? [];
      }
    }

    const work = (async () => {
      const { data: json } = await api.get("/stock-movements", { params });
      return extractArr<ApiMovement>(json);
    })();

    historyInflight.set(cacheKey, work);
    try {
      const rows = await work;
      historyCache.set(cacheKey, { data: rows, at: Date.now() });
      setHistory(rows);
      writeSS(SS_HIST, { rows, at: Date.now() });
      return rows;
    } finally {
      historyInflight.delete(cacheKey);
    }
  }, [debouncedSearch, filterType]);

  const bootstrapMeta = useCallback(async (force = false) => {
    try {
      const [prodResult, whResult] = await Promise.allSettled([
        loadProducts(force),
        loadWarehouses(force),
      ]);

      const productRows = prodResult.status === "fulfilled" ? prodResult.value : [];
      const locationWarehouses = whResult.status === "fulfilled" ? whResult.value : [];

      if (prodResult.status === "rejected") {
        console.warn("[StockMovements] products meta failed:", prodResult.reason);
      }
      if (whResult.status === "rejected") {
        console.warn("[StockMovements] warehouses meta failed:", whResult.reason);
      }

      setProducts(productRows);
      setProductId((prev) => prev || productRows[0]?.id || "");

      let whList = locationWarehouses;
      if (whList.length === 0) {
        const whMap = new Map<string, WarehouseOpt>();
        productRows.forEach((p) => {
          if (p.warehouse?.id) {
            whMap.set(String(p.warehouse.id), {
              id: String(p.warehouse.id),
              code: p.warehouse.code ?? "",
            });
          }
        });
        whList = Array.from(whMap.values());
      }
      setWarehouses(whList);
      setWarehouseId((prev) => prev || whList[0]?.id || "");
      setFromWh((prev) => prev || whList[0]?.id || "");
      setToWh((prev) => prev || whList[1]?.id || whList[0]?.id || "");
    } catch (e) {
      console.warn("[StockMovements] meta failed:", e);
    }
  }, [loadProducts, loadWarehouses]);

   [bootstrapMeta, loadHistory];

  // Defer products/warehouses so initial paint only waits on stock-movements.
  // Load from cache immediately; network fetch after history or when modal opens.
  useEffect(() => {
    if (productsCache.entry) setProducts(productsCache.entry.data as ProductOpt[]);
    if (warehousesCache.entry) setWarehouses(warehousesCache.entry.data as WarehouseOpt[]);

    // Background prefetch after a short idle so it doesn't compete with history
    const t = window.setTimeout(() => {
      if (!smMetaBootstrapped) {
        smMetaBootstrapped = true;
        void bootstrapMeta(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [bootstrapMeta]);

  // History on filter/search change + initial (paint cache first)  /* Phase 6: TanStack Query → history */
    // Once we have shown any rows this session, never full-page load again
  const hasDataRef = useRef(history.length > 0);

  useEffect(() => {
    if (history.length > 0) hasDataRef.current = true;
  }, [history.length]);

  // Sync TanStack rows → local history (keep previous while empty+loading)
  useEffect(() => {
    if (!movementRows) return;
    if (movementRows.length === 0 && movLoading) return;

    setHistory(movementRows as ApiMovement[]);
    setLoading(false);
    setError(null);
  }, [movementRows, movLoading]);

  // Never block the page on first fetch — keep previous rows / empty state
  useEffect(() => {
    if (history.length > 0 || !movLoading) {
      setLoading(false);
    }
  }, [movLoading, history.length]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = history.filter((m) => (m.movement_date || "").startsWith(todayStr)).length;
    const ins = history.filter((m) => m.type?.toUpperCase() === "IN").length;
    const outs = history.filter((m) => m.type?.toUpperCase() === "OUT").length;
    const transfers = history.filter((m) => m.type?.toUpperCase() === "TRANSFER").length;
    const adjusts = history.filter((m) => {
      const t = m.type?.toUpperCase() ?? "";
      return t === "ADJUSTMENT" || t === "ADJUST";
    }).length;
    return { today, ins, outs, transfers, adjusts, total: history.length };
  }, [history]);

  const resetForm = () => {
    setQty("");
    setRef("");
    setNotes("");
    setReason("cycle-count");
    setMoveType("in");
    setFormError(null);
  };

  const openModal = (preset?: MoveType) => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create stock movements.");
      return;
    }
    resetForm();
    if (preset) setMoveType(preset);
    setModalOpen(true);
    // Ensure products/warehouses ready for the form (uses cache if fresh)
    void bootstrapMeta(false);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setFormError(null);
  };

  const validate = (): string | null => {
    const q = parseFloat(qty);
    if (!productId) return "Select a product.";
    if (!q || q <= 0) return "Enter a quantity greater than zero.";
    if (moveType === "transfer") {
      if (!fromWh || !toWh) return "Select both From and To warehouses.";
      if (fromWh === toWh) return "From and To warehouses must be different.";
    } else if (!warehouseId) {
      return "Select a warehouse.";
    }
    return null;
  };

  const submitMovement = async () => {
    if (!canCreate) {
      setFormError("You do not have permission to post movements.");
      return;
    }
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);

    const q = parseFloat(qty);
    const payload: Record<string, unknown> = {
      product_id: productId,
      type: TYPE_META[moveType].api,
      qty: q,
      reference: ref.trim() || null,
      notes: notes.trim() || null,
    };

    if (moveType === "transfer") {
      payload.from_warehouse_id = fromWh || null;
      payload.to_warehouse_id = toWh || null;
    } else if (moveType === "in") {
      payload.to_warehouse_id = warehouseId || null;
      payload.warehouse_id = warehouseId || null;
    } else if (moveType === "out") {
      payload.from_warehouse_id = warehouseId || null;
      payload.warehouse_id = warehouseId || null;
    } else {
      payload.from_warehouse_id = warehouseId || null;
      payload.warehouse_id = warehouseId || null;
      payload.reason = reason;
    }

        setSubmitting(true);
    try {
      const { data: body } = await api.post("/stock-movements", payload);
      showToast(
        "success",
        "Movement posted",
        `${TYPE_META[moveType].label}${
          body.movement?.movement_number ? ` · ${body.movement.movement_number}` : ""
        } saved. Inventory qty updated.`
      );
      resetForm();
      setModalOpen(false);
      await refetchMovements();
      void invalidateStockMovements();
    } catch (e: any) {
      console.error(e);
      const body = e.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        e.message ||
        "Could not post movement";
      setFormError(String(msg));
      showToast("error", "Failed", String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const fromCode = (m: ApiMovement) =>
    m.from_warehouse?.code ?? m.fromWarehouse?.code ?? "—";
  const toCode = (m: ApiMovement) =>
    m.to_warehouse?.code ?? m.toWarehouse?.code ?? "—";

  const refPlaceholder =
    moveType === "in"
      ? "PO / ASN number…"
      : moveType === "out"
      ? "SO / order number…"
      : moveType === "transfer"
      ? "Transfer reference…"
      : "Count session / ticket…";

  return (
    <div className="stock-movements-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Stock Movements</h1>
              <p className="page-subtitle">
                Record stock in, out, transfers & adjustments · live inventory updates
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                              onClick={() => {
                  void refetchMovements();
                  void bootstrapMeta(true);
                }}
                disabled={movFetching || loading}
              >
                <IconRefresh /> {movFetching ? "Refreshing…" : "Refresh"}
              </button>
              {canCreate && (
               <button type="button" className="btn btn-primary" onClick={() => openModal()}>
                  <IconPlus /> Create Stock Movement
                </button>
              )}
            </div>
          </div>

          {permsLoaded && !canView ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div className="empty-state">
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
                <p className="text-muted">
                  You do not have permission to view stock movements. Ask an admin to grant{" "}
                  <code>movements.view</code>.
                </p>
              </div>
            </div>
          ) : (
          <>

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
              <span style={{ color: "var(--sa-text)" }}>{error}</span>
            </div>
          )}

          {/* KPI strip — click filters history by type */}
          <div className="stats-grid">
            <button
              type="button"
              className={`stat-card sm-stat-btn ${filterType === "all" ? "sm-stat-active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              <div className="stat-label">Today</div>
              <div className="stat-value">{stats.today}</div>
              <div className="stat-hint">Posted today · all types</div>
            </button>
            <button
              type="button"
              className={`stat-card sm-stat-btn ${filterType === "in" ? "sm-stat-active" : ""}`}
              onClick={() => setFilterType(filterType === "in" ? "all" : "in")}
            >
              <div className="stat-label">Stock In</div>
              <div className="stat-value success">{stats.ins}</div>
              <div className="stat-hint">In current list</div>
            </button>
            <button
              type="button"
              className={`stat-card sm-stat-btn ${filterType === "out" ? "sm-stat-active" : ""}`}
              onClick={() => setFilterType(filterType === "out" ? "all" : "out")}
            >
              <div className="stat-label">Stock Out</div>
              <div className="stat-value danger">{stats.outs}</div>
              <div className="stat-hint">In current list</div>
            </button>
            <button
              type="button"
              className={`stat-card sm-stat-btn ${filterType === "transfer" ? "sm-stat-active" : ""}`}
              onClick={() => setFilterType(filterType === "transfer" ? "all" : "transfer")}
            >
              <div className="stat-label">Transfers</div>
              <div className="stat-value">{stats.transfers}</div>
              <div className="stat-hint">Inter-warehouse</div>
            </button>
          </div>

          {/* Quick-create shortcuts */}
          {canCreate && (
          <div className="sm-quick-row">
            {(["in", "out", "transfer", "adjust"] as MoveType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`sm-quick-chip ${TYPE_META[t].className}`}
                onClick={() => openModal(t)}
              >
                {TYPE_META[t].icon}
                <span>{TYPE_META[t].label}</span>
              </button>
            ))}
          </div>
          )}

          {/* History table */}
          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search movement ID, SKU, product, reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-filters">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="all">All types</option>
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjust">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="table-wrap">
              <table className="sm-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Ref</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <td key={j}>
                            <div
                              className="skel"
                              style={{ width: j === 3 ? 130 : j === 0 ? 72 : 48, height: 12 }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="empty-row">
                        <div className="empty-state">
                          <IconBox />
                          <p>No movements match your filters</p>
                          {canCreate && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => openModal()}
                            style={{ marginTop: 8 }}
                          >
                            <IconPlus /> Create Stock Movement
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    history.map((m) => {
                      const ft = toFrontType(m.type);
                      const q = num(m.qty);
                      return (
                        <tr key={m.id}>
                          <td className="fw-600">{m.movement_number || m.id.slice(0, 8)}</td>
                          <td>
                            <span className={`type-badge ${TYPE_META[ft].className}`}>
                              {TYPE_META[ft].icon}
                              {TYPE_META[ft].label}
                            </span>
                          </td>
                          <td className="fw-600">{m.product?.sku ?? "—"}</td>
                          <td>{m.product?.name ?? "—"}</td>
                          <td className={`fw-600 ${ft === "out" ? "qty-neg" : ""}`}>
                            {qtyDisplay(ft, q)}
                          </td>
                          <td className="text-muted">{fromCode(m)}</td>
                          <td className="text-muted">{toCode(m)}</td>
                          <td>{m.reference || "—"}</td>
                          <td className="text-muted">{formatDate(m.movement_date)}</td>
                          <td>
                            <span className="status-badge status-posted">
                              {m.status || "posted"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && history.length > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">
                  Showing {history.length} movement{history.length === 1 ? "" : "s"}
                  {filterType !== "all" ? ` · filtered by ${TYPE_META[filterType as MoveType]?.label ?? filterType}` : ""}
                </span>
              </div>
            )}
          </div>
          </>
          )}
        </main>
      </div>

      {/* ===== Create modal ===== */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal sm-create-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="sm-create-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="sm-create-title">Create Stock Movement</h2>
                <div className="card-sub" style={{ marginTop: 4 }}>
                  {TYPE_META[moveType].hint}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>

            <div className="sm-modal-body">
              {/* 1. Movement type */}
              <section className="sm-section">
                <div className="sm-section-label">1 · Movement type</div>
                <div className="sm-type-picker" role="group" aria-label="Movement type">
                  {(["in", "out", "transfer", "adjust"] as MoveType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`sm-type-chip ${moveType === t ? "active" : ""} ${TYPE_META[t].className}`}
                      onClick={() => {
                        setMoveType(t);
                        setFormError(null);
                      }}
                      disabled={submitting}
                    >
                      {TYPE_META[t].icon}
                      <span>{TYPE_META[t].label}</span>
                    </button>
                  ))}
                </div>
                <p className="sm-type-effect">{TYPE_META[moveType].effect}</p>
              </section>

              {/* 2. Product & quantity */}
              <section className="sm-section">
                <div className="sm-section-label">2 · Product & quantity</div>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Product *</label>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      disabled={submitting || products.length === 0}
                    >
                      {products.length === 0 ? (
                        <option value="">No products loaded</option>
                      ) : (
                        products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min={0.0001}
                      step="any"
                      placeholder="0"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
                {selectedProduct && (
                  <div className="sm-selected-product">
                    <IconBox />
                    <div>
                      <strong>
                        {selectedProduct.sku} · {selectedProduct.name}
                      </strong>
                      <span>
                        On hand: {num(selectedProduct.qty).toLocaleString()}
                        {selectedProduct.warehouse?.code
                          ? ` · WH ${selectedProduct.warehouse.code}`
                          : ""}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Location */}
              <section className="sm-section">
                <div className="sm-section-label">
                  3 · {moveType === "transfer" ? "Warehouses" : "Warehouse"}
                </div>
                <div className="form-grid">
                  {moveType === "transfer" ? (
                    <>
                      <div className="form-field">
                        <label>From warehouse *</label>
                        <select
                          value={fromWh}
                          onChange={(e) => setFromWh(e.target.value)}
                          disabled={submitting}
                        >
                          {warehouses.length === 0 && <option value="">No warehouses</option>}
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code}
                              {w.name ? ` — ${w.name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>To warehouse *</label>
                        <select
                          value={toWh}
                          onChange={(e) => setToWh(e.target.value)}
                          disabled={submitting}
                        >
                          {warehouses.length === 0 && <option value="">No warehouses</option>}
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code}
                              {w.name ? ` — ${w.name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="form-field">
                      <label>Warehouse *</label>
                      <select
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        disabled={submitting}
                      >
                        {warehouses.length === 0 && <option value="">No warehouses</option>}
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code}
                            {w.name ? ` — ${w.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {moveType === "adjust" && (
                    <div className="form-field">
                      <label>Reason *</label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={submitting}
                      >
                        {ADJUST_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </section>

              {/* 4. Reference */}
              <section className="sm-section">
                <div className="sm-section-label">4 · Reference (optional)</div>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Reference</label>
                    <input
                      type="text"
                      placeholder={refPlaceholder}
                      value={ref}
                      onChange={(e) => setRef(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="form-field full">
                    <label>Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes for audit trail"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </section>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submitMovement}
                  disabled={submitting || products.length === 0}
                >
                  {submitting ? "Posting…" : `Post ${TYPE_META[moveType].label}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`sm-toast ${toast.type}`}>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default StockMovements;