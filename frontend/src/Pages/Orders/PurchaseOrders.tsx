import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { usePurchaseOrders } from "../../hooks/useOrders";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidatePurchaseOrders } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import { lookupKeys } from "../../lib/cachedLookups";
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
};
type Warehouse = { id: string; code: string; name?: string };

type ProductOpt = {
  id: string;
  sku: string;
  name: string;
  price?: number | string;
  qty?: number | string;
};

function truncateText(s: string, max = 48): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Every new PO line must identify a product from the catalog. */
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
  /** Product lines returned by the purchase-order API. */
  lines?: PoLineServer[];
  order_items?: PoLineServer[];
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


function PurchaseOrders() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wh, setWh] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [productQuery, setProductQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const {
    rows: poRows,
    meta: poMeta,
    stats: poStats,
    isLoading: poLoading,
    isFetching: poFetching,
    isError: poIsError,
    error: poError,
    refetchAll: refetchPOs,
  } = usePurchaseOrders({
    page,
    perPage: pageSize,
    search: debouncedSearch,
    status,
    // Sales Orders pattern: "all" → null (API scopes non-admins)
    warehouseId: wh === "all" || !wh ? null : wh,
    supplierId: filterSupplier === "all" || !filterSupplier ? null : filterSupplier,
    enabled: true,
  });



  // Shared React Query cache (same as Dashboard / Receiving / Location)
  const {
    rows: whRows,
    isLoading: whLoading,
    isFetching: whFetching,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true, perPage: 200 });

  const supplierLookup = useQuery({
    queryKey: [...lookupKeys.suppliers, "purchase-order-options"],
    queryFn: async () => {
      const { data } = await api.get("/suppliers", { params: { per_page: 200 } });
      return extractList<Supplier>(data)
        .map((supplier) => ({
          id: String(supplier.id),
          name: supplier.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60_000,
  });
  const productLookup = useQuery({
    queryKey: [...lookupKeys.products, "purchase-order-catalog"],
    queryFn: async () => {
      const firstPage = await api.get("/inventories", {
        params: { per_page: 100, page: 1 },
      });
      const lastPage = Math.max(1, Number(firstPage.data?.last_page) || 1);
      const remainingPages = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) =>
          api.get("/inventories", {
            params: { per_page: 100, page: index + 2 },
          })
        )
      );
      return [firstPage, ...remainingPages]
        .flatMap(({ data }) => extractList<ProductOpt>(data))
        .map((product) => ({
          id: String(product.id),
          sku: product.sku,
          name: product.name,
          price: product.price,
          qty: product.qty,
        }));
    },
    staleTime: 5 * 60_000,
  });
  const suppliers: Supplier[] = Array.isArray(supplierLookup.data)
    ? supplierLookup.data
    : [];
  const products = Array.isArray(productLookup.data) ? productLookup.data : [];

  // Sales Orders pattern: dropdown = useWarehouses list (API already scopes non-admins)
  const warehousesFromQuery = useMemo<Warehouse[]>(() => {
    const fromQuery = (whRows ?? [])
      .map((w) => {
        const r = w as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          code: String(r.code ?? r.name ?? r.id ?? ""),
          name: r.name != null ? String(r.name) : undefined,
        };
      })
      .filter((w) => !!w.id)
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    if (fromQuery.length > 0) return fromQuery;
    return [];
  }, [whRows]);


  const whBusy =
    whLoading || whFetching || supplierLookup.isFetching || productLookup.isFetching;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<PoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const orders = useMemo(() => {
    return (poRows as PurchaseOrder[]).map((row) => {
      const r = row as PurchaseOrder & Record<string, unknown>;
      const lines = extractLines(r);
      return {
        ...row,
        lines: lines.length ? lines : row.lines,
        order_items: lines.length ? lines : row.order_items,
      };
    });
  }, [poRows]);

  // Sales Orders: keep filter default "all"


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

  const statsView = poStats;
  const total = poMeta.total;
  const lastPage = poMeta.last_page;
  const loading = poLoading;
  const error = poIsError
    ? poError instanceof Error
      ? poError.message
      : "Unable to load purchase orders."
    : null;

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id) ?? null;

  const filteredProducts = products.filter((product) => {
    if (!productQuery.trim()) return true;
    const query = productQuery.trim().toLowerCase();
    return product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
  });

  /** Open modal immediately — warehouses from useWarehouses (shared cache). */
  const openAdd = (prefill?: Partial<PoForm>) => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create purchase orders.");
      return;
    }

    setFormError(null);
    setProductQuery("");

    const whs = warehousesFromQuery;
    const sups = suppliers;

    const supplierId = prefill?.supplier_id ?? sups[0]?.id ?? "";
    const warehouseId = prefill?.warehouse_id ?? whs[0]?.id ?? "";

    setForm({
      ...emptyForm(),
      ...prefill,
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      lines:
        prefill?.lines && prefill.lines.length > 0
          ? prefill.lines
          : [emptyLine()],
    });
    setShowAdd(true);

    // Warehouse, supplier, and product lookups are shared through React Query.
    if (whs.length === 0) {
      void refetchWarehouses().then(({ data }) => {
        const firstWarehouse = extractList<Record<string, unknown>>(data).find(
          (warehouse) => warehouse.id
        );
        if (firstWarehouse?.id) {
          setForm((current) => current.warehouse_id
            ? current
            : { ...current, warehouse_id: String(firstWarehouse.id) });
        }
      });
    }

    const needMeta = sups.length === 0 || products.length === 0;

    if (needMeta) {
      void Promise.all([supplierLookup.refetch(), productLookup.refetch()]).then(
        ([supplierResult, productResult]) => {
          const nextSup = supplierResult.data ?? sups;
          if (supplierResult.isError || productResult.isError) {
            setFormError("Could not load suppliers or products. Try refreshing the page.");
          }
          setForm((f) => {
            const sid = f.supplier_id || nextSup[0]?.id || "";
            const needLines =
              !f.lines.length ||
              (f.lines.length === 1 && !f.lines[0].product_id);
            return {
              ...f,
              supplier_id: sid,
              warehouse_id: f.warehouse_id || warehousesFromQuery[0]?.id || "",
              lines: needLines ? [emptyLine()] : f.lines,
            };
          });
        }
      );
    }
  };

  /** When supplier changes, clear lines so each item is explicitly selected from the catalog. */
  const onSupplierChange = (supplierId: string) => {
    setProductQuery("");
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      lines: [emptyLine()],
    }));
  };

  const duplicateOrder = (order: PurchaseOrder) => {
    const linesSrc = order.lines ?? order.order_items ?? [];
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
      warehouse_id:
        order.warehouse_id ?? order.warehouse?.id ?? warehousesFromQuery[0]?.id ?? "",
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

  /** Select a catalog product for a purchase-order line. */
  const onProductChange = (key: string, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    setLine(key, {
      offer: product ? `${product.sku} — ${product.name}` : "",
      product_id: productId,
      unit_price: product ? String(Number(product.price) || 0) : "",
    });
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
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

    if (warehousesFromQuery.length > 0 && !form.warehouse_id) {
      setFormError("Select a warehouse for receiving.");
      return;
    }

    if (products.length === 0) {
      setFormError(
        "No catalog products are available. Add products to the catalog before creating a purchase order."
      );
      return;
    }

    if (form.lines.some((line) => !line.product_id)) {
      setFormError("Choose a catalog product for every purchase order line.");
      return;
    }
    if (form.lines.some((line) => !line.qty.trim() || Number(line.qty) <= 0)) {
      setFormError("Enter a quantity greater than zero for every purchase order line.");
      return;
    }

    const validLines = form.lines;

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
      lines: validLines.map((line) => ({
        product_id: line.product_id,
        product_name: line.offer.trim(),
        qty: Number(line.qty),
        unit_price: Number(line.unit_price) || 0,
      })),
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
          warehousesFromQuery.find((w) => w.id === form.warehouse_id) ??
          null,
        lines: createdLines,
        order_items: createdLines,
      };

      setShowAdd(false);
      showToast(
        "success",
        "PO created",
        `${created.po_number} · ${primaryOffer}${validLines.length > 1 ? ` +${validLines.length - 1}` : ""} · ${formatPeso(orderTotal)}`
      );
      setPage(1);
      await invalidatePurchaseOrders();
      setViewOrder(created);
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
    const updated: PurchaseOrder = { ...order, status: nextStatus };

    setUpdatingId(order.id);
    setMenuOpenId(null);
    setConfirmAction(null);
    if (viewOrder?.id === order.id) setViewOrder(updated);

    try {
      const { data: body } = await api.put(`/purchase-orders/${order.id}`, {
        status: nextStatus,
      });
      await invalidatePurchaseOrders();
      // Merge server payload when present
      const serverOrder: PurchaseOrder | null =
        body?.data && typeof body.data === "object"
          ? { ...updated, ...body.data }
          : body?.id
            ? { ...updated, ...body }
            : null;

      if (serverOrder && viewOrder?.id === order.id) {
        setViewOrder((v) => (v ? { ...v, ...serverOrder } : v));
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

    } catch (err) {
      if (viewOrder?.id === order.id) setViewOrder(order);
      showToast(
        "error",
        "Update failed",
        err instanceof Error ? err.message : "Could not update status."
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
    // Prefer line data returned by the list endpoint while the detail loads.
    const existingLines = extractLines(order as unknown as Record<string, unknown>);
    const seedLines =
      existingLines.length > 0
        ? existingLines
        : order.lines?.length
          ? order.lines
          : order.order_items?.length
            ? order.order_items
            : [];

    setViewOrder({
      ...order,
      lines: seedLines.length ? seedLines : order.lines,
      order_items: seedLines.length ? seedLines : order.order_items,
    });
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
        const lines = enrichLines(rawLines, catalog);
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
            : [];
        const lines = enrichLines(raw, catalog);
        setViewOrder({ ...order, lines, order_items: lines });
      }
    } catch {
      const raw =
        extractLines(order as unknown as Record<string, unknown>).length > 0
          ? extractLines(order as unknown as Record<string, unknown>)
          : [];
      const lines = enrichLines(raw, catalog);
      setViewOrder({ ...order, lines, order_items: lines });
    }
  };

  return (
    <div className="orders-page purchase-orders-page">
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
          <div className="page-header purchase-orders-header">
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
                  void Promise.all([supplierLookup.refetch(), productLookup.refetch()]);
                  showToast("success", "Refreshed", "Orders and suppliers reloaded.");
                }}
                disabled={
                  poFetching ||
                  loading ||
                  supplierLookup.isFetching ||
                  productLookup.isFetching
                }
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

          <div className="stats-grid purchase-orders-stats">
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

          <div className="card purchase-orders-card">
            <div className="table-toolbar purchase-orders-toolbar">
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
                >
                  <option value="all">All sites</option>
                  {warehousesFromQuery.map((w) => (
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
                  {loading && orders.length === 0 ? (
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
                  ) : orders.length === 0 ? (
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
                    orders.map((o) => {
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
                          Pick a supplier, then choose catalog products for each line · totals in ₱
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
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {suppliers.length === 0 && (
                    <span className="po-field-hint">No suppliers loaded — check Suppliers API</span>
                  )}
                </div>

                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Warehouse {warehousesFromQuery.length > 0 ? "*" : ""}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={form.warehouse_id}
                      onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                      disabled={saving || whBusy}
                      style={{ flex: 1 }}
                      required={warehousesFromQuery.length > 0}
                    >
                      {warehousesFromQuery.length === 0 ? (
                        <option value="">
                          {whBusy ? "Loading warehouses…" : "— No warehouses —"}
                        </option>
                      ) : (
                        <>
                          <option value="">— Select warehouse —</option>
                          {warehousesFromQuery.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name ? `${w.code} — ${w.name}` : w.code}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {warehousesFromQuery.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={whBusy || saving}
                        onClick={() => void refetchWarehouses()}
                        title="Reload warehouses"
                      >
                        {whBusy ? "…" : "Retry"}
                      </button>
                    )}
                  </div>
                  {warehousesFromQuery.length === 0 && !whBusy && (
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

              {/* Purchase-order lines always select products from the catalog. */}
              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Catalog products</span>
                    <span className="po-lines-hint">
                      Select a catalog product for every purchase order line
                    </span>
                  </div>
                  <div className="po-lines-toolbar">
                    {products.length > 4 && (
                      <input
                        type="text"
                        className="po-product-filter"
                        placeholder="Search SKU or product…"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        disabled={saving || productLookup.isLoading}
                      />
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addLine}
                      disabled={saving || !form.supplier_id || products.length === 0}
                    >
                      <IconPlus /> Add line
                    </button>
                  </div>
                </div>

                {productLookup.isLoading ? (
                  <p className="po-lines-empty po-lines-soft">
                    Loading catalog products…
                  </p>
                ) : products.length === 0 ? (
                  <p className="po-lines-empty po-lines-soft">
                    No catalog products are available. Add products to the catalog first.
                  </p>
                ) : null}

                {products.length > 0 && filteredProducts.length === 0 && (
                  <p className="po-lines-empty po-lines-soft">No catalog products match your search.</p>
                )}

                <div className="po-lines-list">
                  {form.lines.map((line, idx) => {
                    const selectedProduct = products.find((product) => product.id === line.product_id);
                    return (
                      <div key={line.key} className="po-line-row">
                        <div className="form-field po-line-product">
                          {idx === 0 && <label>Catalog product *</label>}
                          <select
                            value={line.product_id}
                            onChange={(e) => onProductChange(line.key, e.target.value)}
                            disabled={saving || !form.supplier_id || products.length === 0}
                            required
                          >
                            <option value="">— Choose a catalog product —</option>
                            {selectedProduct && !filteredProducts.some((product) => product.id === selectedProduct.id) && (
                              <option value={selectedProduct.id}>
                                {selectedProduct.sku} — {selectedProduct.name}
                              </option>
                            )}
                            {filteredProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.sku} — {product.name}
                              </option>
                            ))}
                          </select>
                          {selectedProduct && (
                            <span className="po-line-meta po-offer-match">
                              Catalog SKU: {selectedProduct.sku}
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
                      {form.lines.filter((l) => l.product_id).length} line
                      {form.lines.filter((l) => l.product_id).length === 1 ? "" : "s"}
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
                    productLookup.isLoading ||
                    products.length === 0
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
        const rawLines =
          extractLines(viewOrder as unknown as Record<string, unknown>);
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
                    {rootQty.toLocaleString() || Number(viewOrder.items).toLocaleString()}
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
          <button type="button" className="feedback-close" onClick={() => setToast(null)} aria-label="Close notification">×</button>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default PurchaseOrders;