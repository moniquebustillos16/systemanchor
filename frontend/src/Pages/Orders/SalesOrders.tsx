import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useSalesOrders } from "../../hooks/useOrders";
import { useWarehouses } from "../../hooks/useWarehouses";
import { invalidateSalesOrders } from "../../lib/invalidate";
import { lookupKeys } from "../../lib/cachedLookups";
import { usePermissions } from "../../hooks/useCurrentUser";
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
  <svg {...svg} width="16" height="16">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

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
const EMPTY_CUSTOMERS: Customer[] = [];

type SoLine = {
  key: string;
  product_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};

type SoLineServer = {
  id?: string;
  product_id?: string;
  product_name?: string | null;
  name?: string | null;
  qty?: number | string;
  unit_price?: number | string;
  line_total?: number | string;
};

type SalesOrder = {
  id: string;
  so_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  order_date: string;
  items: number;
  total: number | string;
  status: string;
  notes?: string | null;
  reference?: string | null;
  customer?: Customer | null;
  warehouse?: Warehouse | null;
  lines?: SoLineServer[];
};

type SoForm = {
  customer_id: string;
  warehouse_id: string;
  order_date: string;
  status: string;
  notes: string;
  reference: string;
  lines: SoLine[];
};

let lineKeySeq = 0;
const newLineKey = () => `line-${Date.now()}-${++lineKeySeq}`;

const emptyLine = (): SoLine => ({
  key: newLineKey(),
  product_id: "",
  product_name: "",
  qty: "1",
  unit_price: "0",
});

const emptyForm = (): SoForm => ({
  customer_id: "",
  warehouse_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  status: "pending",
  notes: "",
  reference: "",
  lines: [emptyLine()],
});

