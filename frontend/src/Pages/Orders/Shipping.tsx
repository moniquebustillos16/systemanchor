import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useWarehouses } from "../../hooks/useWarehouses";
import { useShipments } from "../../hooks/useOrders";
import { invalidateShipments } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Orders.css";

/* ── Types ─────────────────────────────────────────────────── */
 

type Customer = { id: string; name: string };
type Warehouse = { id: string; code: string; name?: string };
type ProductOpt = {
  id: string;
  sku: string;
  name: string;
  price?: number | string;
  qty?: number | string;
  status?: string;
};

type SoLine = {
  product_id?: string;
  product_name?: string | null;
  name?: string | null;
  qty?: number | string;
  unit_price?: number | string;
};

type SalesOrder = {
  id: string;
  so_number: string;
  customer_id?: string | null;
  warehouse_id?: string | null;
  items?: number;
  status?: string;
  customer?: Customer | null;
  warehouse?: Warehouse | null;
  lines?: SoLine[];
};

type Shipment = {
  id: string;
  shipment_number: string;
  sales_order_id: string | null;
  carrier: string;
  tracking: string | null;
  warehouse_id: string | null;
  packages: number;
  date: string;
  status: string;
  sales_order?: SalesOrder | null;
  warehouse?: Warehouse | null;
};

type ShipLine = {
  key: string;
  product_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};

type ShipForm = {
  sales_order_id: string;
  warehouse_id: string;
  carrier: string;
  tracking: string;
  packages: string;
  date: string;
  status: string;
  lines: ShipLine[];
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const CARRIERS = [
  "LBC Express",
  "J&T Express",
  "JRS Express",
  "Ninja Van",
  "Grab Express",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_SIZE = 15;

let lineKeySeq = 0;
const newLineKey = () => `ship-line-${Date.now()}-${++lineKeySeq}`;

const emptyLine = (): ShipLine => ({
  key: newLineKey(),
  product_id: "",
  product_name: "",
  qty: "1",
  unit_price: "0",
});

const emptyForm = (): ShipForm => ({
  sales_order_id: "",
  warehouse_id: "",
  carrier: CARRIERS[0],
  tracking: "",
  packages: "1",
  date: new Date().toISOString().slice(0, 10),
  status: "processing",
  lines: [emptyLine()],
});

/* ── Permission helpers ────────────────────────────────────── */
/* ── Domain helpers ────────────────────────────────────────── */
function getItems(json: unknown): unknown[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  const o = json as Record<string, unknown>;

  if (Array.isArray(o.data)) return o.data as unknown[];
  if (Array.isArray(o.items)) return o.items as unknown[];
  if (Array.isArray(o.results)) return o.results as unknown[];
  if (Array.isArray(o.rows)) return o.rows as unknown[];

  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data)) return n.data as unknown[];
    if (Array.isArray(n.items)) return n.items as unknown[];
    if (Array.isArray(n.results)) return n.results as unknown[];
    if (Array.isArray(n.rows)) return n.rows as unknown[];
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
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
    return d.slice(0, 10);
  }
}

