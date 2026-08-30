import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useWarehouses } from "../../hooks/useWarehouses";
import { useReturns } from "../../hooks/useOrders";
import { invalidateReturns } from "../../lib/invalidate";
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

type ReturnItem = {
  id: string;
  return_number: string;
  sales_order_id: string | null;
  warehouse_id: string | null;
  reason: string;
  disposition: string;
  items: number;
  date: string;
  status: string;
  sales_order?: SalesOrder | null;
  warehouse?: Warehouse | null;
};

type RetLine = {
  key: string;
  product_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};

type RetForm = {
  sales_order_id: string;
  warehouse_id: string;
  reason: string;
  disposition: string;
  date: string;
  status: string;
  lines: RetLine[];
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const REASONS = [
  "Damaged in transit",
  "Wrong item shipped",
  "Quality issue",
  "Customer changed mind",
  "Other",
] as const;

const DISPOSITIONS = [
  "Inspect & restock",
  "Replace",
  "Refund",
  "Scrap",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_SIZE = 15;

let lineKeySeq = 0;
const newLineKey = () => `ret-line-${Date.now()}-${++lineKeySeq}`;

const emptyLine = (): RetLine => ({
  key: newLineKey(),
  product_id: "",
  product_name: "",
  qty: "1",
  unit_price: "0",
});

const emptyForm = (): RetForm => ({
  sales_order_id: "",
  warehouse_id: "",
  reason: REASONS[0],
  disposition: DISPOSITIONS[0],
  date: new Date().toISOString().slice(0, 10),
  status: "pending",
  lines: [emptyLine()],
});

/* ── Permission helpers ────────────────────────────────────── */


/* ── Domain helpers ────────────────────────────────────────── */
function getItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o?.data)) return o.data as unknown[];
  if (
    o?.data &&
    typeof o.data === "object" &&
    Array.isArray((o.data as { data?: unknown }).data)
  ) {
    return (o.data as { data: unknown[] }).data;
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

/* ── Component ─────────────────────────────────────────────── */
function Returns() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Sales Orders pattern: warehouse dropdown from useWarehouses (API scopes non-admins)
  const { rows: whRows, refetch: refetchWarehouses } = useWarehouses({
    enabled: true,
    perPage: 200,
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
        .filter((w) => w.id)
        .sort((a, b) => (a.code || "").localeCompare(b.code || "")),
    [whRows]
  );

  /* ── Cached list + stats ─────────────────────────────────── */
  const {
    rows: returnRows,
    meta,
    stats,
    isLoading: loading,
    isFetching,
    isError,
    error: queryError,
    refetchAll,
  } = useReturns({
    page,
    perPage: PAGE_SIZE,
    search: debouncedSearch,
    status,
    enabled: true,
  });

  const rows = returnRows as unknown as ReturnItem[];
  const total = meta.total;
  const lastPage = meta.last_page;
  const error = isError
    ? (queryError as Error)?.message ?? "Failed to load returns"
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

   const canView = can("returns.view",
    "rma.view",
    "return.view"
  );
  const canCreate = can("returns.create",
    "rma.create",
    "return.create"
  );
  const canUpdate = can("returns.update",
    "rma.update",
    "return.update"
  );
  /* ── Debounced search ────────────────────────────────────── */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => window.clearTimeout(t);
  }, [search]);

  /* ── Lookups (SO + products) ─────────────────────────────── */
  const loadLookups = useCallback(async () => {
    try {
      const [soSettled, prodSettled] = await Promise.allSettled([
        api.get("/sales-orders", { params: { per_page: 200 } }),
        api.get("/products", { params: { per_page: 200 } }),
      ]);

      if (soSettled.status === "fulfilled") {
        const json = soSettled.value.data;
        const list: SalesOrder[] = getItems(json).map((item) => {
          const row = asRecord(item);
          const soNumber = String(row.so_number ?? row.id);
          const cached = readCachedSoLines(soNumber);
          const customer = row.customer as
            | { id?: unknown; name?: string }
            | null
            | undefined;
          const warehouse = row.warehouse as
            | { id?: unknown; code?: string; name?: string }
            | null
            | undefined;

          return {
            id: String(row.id),
            so_number: soNumber,
            customer_id:
              (row.customer_id as string | null) ??
              (customer?.id != null ? String(customer.id) : null),
            warehouse_id:
              (row.warehouse_id as string | null) ??
              (warehouse?.id != null ? String(warehouse.id) : null),
            items: row.items as number | undefined,
            status: row.status as string | undefined,
            customer: customer
              ? { id: String(customer.id), name: customer.name ?? "" }
              : null,
            warehouse: warehouse
              ? {
                  id: String(warehouse.id),
                  code: warehouse.code ?? warehouse.name ?? "",
                  name: warehouse.name,
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
        setSalesOrders(list);
      }

      if (prodSettled.status === "fulfilled") {
        const json = prodSettled.value.data;
        const list: ProductOpt[] = getItems(json)
          .map((p) => {
            const row = asRecord(p);
            return {
              id: String(row.id),
              sku: String(row.sku ?? ""),
              name: String(row.name ?? ""),
              price: row.price as number | string | undefined,
              qty: row.qty as number | string | undefined,
              status: row.status as string | undefined,
            };
          })
          .filter((p) => !p.status || p.status === "active")
          .sort((a, b) => a.name.localeCompare(b.name));
        setProducts(list);
      }
    } catch (e) {
      console.error("[Returns] lookups failed:", e);
    }
  }, []);

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
        p.name.toLowerCase().includes(label)
    );
  };

  const soToRetLines = (so: SalesOrder | undefined): RetLine[] => {
    if (!so) return [emptyLine()];
    const source =
      so.lines && so.lines.length > 0
        ? so.lines
        : readCachedSoLines(so.so_number);
    if (source.length === 0) {
      return [
        {
          ...emptyLine(),
          qty: String(Math.max(1, Number(so.items) || 1)),
        },
      ];
    }
    return source.map((ln) => {
      const matched = resolveProduct(ln);
      return {
        key: newLineKey(),
        product_id: matched?.id ?? (ln.product_id ? String(ln.product_id) : ""),
        product_name: matched?.name ?? ln.product_name ?? ln.name ?? "Product",
        qty: String(Math.max(1, Number(ln.qty) || 1)),
        unit_price: String(
          matched != null
            ? Number(matched.price) || Number(ln.unit_price) || 0
            : Number(ln.unit_price) || 0
        ),
      };
    });
  };

  const applySo = (soId: string, base?: RetForm): RetForm => {
    const so = salesOrders.find((s) => s.id === soId);
    return {
      ...(base ?? form),
      sales_order_id: soId,
      warehouse_id:
        so?.warehouse_id ??
        so?.warehouse?.id ??
        base?.warehouse_id ??
        form.warehouse_id,
      lines: soToRetLines(so),
    };
  };

  const openAdd = () => {
    if (!canCreate) {
      showToast(
        "error",
        "Permission denied",
        "You cannot create records on this page."
      );
      return;
    }

    setFormError(null);
    const first = salesOrders[0];
    if (first) {
      setForm(
        applySo(first.id, {
          ...emptyForm(),
          warehouse_id:
            first.warehouse_id ??
            first.warehouse?.id ??
            warehouses[0]?.id ??
            "",
        })
      );
    } else {
      setForm({
        ...emptyForm(),
        warehouse_id: warehouses[0]?.id ?? "",
      });
    }
    setShowAdd(true);
  };

  const onSoChange = (soId: string) => setForm((f) => applySo(soId, f));

  const setLine = (key: string, patch: Partial<RetLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };

  const onProductChange = (key: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setLine(key, {
      product_id: productId,
      product_name: p?.name ?? "",
      unit_price: p ? String(Number(p.price) || 0) : "0",
    });
  };

  const addLine = () =>
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (key: string) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((l) => l.key !== key),
    }));

  const selectedSo = salesOrders.find((s) => s.id === form.sales_order_id);
  const itemsTotal = form.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  /* ── Create RMA ──────────────────────────────────────────── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.sales_order_id) {
      setFormError("Sales order is required.");
      return;
    }

    const validLines = form.lines.filter(
      (l) => l.product_id && l.product_name.trim() && Number(l.qty) > 0
    );
    if (validLines.length === 0) {
      setFormError(
        "Select at least one product with quantity greater than zero."
      );
      return;
    }

    const so = salesOrders.find((s) => s.id === form.sales_order_id);
    const totalItems = validLines.reduce(
      (s, l) => s + (Number(l.qty) || 0),
      0
    );

    setSaving(true);
    try {
      const { data: body } = await api.post("/returns", {
        sales_order_id: form.sales_order_id,
        warehouse_id: form.warehouse_id || null,
        reason: form.reason,
        disposition: form.disposition,
        items: totalItems,
        date: form.date || null,
        status: form.status || "pending",
      });

      const data = (body.data ?? body) as Record<string, unknown>;
      const retId = String(data.id ?? "");
      const retNumber = String(
        data.return_number ?? `RMA-${Date.now().toString().slice(-6)}`
      );

      const customerId = so?.customer_id ?? so?.customer?.id ?? null;

      await Promise.all(
        validLines.map(async (l) => {
          try {
            await api.post("/product-transactions", {
              product_id:
                l.product_id && UUID_RE.test(l.product_id)
                  ? l.product_id
                  : null,
              product_name: l.product_name.trim(),
              transaction_type: "return",
              reference_id: retId && UUID_RE.test(retId) ? retId : null,
              reference_number: retNumber,
              partner_id:
                customerId && UUID_RE.test(customerId) ? customerId : null,
              partner_type: "customer",
              quantity: Number(l.qty) || 0,
              unit_price: Number(l.unit_price) || 0,
              status: form.status || "pending",
            });
          } catch {
            /* non-blocking */
          }
        })
      );

      setShowAdd(false);
      showToast(
        "success",
        "RMA created",
        `${retNumber} · ${so?.so_number ?? "SO"} · ${totalItems} items`
      );
      setPage(1);
      await invalidateReturns();
      await refetchAll();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: any } })?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        (err as Error)?.message ||
        "Failed to create return";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  /* ── Close RMA ───────────────────────────────────────────── */
  const completeReturn = async (id: string, number: string) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot update returns.");
      return;
    }
    setClosingId(id);
    try {
      await api.post(`/returns/${id}/complete`);
      showToast("success", "RMA closed", `${number} closed.`);
      await invalidateReturns();
      await refetchAll();
    } catch (err) {
      showToast(
        "error",
        "Update failed",
        err instanceof Error ? err.message : "Could not close RMA"
      );
    } finally {
      setClosingId(null);
    }
  };

  const handleRefresh = () => {
    void refetchAll();
    void loadLookups();
    void refetchWarehouses();
    showToast("success", "Refreshed", "Returns reloaded.");
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
                grant <code>returns.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Returns</h1>
              <p className="page-subtitle">
                RMA intake · link SO · product lines as return transactions ·
                restock or refund
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
                  onClick={openAdd}
                >
                  <IconPlus /> New Return
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
                  <div className="stat-label">Returns</div>
                  <div className="stat-value">
                    {loading ? "…" : stats.all.toLocaleString()}
                  </div>
                  <div className="stat-hint">All RMAs</div>
                </button>
                <button
                  type="button"
                  className={`stat-card${
                    status === "pending" || status === "processing"
                      ? " is-active"
                      : ""
                  }`}
                  style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
                  onClick={() => {
                    setStatus(status === "pending" ? "all" : "pending");
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
                  <div className="stat-label">Closed</div>
                  <div className="stat-value success">
                    {loading ? "…" : stats.closed.toLocaleString()}
                  </div>
                  <div className="stat-hint">Completed</div>
                </button>
                <div className="stat-card">
                  <div className="stat-label">Items</div>
                  <div className="stat-value">
                    {loading ? "…" : stats.items.toLocaleString()}
                  </div>
                  <div className="stat-hint">Units returned</div>
                </div>
              </div>

              <div className="card">
                <div className="table-toolbar">
                  <div className="table-search">
                    <IconSearch />
                    <input
                      type="text"
                      placeholder="Search RMA, SO, customer…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search returns"
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
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>RMA</th>
                        <th>SO</th>
                        <th>Customer</th>
                        <th>Reason</th>
                        <th>Warehouse</th>
                        <th>Items</th>
                        <th>Disposition</th>
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
                                    width: j === 0 ? 100 : 56,
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
                                No returns match your filters
                              </p>
                              {canCreate && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={openAdd}
                                >
                                  <IconPlus /> New Return
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const canClose =
                            r.status !== "completed" &&
                            r.status !== "cancelled";
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="product-cell">
                                  <div
                                    className="product-avatar"
                                    style={{
                                      background: "rgba(184, 92, 74, 0.1)",
                                      color: "var(--sa-clay)",
                                    }}
                                  >
                                    <IconBox />
                                  </div>
                                  <div>
                                    <div className="product-name">
                                      {r.return_number}
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
                              <td>{r.reason}</td>
                              <td>{r.warehouse?.code ?? "—"}</td>
                              <td className="fw-600">{r.items}</td>
                              <td>{r.disposition}</td>
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
                                {canClose && canUpdate ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={closingId === r.id}
                                    onClick={() =>
                                      void completeReturn(
                                        r.id,
                                        r.return_number
                                      )
                                    }
                                  >
                                    {closingId === r.id ? "…" : "Close RMA"}
                                  </button>
                                ) : canClose && !canUpdate ? (
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
            aria-labelledby="ret-create-title"
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
                  id="ret-create-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  New Return (RMA)
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  Link a sales order · select products · return transactions
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
                  <label htmlFor="ret-so">Sales Order *</label>
                  <select
                    id="ret-so"
                    required
                    value={form.sales_order_id}
                    onChange={(e) => onSoChange(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">— Select SO —</option>
                    {salesOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.so_number}
                        {o.customer?.name ? ` · ${o.customer.name}` : ""}
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
                  <label htmlFor="ret-wh">Warehouse</label>
                  <select
                    id="ret-wh"
                    value={form.warehouse_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, warehouse_id: e.target.value }))
                    }
                    disabled={saving}
                    required={warehouses.length > 0}
                  >
                    {warehouses.length === 0 ? (
                      <option value="">— No warehouses —</option>
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
                </div>

                <div className="form-field">
                  <label htmlFor="ret-date">Date</label>
                  <input
                    id="ret-date"
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="ret-reason">Reason *</label>
                  <select
                    id="ret-reason"
                    required
                    value={form.reason}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, reason: e.target.value }))
                    }
                    disabled={saving}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="ret-disposition">Disposition *</label>
                  <select
                    id="ret-disposition"
                    required
                    value={form.disposition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, disposition: e.target.value }))
                    }
                    disabled={saving}
                  >
                    {DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Products returned</span>
                    <span className="po-lines-hint">
                      From SO / catalog · recorded as return transactions
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
                  {form.lines.map((line, idx) => (
                    <div key={line.key} className="po-line-row">
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
                            const used = form.lines.some(
                              (l) =>
                                l.key !== line.key && l.product_id === p.id
                            );
                            return (
                              <option
                                key={p.id}
                                value={p.id}
                                disabled={used}
                              >
                                {p.sku ? `${p.sku} — ${p.name}` : p.name}
                                {p.price != null
                                  ? ` · ₱${Number(p.price).toLocaleString()}`
                                  : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="form-field po-line-qty">
                        {idx === 0 && <label>Qty *</label>}
                        <input
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) =>
                            setLine(line.key, { qty: e.target.value })
                          }
                          disabled={saving}
                          required
                        />
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
                  ))}
                </div>

                <div className="po-lines-footer">
                  <div>
                    <div style={{ fontSize: 12, color: "var(--sa-muted)" }}>
                      RMA summary
                    </div>
                    <span>
                      {form.lines.filter((l) => l.product_id).length} line
                      {form.lines.filter((l) => l.product_id).length === 1
                        ? ""
                        : "s"}
                      {" · "}
                      {itemsTotal.toLocaleString()} units · {form.disposition}
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
                    form.lines.filter(
                      (l) => l.product_id && Number(l.qty) > 0
                    ).length === 0
                  }
                >
                  {saving ? "Creating…" : "Create RMA"}
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

export default Returns;