function lineTotal(line: SoLine): number {
  return (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
}

function formTotals(lines: SoLine[]): { items: number; total: number } {
  const items = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  return { items, total };
}

function formatPeso(amount: number, fractionDigits = 0): string {
  return `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
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

function truncateText(s: string, max = 40): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function lineDisplayName(ln: SoLineServer): string {
  return ln.product_name || ln.name || "Product";
}

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const;

const WORKFLOW_STEPS = ["pending", "processing", "shipped", "completed"] as const;

function workflowIndex(status: string): number {
  return WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);
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
  if (Array.isArray(o.customers)) return o.customers as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  return [];
}

function SalesOrders() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wh, setWh] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const {
    rows: soRows,
    meta: soMeta,
    stats: soStats,
    isLoading: soLoading,
    isFetching: soFetching,
    isError: soIsError,
    error: soError,
    refetchAll: refetchSOs,
  } = useSalesOrders({
    page,
    perPage: pageSize,
    search: debouncedSearch,
    status,
    warehouseId: wh === "all" || !wh ? null : wh,
    enabled: true,
  });


  // Shared React Query cache (same key as prefetchAppData) — fast like SO list
  const {
    rows: warehouseRows,
    isLoading: warehousesLoading,
    isFetching: warehousesFetching,
    refetch: refetchWarehouses,
  } = useWarehouses({ enabled: true, perPage: 200 });

  const warehouses = useMemo<Warehouse[]>(() => {
    const fromQuery = (warehouseRows as Warehouse[])
      .map((w) => {
        const r = w as Warehouse & Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          code: String(r.code ?? r.name ?? r.id ?? ""),
          name: r.name != null ? String(r.name) : undefined,
        };
      })
      .filter((w) => !!w.id)
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    return fromQuery;
  }, [warehouseRows]);

  const customerLookup = useQuery({
    queryKey: lookupKeys.customers,
    queryFn: async () => {
      const { data } = await api.get("/customers", { params: { per_page: 100 } });
      return extractList<Customer>(data)
        .map((customer) => ({ id: String(customer.id), name: customer.name }))
        .filter((customer) => !!customer.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60_000,
  });
  const productLookup = useQuery({
    queryKey: [...lookupKeys.products, "sales-order-catalog"],
    queryFn: async () => {
      const { data } = await api.get("/inventories", {
        params: { per_page: 200, paginate: false },
      });
      return extractList<ProductOpt>(data)
        .map((product) => ({
          id: String(product.id),
          sku: product.sku,
          name: product.name,
          price: product.price,
          qty: product.qty,
          status: product.status,
        }))
        .filter((product) => !!product.id && (!product.status || product.status === "active"))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60_000,
  });
  const customers = customerLookup.data ?? EMPTY_CUSTOMERS;
  const products = Array.isArray(productLookup.data) ? productLookup.data : [];
  const metaLoading = customerLookup.isFetching || productLookup.isFetching;
  const whBusy = warehousesLoading || warehousesFetching || metaLoading;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<SoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();
    const canView = can("sales_orders.view",
    "sales-orders.view",
    "sales_order.view",
    "so.view",
    "orders.view"
  );
  const canCreate = can("sales_orders.create",
    "sales-orders.create",
    "sales_order.create",
    "so.create"
  );
  const canUpdate = can("sales_orders.update",
    "sales-orders.update",
    "sales_order.update",
    "so.update"
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const orders = soRows as SalesOrder[];
  const stats = soStats;
  const total = soMeta.total;
  const lastPage = soMeta.last_page;
  const loading = soLoading;
  const error = soIsError
    ? soError instanceof Error
      ? soError.message
      : "Unable to load sales orders."
    : null;

  useEffect(() => {
    document.body.classList.toggle("modal-open", showAdd || !!viewOrder);
    return () => document.body.classList.remove("modal-open");
  }, [showAdd, viewOrder]);

  const statsView = stats;

  /** Open modal immediately — never block on network. */
  const openAdd = () => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create sales orders.");
      return;
    }
    setFormError(null);
    setForm({
      ...emptyForm(),
      customer_id: customers[0]?.id ?? "",
      warehouse_id: warehouses[0]?.id ?? "",
    });
    setShowAdd(true);

    // Background only — does not delay the modal
    if (warehouses.length === 0) {
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
    if (customers.length === 0 || products.length === 0) {
      void Promise.all([customerLookup.refetch(), productLookup.refetch()]).then(
        ([customerResult, productResult]) => {
          if (customerResult.isError || productResult.isError) {
            setFormError("Could not load customers or products. Try refreshing the page.");
          }
          const firstCustomer = customerResult.data?.[0];
          if (firstCustomer) {
            setForm((current) => current.customer_id
              ? current
              : { ...current, customer_id: firstCustomer.id });
          }
        }
      );
    }
  };

  const setLine = (key: string, patch: Partial<SoLine>) => {
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

  const lineStockError = (line: SoLine): string | null => {
    if (!line.product_id) return null;
    const stock = stockOf(line.product_id);
    if (stock === null) return null;
    const qty = Number(line.qty) || 0;
    if (stock <= 0) return "Out of stock";
    if (qty > stock) return `Only ${stock.toLocaleString()} in stock`;
    return null;
  };

  /** Select product from ProductController catalog */
  const onProductChange = (key: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    const stock = p?.qty != null ? Math.max(0, Math.floor(Number(p.qty) || 0)) : null;
    const currentQty = Number(form.lines.find((l) => l.key === key)?.qty) || 1;
    const safeQty =
      stock !== null ? Math.min(Math.max(1, currentQty), Math.max(1, stock || 1)) : currentQty;
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

    if (!form.customer_id) {
      setFormError("Customer is required.");
      return;
    }

    if (warehouses.length > 0 && !form.warehouse_id) {
      setFormError("Select a warehouse for fulfillment.");
      return;
    }

    if (products.length === 0) {
      setFormError("No products available. Add products first.");
      return;
    }

    const validLines = form.lines.filter(
      (l) => l.product_id && l.product_name.trim() && Number(l.qty) > 0
    );
    if (validLines.length === 0) {
      setFormError("Select at least one product with quantity greater than zero.");
      return;
    }

    // Inventory stock validation
    for (const line of validLines) {
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

    const { items: itemsTotal, total: orderTotal } = formTotals(validLines);
    const primaryName = validLines[0].product_name.trim();

    const payload = {
      customer_id: form.customer_id,
      warehouse_id: form.warehouse_id || null,
      order_date: form.order_date || null,
      items: itemsTotal,
      total: orderTotal,
      lines: validLines.map((line) => ({
        product_id: line.product_id,
        product_name: line.product_name.trim(),
        qty: Number(line.qty),
        unit_price: Number(line.unit_price) || 0,
      })),
      status: form.status || "pending",
    };

    setSaving(true);
    try {
      const { data: body } = await api.post("/sales-orders", payload);
      const data = (body.data ?? body) as Record<string, unknown>;
      const soId = String(data.id ?? "");
      const soNumber = String(data.so_number ?? `SO-${Date.now().toString().slice(-6)}`);

      const createdLines: SoLineServer[] = validLines.map((l, i) => {
        const q = Math.max(1, Math.round(Number(l.qty) || 1));
        const price = Number(l.unit_price) || 0;
        return {
          id: `local-${i + 1}`,
          product_id: l.product_id,
          product_name: l.product_name.trim(),
          name: l.product_name.trim(),
          qty: q,
          unit_price: price,
          line_total: q * price,
        };
      });

      setShowAdd(false);
      showToast(
        "success",
        "SO created",
        `${soNumber} · ${primaryName}${validLines.length > 1 ? ` +${validLines.length - 1}` : ""} · ${formatPeso(orderTotal)}`
      );
      setPage(1);
      await invalidateSalesOrders();
      setViewOrder({
        id: soId || String(Date.now()),
        so_number: soNumber,
        customer_id: form.customer_id,
        warehouse_id: form.warehouse_id || null,
        order_date: String(data.order_date ?? form.order_date),
        items: Number(data.items) || itemsTotal,
        total: Number(data.total) || orderTotal,
        status: String(data.status || form.status || "pending"),
        notes: form.notes.trim() || null,
        reference: form.reference.trim() || null,
        customer:
          (data.customer as SalesOrder["customer"]) ??
          customers.find((c) => c.id === form.customer_id) ??
          null,
        warehouse:
          (data.warehouse as SalesOrder["warehouse"]) ??
          warehouses.find((w) => w.id === form.warehouse_id) ??
          null,
        lines: createdLines,
      });
    } catch (err: unknown) {
      const responseData =
        isAxiosError(err) &&
        typeof err.response?.data === "object" &&
        err.response.data !== null &&
        !Array.isArray(err.response.data)
          ? err.response.data as Record<string, unknown>
          : null;
      const validationErrors =
        responseData?.errors &&
        typeof responseData.errors === "object" &&
        !Array.isArray(responseData.errors)
          ? Object.values(responseData.errors).flatMap((value) =>
              Array.isArray(value)
                ? value.filter((message): message is string => typeof message === "string")
                : []
            )
          : [];
      const msg =
        (typeof responseData?.message === "string" && responseData.message) ||
        validationErrors.join(" ") ||
        (err instanceof Error && err.message) ||
        "Failed to create SO";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (order: SalesOrder, nextStatus: string) => {
    if (!canUpdate) { showToast("error", "Permission denied", "You cannot update sales orders."); return; }
    setUpdatingId(order.id);
    try {
      await api.put(`/sales-orders/${order.id}`, { status: nextStatus });
      if (viewOrder?.id === order.id) {
        setViewOrder((current) => current ? { ...current, status: nextStatus } : current);
      }
      showToast("success", "Status updated", `${order.so_number} → ${nextStatus}`);
      await invalidateSalesOrders();
    } catch (err) {
      showToast(
        "error",
        "Update failed",
        err instanceof Error ? err.message : "Could not update status"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="orders-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {permsLoaded && !canView && (
            <div className="card" style={{ padding: 40, textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
              <p className="text-muted" style={{ margin: 0 }}>
                You do not have permission to view sales orders. Ask an admin to grant <code>sales_orders.view</code>.
              </p>
            </div>
          )}
          <div className="page-header">
            <div>
              <h1 className="page-title">Sales Orders</h1>
              <p className="page-subtitle">
                Sell to customers · product lines as transactions · ship from warehouse · ₱
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void refetchSOs();
                  void refetchWarehouses();
                  void Promise.all([customerLookup.refetch(), productLookup.refetch()]);
                  showToast("success", "Refreshed", "Orders reloaded.");
                }}
                disabled={soFetching || loading}
              >
                <IconRefresh /> {soFetching ? "Refreshing…" : "Refresh"}
              </button>
              {canCreate && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openAdd}
                disabled={saving}
                title="Create a new sales order"
              >
                <IconPlus /> New Sales Order
              </button>
              )}
            </div>
          </div>

          <div className="order-steps">
            <div className="order-step">
              <span className="os-num">1</span>
              <div>
                <strong>Create</strong>
                <span>Customer + products</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">2</span>
              <div>
                <strong>Process</strong>
                <span>Allocate stock</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">3</span>
              <div>
                <strong>Ship</strong>
                <span>Dispatch order</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">4</span>
              <div>
                <strong>Complete</strong>
                <span>Close the SO</span>
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
              <div className="stat-value">
                {loading ? "…" : statsView.all.toLocaleString()}
              </div>
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
              <div className="stat-hint">All SO revenue</div>
            </div>
            <button
              type="button"
              className={`stat-card${status === "completed" || status === "shipped" ? " is-active" : ""}`}
              style={{ cursor: "pointer", textAlign: "left" }}
              onClick={() => {
                setStatus(
                  status === "completed" || status === "shipped" ? "all" : "completed"
                );
                setPage(1);
              }}
            >
              <div className="stat-label">Done</div>
              <div className="stat-value success">
                {loading ? "…" : statsView.done.toLocaleString()}
              </div>
              <div className="stat-hint">Shipped / completed</div>
            </button>
          </div>

          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search by SO number or customer…"
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
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name ? `${w.code} — ${w.name}` : w.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>SO Number</th>
                    <th>Customer</th>
                    <th>Product lines</th>
                    <th>Ordered</th>
                    <th>Units</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j}>
                            <div
                              className="skel"
                              style={{
                                width: j === 0 ? 130 : j === 1 ? 100 : 56,
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
                      <td colSpan={7} className="empty-row">
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
                            No orders match your filters
                          </p>
                          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                            Create a sales order with product lines to get started.
                          </p>
                          {canCreate && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={openAdd}
                            disabled={saving}
                          >
                            <IconPlus /> New Sales Order
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => {
                      const lines = o.lines ?? [];
                      const productLabel = lines[0]
                        ? lineDisplayName(lines[0])
                        : "";
                      const lineCount = lines.length;
                      const units =
                        Number(o.items) ||
                        lines.reduce((s, ln) => s + (Number(ln.qty) || 0), 0);
                      return (
                        <tr
                          key={o.id}
                          className={viewOrder?.id === o.id ? "po-row-selected" : undefined}
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setViewOrder({
                              ...o,
                              lines: lines.length ? lines : o.lines,
                            })
                          }
                          title="Click to view details"
                        >
                          <td>
                            <div className="product-cell">
                              <div
                                className="product-avatar"
                                style={{
                                  background: "rgba(90, 154, 110, 0.12)",
                                  color: "var(--sa-sage-deep)",
                                }}
                              >
                                <IconBox />
                              </div>
                              <div>
                                <div className="product-name">{o.so_number}</div>
                                {o.warehouse && (
                                  <div className="product-meta">{o.warehouse.code}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="fw-600">{o.customer?.name ?? "—"}</div>
                          </td>
                          <td>
                            {productLabel ? (
                              <div className="po-product-stack">
                                <div className="fw-600" title={productLabel}>
                                  {truncateText(productLabel, 36)}
                                </div>
                                {lineCount > 1 && (
                                  <div className="product-meta">
                                    +{lineCount - 1} more
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">
                                {units > 0 ? `${units.toLocaleString()} units` : "—"}
                              </span>
                            )}
                          </td>
                          <td className="text-muted">
                            {formatDateLong(o.order_date)}
                          </td>
                          <td>
                            <span className="fw-600">{units.toLocaleString()}</span>
                          </td>
                          <td className="fw-600">{formatPeso(Number(o.total))}</td>
                          <td>
                            <span className={`status-badge status-${o.status}`}>
                              {o.status}
                            </span>
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
        </main>
      </div>

      {/* Create SO modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => !saving && setShowAdd(false)}>
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
            aria-labelledby="so-create-title"
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
                <h2 id="so-create-title" style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>
                  New Sales Order
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sa-muted)" }}>
                  Customer + product lines · recorded as sale transactions · ₱
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAdd(false)}
                disabled={saving}
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
                  <label>Customer *</label>
                  <select
                    required
                    value={form.customer_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customer_id: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="">— Select customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <span className="po-field-hint">
                      No customers loaded — check Customers API
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label>Warehouse {warehouses.length > 0 ? "*" : ""}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={form.warehouse_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warehouse_id: e.target.value }))
                      }
                      disabled={saving || whBusy}
                      style={{ flex: 1 }}
                      required={warehouses.length > 0}
                    >
                      {warehouses.length === 0 ? (
                        <option value="">
                          {whBusy ? "Loading warehouses…" : "— No warehouses —"}
                        </option>
                      ) : (
                        <>
                          <option value="">— Select warehouse —</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name ? `${w.code} — ${w.name}` : w.code}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {warehouses.length === 0 && (
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
                  {warehouses.length === 0 && !whBusy && (
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
                    onChange={(e) =>
                      setForm((f) => ({ ...f, order_date: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>Reference</label>
                  <input
                    type="text"
                    placeholder="PO / quote number…"
                    value={form.reference}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, reference: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
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
                    placeholder="Delivery notes…"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Products to sell</span>
                    <span className="po-lines-hint">
                      Catalog products · qty checked against stock · sale transactions
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
                    const selected = products.find((p) => p.id === line.product_id);
                    const stock = line.product_id ? stockOf(line.product_id) : null;
                    const stockErr = lineStockError(line);
                    const maxAttr = stock !== null ? Math.max(0, stock) : undefined;
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
                            onChange={(e) => onProductChange(line.key, e.target.value)}
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
                                <span className="so-stock-sku">{selected.sku}</span>
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
                            onChange={(e) => onQtyChange(line.key, e.target.value)}
                            disabled={saving || (stock !== null && stock <= 0)}
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
                              setLine(line.key, { unit_price: e.target.value })
                            }
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
                    <div style={{ fontSize: 12, color: "var(--sa-muted)" }}>
                      Order summary
                    </div>
                    <span>
                      {form.lines.filter((l) => l.product_id).length} line
                      {form.lines.filter((l) => l.product_id).length === 1
                        ? ""
                        : "s"}
                      {" · "}
                      {formTotals(form.lines).items.toLocaleString()} units
                      {form.lines.some((l) => lineStockError(l)) && (
                        <span className="so-footer-warn"> · Fix stock issues</span>
                      )}
                    </span>
                  </div>
                  <strong>{formatPeso(formTotals(form.lines).total, 2)}</strong>
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
                    customers.length === 0 ||
                    products.length === 0 ||
                    form.lines.some((l) => !!lineStockError(l)) ||
                    form.lines.filter((l) => l.product_id && Number(l.qty) > 0).length === 0
                  }
                >
                  {saving ? "Saving…" : "Create SO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Minimal detail drawer */}
      {viewOrder && (() => {
        const busy = updatingId === viewOrder.id;
        const lines = viewOrder.lines ?? [];
        const linesTotal = lines.reduce((sum, ln) => {
          const qty = Number(ln.qty) || 0;
          const price = Number(ln.unit_price) || 0;
          return sum + (Number(ln.line_total) || qty * price);
        }, 0);
        const rootQty =
          Number(viewOrder.items) ||
          lines.reduce((s, ln) => s + (Number(ln.qty) || 0), 0);

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
              aria-label={`Sales order ${viewOrder.so_number}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="roles-drawer-header">
                <div className="role-cell">
                  <div className="role-avatar role-avatar-lg">SO</div>
                  <div>
                    <h2>{viewOrder.so_number}</h2>
                    <p className="roles-drawer-sub">
                      {viewOrder.customer?.name ?? "Sales order"}
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
                  <span className="meta-value">{rootQty.toLocaleString()}</span>
                </div>
                <div>
                  <span className="meta-label">Total</span>
                  <span className="meta-value">
                    {formatPeso(Number(viewOrder.total), 2)}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Ordered</span>
                  <span className="meta-value">
                    {formatDateLong(viewOrder.order_date)}
                  </span>
                </div>
              </div>

              <div className="roles-drawer-body po-drawer-body">
                <div className="roles-overview po-drawer-sections po-drawer-minimal">
                  <section className="po-drawer-section">
                    <h3>
                      Product Sale
                      {lines.length > 0 && (
                        <span className="po-drawer-count">
                          {lines.length} line{lines.length === 1 ? "" : "s"}
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
                              key={ln.id ?? `${name}-${i}`}
                              className="po-purchase-row"
                            >
                              <div className="po-purchase-main">
                                <span className="po-purchase-name">{name}</span>
                                <span className="po-purchase-meta">
                                  {qty.toLocaleString()} × {formatPeso(price, 2)}
                                </span>
                              </div>
                              <span className="po-purchase-total">
                                {formatPeso(lt, 2)}
                              </span>
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
                    ) : (
                      <p className="po-drawer-empty-msg">No products on this order.</p>
                    )}
                  </section>

                  <section className="po-drawer-section">
                    <h3>Details</h3>
                    <dl className="po-drawer-dl po-drawer-dl-compact">
                      <div>
                        <dt>Customer</dt>
                        <dd>{viewOrder.customer?.name ?? "—"}</dd>
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

                  <section className="po-drawer-section">
                    <h3>Status</h3>
                    <div className="form-field">
                      <select
                        value={viewOrder.status}
                        disabled={busy || !canUpdate}
                        title={!canUpdate ? "No permission to update" : undefined}
                        onChange={(e) => {
                          if (!canUpdate) return;
                          const next = e.target.value;
                          if (next === viewOrder.status) return;
                          void updateStatus(viewOrder, next);
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={s === "shipped" || s === "completed"}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                            {s === "shipped" || s === "completed"
                              ? " (managed by shipments)"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>
                </div>
              </div>

              <div className="roles-drawer-footer po-drawer-footer">
                <div className="po-drawer-footer-left" />
                <div className="po-drawer-footer-right">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setViewOrder(null)}
                    disabled={busy}
                  >
                    Close
                  </button>
                </div>
              </div>
            </aside>
          </div>
        );
      })()}

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

export default SalesOrders;