function readCachedSoLines(soNumber: string): SoLine[] {
  try {
    const raw = localStorage.getItem(`sa-so-lines:${soNumber}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ── Icons ─────────────────────────────────────────────────── */
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
  <svg {...svg} width="16" height="16">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
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

/* ── Component ─────────────────────────────────────────────── */
function Shipping() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [formWarehouses, setFormWarehouses] = useState<Warehouse[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ShipForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { rows: whRows, refetch: refetchWarehouses } = useWarehouses({
    enabled: true,
  });

  const warehouses: Warehouse[] = useMemo(
    () =>
      (whRows ?? [])
        .map((w) => {
          const row = asRecord(w);
          return {
            id: String(row.id ?? ""),
            code: String(row.code ?? row.name ?? row.id ?? ""),
            name: row.name != null ? String(row.name) : undefined,
          };
        })
        .filter((w) => w.id),
    [whRows]
  );

  const warehouseOptions =
    formWarehouses.length > 0 ? formWarehouses : warehouses;

  const {
    rows: shipRows,
    meta,
    stats,
    isLoading: loading,
    isFetching,
    isError,
    error: queryError,
    refetchAll,
  } = useShipments({
    page,
    perPage: PAGE_SIZE,
    search: debouncedSearch,
    status,
    enabled: true,
  });

  const rows = shipRows as unknown as Shipment[];
  const total = meta.total;
  const lastPage = meta.last_page;
  const error = isError
    ? (queryError as Error)?.message ?? "Failed to load shipments"
    : null;

  const showToast = useCallback(
    (type: ToastState["type"], title: string, msg: string) => {
      setToast({ type, title, msg });
      window.setTimeout(() => setToast(null), 3200);
    },
    []
  );

  /* ── Permissions ─────────────────────────────────────────── */
  const { can, isLoaded: permsLoaded } = usePermissions();


  const canView = can("shipping.view", "shipments.view");
  const canCreate = can("shipping.create", "shipments.create");
  const canUpdate = can("shipping.update", "shipments.update");

  /* ── Debounced search ────────────────────────────────────── */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => window.clearTimeout(t);
  }, [search]);

  /* ── Lookups: SO + products + warehouses (for create form) ─ */
  const loadLookups = useCallback(async () => {
    try {
      const [soRes, prodRes, whRes] = await Promise.all([
        api.get("/sales-orders", { params: { per_page: 200, all: 1 } }),
        api.get("/products", { params: { per_page: 200 } }),
        api.get("/warehouses", { params: { per_page: 200, all: 1 } }),
      ]);

      const soList: SalesOrder[] = getItems(soRes.data).map((item) => {
        const row = asRecord(item);
        const soNumber = String(row.so_number ?? row.number ?? row.id);
        const cached = readCachedSoLines(soNumber);
        const customer = asRecord(row.customer);
        const warehouse = asRecord(row.warehouse);

        return {
          id: String(row.id),
          so_number: soNumber,
          customer_id:
            row.customer_id != null
              ? String(row.customer_id)
              : customer.id != null
                ? String(customer.id)
                : null,
          warehouse_id:
            row.warehouse_id != null
              ? String(row.warehouse_id)
              : warehouse.id != null
                ? String(warehouse.id)
                : null,
          items: Number(row.items ?? 0) || undefined,
          status: row.status != null ? String(row.status) : undefined,
          customer:
            customer.id != null
              ? {
                  id: String(customer.id),
                  name: String(customer.name ?? ""),
                }
              : null,
          warehouse:
            warehouse.id != null
              ? {
                  id: String(warehouse.id),
                  code: String(
                    warehouse.code ?? warehouse.name ?? warehouse.id
                  ),
                  name:
                    warehouse.name != null
                      ? String(warehouse.name)
                      : undefined,
                }
              : null,
          lines:
            Array.isArray(row.lines) && (row.lines as SoLine[]).length > 0
              ? (row.lines as SoLine[])
              : cached.length
                ? cached
                : [],
        };
      });

      const prodList: ProductOpt[] = getItems(prodRes.data)
        .map((p) => {
          const row = asRecord(p);
          return {
            id: String(row.id),
            sku: String(row.sku ?? ""),
            name: String(row.name ?? ""),
            price: row.price as number | string | undefined,
            qty: row.qty as number | string | undefined,
            status: row.status != null ? String(row.status) : undefined,
          };
        })
        .filter((p) => !p.status || p.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name));

      const whList: Warehouse[] = getItems(whRes.data)
        .map((w) => {
          const row = asRecord(w);
          return {
            id: String(row.id ?? ""),
            code: String(row.code ?? row.name ?? row.id ?? ""),
            name: row.name != null ? String(row.name) : undefined,
          };
        })
        .filter((w) => w.id);

      setSalesOrders(soList);
      setProducts(prodList);
      setFormWarehouses(whList);

      return { soList, prodList, whList };
    } catch (e) {
      console.error("[Shipping] lookups failed:", e);
      showToast("error", "Lookups failed", "Could not load form options.");
      return {
        soList: [] as SalesOrder[],
        prodList: [] as ProductOpt[],
        whList: [] as Warehouse[],
      };
    }
  }, [showToast]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  /* ── Product / SO helpers ────────────────────────────────── */
  const resolveProduct = (ln: SoLine): ProductOpt | undefined => {
    if (ln.product_id) {
      const byId = products.find((p) => p.id === String(ln.product_id));
      if (byId) return byId;
    }
    const label = (ln.product_name || ln.name || "").trim().toLowerCase();
    if (!label) return undefined;
    return products.find(
      (p) =>
        p.name.toLowerCase() === label ||
        p.sku.toLowerCase() === label ||
        p.name.toLowerCase().includes(label) ||
        label.includes(p.name.toLowerCase())
    );
  };

  const soToShipLines = (so: SalesOrder | undefined): ShipLine[] => {
    if (!so) return [emptyLine()];

    const sourceLines =
      so.lines && so.lines.length > 0
        ? so.lines
        : readCachedSoLines(so.so_number);

    if (sourceLines.length === 0) {
      return [
        {
          ...emptyLine(),
          qty: String(Math.max(1, Number(so.items) || 1)),
        },
      ];
    }

    return sourceLines.map((ln) => {
      const matched = resolveProduct(ln);
      const qty = Math.max(1, Number(ln.qty) || 1);
      const stock =
        matched?.qty != null
          ? Math.max(0, Math.floor(Number(matched.qty) || 0))
          : null;
      const safeQty =
        stock !== null ? Math.min(qty, Math.max(1, stock || 1)) : qty;
      const price =
        matched != null
          ? Number(matched.price) || Number(ln.unit_price) || 0
          : Number(ln.unit_price) || 0;

      return {
        key: newLineKey(),
        product_id: matched?.id ?? (ln.product_id ? String(ln.product_id) : ""),
        product_name: matched?.name ?? ln.product_name ?? ln.name ?? "Product",
        qty: String(stock === 0 ? 0 : safeQty),
        unit_price: String(price),
      };
    });
  };

 

  const shippableOrders = salesOrders.filter(
    (s) =>
      !s.status ||
      !["cancelled", "completed"].includes(String(s.status).toLowerCase())
  );
  const soOptions = shippableOrders.length > 0 ? shippableOrders : salesOrders;

  const openAdd = async () => {
    if (!canCreate) {
      showToast(
        "error",
        "Permission denied",
        "You cannot create records on this page."
      );
      return;
    }

    setFormError(null);
    setShowAdd(true);

    const { soList, whList } = await loadLookups();
    void refetchWarehouses();

    const shippable = soList.filter(
      (s) =>
        !s.status ||
        !["cancelled", "completed"].includes(String(s.status).toLowerCase())
    );
    const options = shippable.length > 0 ? shippable : soList;
    const first = options[0];

    if (first) {
      setForm({
        ...emptyForm(),
        sales_order_id: first.id,
        warehouse_id:
          first.warehouse_id ??
          first.warehouse?.id ??
          whList[0]?.id ??
          "",
        lines: soToShipLines(first),
      });
    } else {
      setForm({
        ...emptyForm(),
        warehouse_id: whList[0]?.id ?? "",
      });
    }
  };

  const onSoChange = (soId: string) => {
    const so = salesOrders.find((s) => s.id === soId);
    setForm((f) => ({
      ...f,
      sales_order_id: soId,
      warehouse_id:
        so?.warehouse_id ?? so?.warehouse?.id ?? f.warehouse_id,
      lines: soToShipLines(so),
    }));
  };

  const selectedSo = salesOrders.find((s) => s.id === form.sales_order_id);

  const setLine = (key: string, patch: Partial<ShipLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };

  const stockOf = (productId: string): number | null => {
    const p = products.find((x) => x.id === productId);
    if (!p || p.qty == null || p.qty === "") return null;
    const n = Number(p.qty);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  };

  const onProductChange = (key: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    const stock =
      p?.qty != null ? Math.max(0, Math.floor(Number(p.qty) || 0)) : null;
    const currentQty = Number(form.lines.find((l) => l.key === key)?.qty) || 1;
    const safeQty =
      stock !== null
        ? Math.min(Math.max(1, currentQty), Math.max(1, stock || 1))
        : currentQty;
    setLine(key, {
      product_id: productId,
      product_name: p?.name ?? "",
      unit_price: p ? String(Number(p.price) || 0) : "0",
      qty: String(stock === 0 ? 0 : safeQty),
    });
  };

  const onQtyChange = (key: string, raw: string) => {
    const line = form.lines.find((l) => l.key === key);
    if (!line) return;
    let qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) qty = 0;
    qty = Math.floor(qty);
    const stock = line.product_id ? stockOf(line.product_id) : null;
    if (stock !== null && qty > stock) qty = stock;
    setLine(key, { qty: String(qty) });
  };

  const lineStockError = (line: ShipLine): string | null => {
    if (!line.product_id) return null;
    const stock = stockOf(line.product_id);
    if (stock === null) return null;
    const qty = Number(line.qty) || 0;
    if (stock <= 0) return "Out of stock";
    if (qty > stock) return `Only ${stock.toLocaleString()} in stock`;
    return null;
  };

  const addLine = () =>
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (key: string) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((l) => l.key !== key),
    }));

  const unitsOnForm = form.lines.reduce(
    (s, l) => s + (Number(l.qty) || 0),
    0
  );

  /* ── Create shipment ─────────────────────────────────────── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.sales_order_id) {
      setFormError("Sales order is required.");
      return;
    }
    if (!form.carrier) {
      setFormError("Carrier is required.");
      return;
    }

    const shipLines = form.lines.filter(
      (l) => l.product_id && l.product_name.trim() && Number(l.qty) > 0
    );
    if (shipLines.length === 0) {
      setFormError(
        "Select at least one product with quantity greater than zero."
      );
      return;
    }

    for (const line of shipLines) {
      const stock = stockOf(line.product_id);
      const qty = Number(line.qty) || 0;
      if (stock !== null) {
        if (stock <= 0) {
          setFormError(`“${line.product_name}” is out of stock.`);
          return;
        }
        if (qty > stock) {
          setFormError(
            `“${line.product_name}” — requested ${qty.toLocaleString()}, only ${stock.toLocaleString()} in stock.`
          );
          return;
        }
      }
    }

    const so = salesOrders.find((s) => s.id === form.sales_order_id);
    const pkgs = Math.max(1, parseInt(form.packages, 10) || 1);

    setSaving(true);
    try {
      const { data: body } = await api.post("/shipments", {
        sales_order_id: form.sales_order_id,
        warehouse_id: form.warehouse_id || null,
        carrier: form.carrier,
        tracking: form.tracking.trim() || null,
        packages: pkgs,
        date: form.date || null,
        status: form.status || "processing",
      });

      const data = (body.data ?? body) as Record<string, unknown>;
      const shipId = String(data.id ?? "");
      const shipNumber = String(
        data.shipment_number ?? `SH-${Date.now().toString().slice(-6)}`
      );

      const customerId = so?.customer_id ?? so?.customer?.id ?? null;
      await Promise.all(
        shipLines.map(async (l) => {
          try {
            await api.post("/product-transactions", {
              product_id:
                l.product_id && UUID_RE.test(l.product_id)
                  ? l.product_id
                  : null,
              product_name: l.product_name.trim(),
              transaction_type: "shipment",
              reference_id:
                shipId && UUID_RE.test(shipId) ? shipId : null,
              reference_number: shipNumber,
              partner_id:
                customerId && UUID_RE.test(customerId) ? customerId : null,
              partner_type: "customer",
              quantity: Number(l.qty) || 0,
              unit_price: Number(l.unit_price) || 0,
              status: form.status || "processing",
            });
          } catch {
            /* non-blocking */
          }
        })
      );

      setShowAdd(false);
      showToast(
        "success",
        "Shipment created",
        `${shipNumber} · ${so?.so_number ?? "SO"} · ${pkgs} pkg`
      );
      setPage(1);
      await invalidateShipments();
      await refetchAll();
      void loadLookups();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: any } })?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        (err as Error)?.message ||
        "Failed to create shipment";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  /* ── Mark delivered ──────────────────────────────────────── */
  const markDelivered = async (id: string, number: string) => {
    if (!canUpdate) {
      showToast(
        "error",
        "Permission denied",
        "You cannot update shipments."
      );
      return;
    }
    setDeliveringId(id);
    try {
      await api.post(`/shipments/${id}/deliver`);
      showToast("success", "Delivered", `${number} marked delivered.`);
      await invalidateShipments();
      await refetchAll();
    } catch (err) {
      showToast(
        "error",
        "Update failed",
        err instanceof Error ? err.message : "Could not mark delivered"
      );
    } finally {
      setDeliveringId(null);
    }
  };

  const handleRefresh = () => {
    void refetchAll();
    void loadLookups();
    void refetchWarehouses();
    showToast("success", "Refreshed", "Shipments reloaded.");
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="orders-page">
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
                You do not have permission to view this page. Ask an admin to
                grant <code>shipping.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Shipping</h1>
              <p className="page-subtitle">
                Link SO · pack lines · shipment transactions · carriers
                {isFetching && !loading ? " · refreshing…" : ""}
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                <IconRefresh /> Refresh
              </button>
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void openAdd()}
                >
                  <IconPlus /> New Shipment
                </button>
              )}
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

          {canView && (
            <>
              <div className="stats-grid">
                <button
                  type="button"
                  className={`stat-card${status === "all" ? " is-active" : ""}`}
                  style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
                  onClick={() => {
                    setStatus("all");
                    setPage(1);
                  }}
                >
                  <div className="stat-label">Shipments</div>
                  <div className="stat-value">
                    {loading ? "…" : stats.all.toLocaleString()}
                  </div>
                  <div className="stat-hint">All documents</div>
                </button>
                <button
                  type="button"
                  className={`stat-card${
                    status === "processing" || status === "shipped"
                      ? " is-active"
                      : ""
                  }`}
                  style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
                  onClick={() => {
                    setStatus(status === "processing" ? "all" : "processing");
                    setPage(1);
                  }}
                >
                  <div className="stat-label">Open</div>
                  <div className="stat-value warning">
                    {loading ? "…" : stats.open.toLocaleString()}
                  </div>
                  <div className="stat-hint">In progress</div>
                </button>
                <button
                  type="button"
                  className={`stat-card${
                    status === "completed" ? " is-active" : ""
                  }`}
                  style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
                  onClick={() => {
                    setStatus(status === "completed" ? "all" : "completed");
                    setPage(1);
                  }}
                >
                  <div className="stat-label">Delivered</div>
                  <div className="stat-value success">
                    {loading ? "…" : stats.delivered.toLocaleString()}
                  </div>
                  <div className="stat-hint">Completed</div>
                </button>
                <div className="stat-card">
                  <div className="stat-label">Packages</div>
                  <div className="stat-value">
                    {loading ? "…" : stats.packages.toLocaleString()}
                  </div>
                  <div className="stat-hint">Total packs</div>
                </div>
              </div>

              <div className="card">
                <div className="table-toolbar">
                  <div className="table-search">
                    <IconSearch />
                    <input
                      type="text"
                      placeholder="Search shipment, SO, carrier, tracking…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search shipments"
                    />
                  </div>
                  <div className="table-filters">
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                      aria-label="Filter by status"
                    >
                      <option value="all">All status</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Shipment</th>
                        <th>SO</th>
                        <th>Customer</th>
                        <th>Carrier</th>
                        <th>Tracking</th>
                        <th>Warehouse</th>
                        <th>Packages</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={`skel-${i}`}>
                            {Array.from({ length: 10 }).map((__, j) => (
                              <td key={j}>
                                <div
                                  className="skel"
                                  style={{
                                    width: j === 0 ? 110 : 56,
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
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="empty-row">
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
                              <p style={{ margin: 0, fontWeight: 550 }}>
                                No shipments match your filters
                              </p>
                              {canCreate && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => void openAdd()}
                                >
                                  <IconPlus /> New Shipment
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const canDeliver =
                            r.status !== "completed" &&
                            r.status !== "cancelled";
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="product-cell">
                                  <div
                                    className="product-avatar"
                                    style={{
                                      background: "rgba(196, 160, 122, 0.14)",
                                      color: "var(--sa-brown)",
                                    }}
                                  >
                                    <IconTruck />
                                  </div>
                                  <div>
                                    <div className="product-name">
                                      {r.shipment_number}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="fw-600">
                                {r.sales_order?.so_number ?? "—"}
                              </td>
                              <td>
                                {r.sales_order?.customer?.name ?? "—"}
                              </td>
                              <td>{r.carrier}</td>
                              <td>
                                <code className="track-code">
                                  {r.tracking || "—"}
                                </code>
                              </td>
                              <td>{r.warehouse?.code ?? "—"}</td>
                              <td className="fw-600">{r.packages}</td>
                              <td className="text-muted">
                                {formatDateLong(r.date)}
                              </td>
                              <td>
                                <span
                                  className={`status-badge status-${r.status}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td>
                                {canDeliver && canUpdate ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={deliveringId === r.id}
                                    onClick={() =>
                                      void markDelivered(
                                        r.id,
                                        r.shipment_number
                                      )
                                    }
                                  >
                                    {deliveringId === r.id
                                      ? "…"
                                      : "Mark Delivered"}
                                  </button>
                                ) : canDeliver && !canUpdate ? (
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: 12 }}
                                  >
                                    No permission
                                  </span>
                                ) : (
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: 12 }}
                                  >
                                    Closed
                                  </span>
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
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => p - 1)}
                    >
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

      {showAdd && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setShowAdd(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflow: "auto",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ship-create-title"
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
                  id="ship-create-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  New Shipment
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  Link a sales order · pack lines · shipment transactions
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAdd(false)}
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

            <form onSubmit={handleAdd}>
              <div className="form-grid-2">
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="ship-so">Sales Order *</label>
                  <select
                    id="ship-so"
                    required
                    value={form.sales_order_id}
                    onChange={(e) => onSoChange(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">— Select SO —</option>
                    {soOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.so_number}
                        {o.customer?.name ? ` · ${o.customer.name}` : ""}
                        {o.items != null ? ` · ${o.items} units` : ""}
                        {o.status ? ` (${o.status})` : ""}
                      </option>
                    ))}
                  </select>
                  {salesOrders.length === 0 && (
                    <span className="po-field-hint">
                      No sales orders found. Create an SO first.
                    </span>
                  )}
                  {selectedSo && (
                    <div className="so-link-summary">
                      <span>
                        <strong>{selectedSo.so_number}</strong>
                        {selectedSo.customer?.name
                          ? ` · ${selectedSo.customer.name}`
                          : ""}
                      </span>
                      <span className="so-link-meta">
                        {selectedSo.warehouse?.code
                          ? `WH ${selectedSo.warehouse.code}`
                          : "No warehouse"}
                        {selectedSo.items != null
                          ? ` · ${Number(selectedSo.items).toLocaleString()} ordered`
                          : ""}
                        {selectedSo.status ? ` · ${selectedSo.status}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="ship-wh">Warehouse</label>
                  <select
                    id="ship-wh"
                    value={form.warehouse_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, warehouse_id: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="">— None —</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name ? `${w.code} — ${w.name}` : w.code}
                      </option>
                    ))}
                  </select>
                  {warehouseOptions.length === 0 && (
                    <span className="po-field-hint">
                      No warehouses loaded.
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="ship-carrier">Carrier *</label>
                  <select
                    id="ship-carrier"
                    required
                    value={form.carrier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carrier: e.target.value }))
                    }
                    disabled={saving}
                  >
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="ship-tracking">Tracking No.</label>
                  <input
                    id="ship-tracking"
                    type="text"
                    placeholder="Auto or enter"
                    value={form.tracking}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tracking: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="ship-packages">Packages</label>
                  <input
                    id="ship-packages"
                    type="number"
                    min={1}
                    value={form.packages}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, packages: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="ship-date">Date</label>
                  <input
                    id="ship-date"
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="ship-status">Status</label>
                  <select
                    id="ship-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Products to ship</span>
                    <span className="po-lines-hint">
                      From product catalog · qty checked against stock ·
                      shipment transactions
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addLine}
                    disabled={saving || products.length === 0}
                  >
                    <IconPlus /> Add line
                  </button>
                </div>

                {products.length === 0 && (
                  <p className="po-lines-empty po-lines-soft">
                    No products loaded. Add products in the Products page first.
                  </p>
                )}

                <div className="po-lines-list">
                  {form.lines.map((line, idx) => {
                    const selected = products.find(
                      (p) => p.id === line.product_id
                    );
                    const stock = line.product_id
                      ? stockOf(line.product_id)
                      : null;
                    const stockErr = lineStockError(line);
                    const maxAttr =
                      stock !== null ? Math.max(0, stock) : undefined;
                    const stockClass =
                      stock === null
                        ? ""
                        : stock <= 0
                          ? "so-stock-out"
                          : stockErr
                            ? "so-stock-warn"
                            : "so-stock-ok";

                    return (
                      <div
                        key={line.key}
                        className={`po-line-row${stockErr ? " so-line-invalid" : ""}`}
                      >
                        <div className="form-field po-line-product">
                          {idx === 0 && <label>Product *</label>}
                          <select
                            value={line.product_id}
                            onChange={(e) =>
                              onProductChange(line.key, e.target.value)
                            }
                            disabled={saving || products.length === 0}
                            required
                          >
                            <option value="">— Select product —</option>
                            {products.map((p) => {
                              const usedElsewhere = form.lines.some(
                                (l) =>
                                  l.key !== line.key && l.product_id === p.id
                              );
                              const pStock =
                                p.qty != null
                                  ? Math.max(0, Math.floor(Number(p.qty) || 0))
                                  : null;
                              const out = pStock !== null && pStock <= 0;
                              return (
                                <option
                                  key={p.id}
                                  value={p.id}
                                  disabled={usedElsewhere || out}
                                >
                                  {p.sku ? `${p.sku} — ${p.name}` : p.name}
                                  {p.price != null
                                    ? ` · ₱${Number(p.price).toLocaleString()}`
                                    : ""}
                                  {pStock !== null
                                    ? out
                                      ? " · Out of stock"
                                      : ` · ${pStock} in stock`
                                    : ""}
                                </option>
                              );
                            })}
                          </select>
                          {selected && (
                            <div className={`so-stock-bar ${stockClass}`}>
                              <span className="so-stock-label">
                                {stock === null
                                  ? "Stock unknown"
                                  : stock <= 0
                                    ? "Out of stock"
                                    : `${stock.toLocaleString()} available`}
                              </span>
                              {selected.sku && (
                                <span className="so-stock-sku">
                                  {selected.sku}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="form-field po-line-qty">
                          {idx === 0 && <label>Qty *</label>}
                          <input
                            type="number"
                            min={stock === 0 ? 0 : 1}
                            max={maxAttr}
                            step="1"
                            value={line.qty}
                            onChange={(e) =>
                              onQtyChange(line.key, e.target.value)
                            }
                            disabled={
                              saving || (stock !== null && stock <= 0)
                            }
                            required={!(stock !== null && stock <= 0)}
                            className={stockErr ? "so-input-error" : undefined}
                          />
                          {stockErr && (
                            <span className="so-line-error">{stockErr}</span>
                          )}
                        </div>
                        <div className="form-field po-line-price">
                          {idx === 0 && <label>Unit ₱</label>}
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) =>
                              setLine(line.key, {
                                unit_price: e.target.value,
                              })
                            }
                            disabled={saving}
                          />
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
                    <div style={{ fontSize: 12, color: "var(--sa-muted)" }}>
                      Shipment summary
                    </div>
                    <span>
                      {
                        form.lines.filter((l) => l.product_id).length
                      }{" "}
                      line
                      {form.lines.filter((l) => l.product_id).length === 1
                        ? ""
                        : "s"}
                      {" · "}
                      {unitsOnForm.toLocaleString()} units · {form.packages} pkg
                      {form.lines.some((l) => lineStockError(l)) && (
                        <span className="so-footer-warn">
                          {" "}
                          · Fix stock issues
                        </span>
                      )}
                    </span>
                  </div>
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
                  onClick={() => setShowAdd(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    saving ||
                    salesOrders.length === 0 ||
                    products.length === 0 ||
                    form.lines.some((l) => !!lineStockError(l)) ||
                    form.lines.filter(
                      (l) => l.product_id && Number(l.qty) > 0
                    ).length === 0
                  }
                >
                  {saving ? "Creating…" : "Create Shipment"}
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

export default Shipping;