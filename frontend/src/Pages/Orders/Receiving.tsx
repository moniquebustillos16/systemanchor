import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useWarehouses } from "../../hooks/useWarehouses";
import { useGoodsReceipts } from "../../hooks/useOrders";
import { invalidateGoodsReceipts } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Orders.css";

/* ── Types ─────────────────────────────────────────────────── */
 

type Supplier = { id: string; name: string };
type Warehouse = { id: string; code: string; name?: string };
type User = { id: string; name: string };

type PoLine = {
  product_id?: string;
  product_name?: string | null;
  name?: string | null;
  qty?: number | string;
  unit_price?: number | string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id?: string | null;
  warehouse_id?: string | null;
  items?: number;
  total?: number | string;
  status?: string;
  supplier?: Supplier | null;
  warehouse?: Warehouse | null;
  lines?: PoLine[];
};

type GoodsReceipt = {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  warehouse_id: string | null;
  receiver_id: string | null;
  date: string;
  expected: number | string;
  received: number | string;
  status: string;
  purchase_order?: PurchaseOrder | null;
  supplier?: Supplier | null;
  warehouse?: Warehouse | null;
  receiver?: User | null;
};

type GrLine = {
  key: string;
  product_id: string;
  product_name: string;
  expected: string;
  received: string;
  unit_price: string;
};

type GrForm = {
  purchase_order_id: string;
  supplier_id: string;
  warehouse_id: string;
  receiver_id: string;
  date: string;
  status: string;
  lines: GrLine[];
};

type ToastState = {
  type: "success" | "error" | "info";
  title: string;
  msg: string;
};

/* ── Constants ─────────────────────────────────────────────── */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OPEN_STATUSES = ["pending", "processing", "partial"];
const PAGE_SIZE = 15;

let lineKeySeq = 0;
const newLineKey = () => `gr-line-${Date.now()}-${++lineKeySeq}`;

const emptyLine = (): GrLine => ({
  key: newLineKey(),
  product_id: "",
  product_name: "",
  expected: "0",
  received: "0",
  unit_price: "0",
});

const emptyForm = (): GrForm => ({
  purchase_order_id: "",
  supplier_id: "",
  warehouse_id: "",
  receiver_id: "",
  date: new Date().toISOString().slice(0, 10),
  status: "pending",
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

function readCachedPoLines(poNumber: string): PoLine[] {
  try {
    const raw = localStorage.getItem(`sa-po-lines:${poNumber}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lineTotals(lines: GrLine[]) {
  const expected = lines.reduce((s, l) => s + (Number(l.expected) || 0), 0);
  const received = lines.reduce((s, l) => s + (Number(l.received) || 0), 0);
  return { expected, received };
}

function linesFromPo(po: PurchaseOrder | undefined): GrLine[] {
  if (!po) return [emptyLine()];
  if (po.lines && po.lines.length > 0) {
    return po.lines.map((ln) => {
      const name = ln.product_name || ln.name || "Product";
      const qty = String(Math.max(0, Number(ln.qty) || 0));
      return {
        key: newLineKey(),
        product_id: ln.product_id ? String(ln.product_id) : "",
        product_name: name,
        expected: qty || String(po.items ?? 1),
        received: qty || String(po.items ?? 1),
        unit_price: String(Number(ln.unit_price) || 0),
      };
    });
  }
  return [
    {
      ...emptyLine(),
      product_name: `PO ${po.po_number}`,
      expected: String(po.items ?? 1),
      received: String(po.items ?? 1),
    },
  ];
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

const IconCheck = () => (
  <svg {...svg} width="15" height="15">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Component ─────────────────────────────────────────────── */
function Receiving() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wh, setWh] = useState("all");
  const [page, setPage] = useState(1);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receivers, setReceivers] = useState<User[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<GrForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const {
    rows: whRows,
    isLoading: warehousesLoading,
    isFetching: warehousesFetching,
    refetch: refetchWarehouses,
  } = useWarehouses({
    enabled: true,
    perPage: 200,
  });

  /** Shared React Query cache (same as Dashboard prefetch). */
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

  const warehouseOptions = warehouses;
  const whBusy = warehousesLoading || warehousesFetching;

  const {
    rows: receiptRows,
    meta,
    stats,
    isLoading: loading,
    isFetching,
    isError,
    error: queryError,
    refetchAll,
  } = useGoodsReceipts({
    page,
    perPage: PAGE_SIZE,
    search: debouncedSearch,
    status,
    warehouseId: wh === "all" ? null : wh,
    enabled: true,
  });

  const receipts = receiptRows as unknown as GoodsReceipt[];
  const total = meta.total;
  const lastPage = meta.last_page;
  const error = isError
    ? (queryError as Error)?.message ?? "Failed to load goods receipts"
    : null;

  const statsView = {
    all: stats.all,
    open: stats.open,
    done: stats.done,
    lines: stats.lines,
  };

  const showToast = useCallback(
    (type: ToastState["type"], title: string, msg: string) => {
      setToast({ type, title, msg });
      window.setTimeout(() => setToast(null), 3200);
    },
    []
  );

  /* ── Permissions ─────────────────────────────────────────── */
  const { can, isLoaded: permsLoaded } = usePermissions();



  const canView = can("receiving.view",
    "goods_receipts.view",
    "goods-receipts.view"
  );
  const canCreate = can("receiving.create",
    "goods_receipts.create",
    "goods-receipts.create"
  );
  const canUpdate = can("receiving.update",
    "goods_receipts.update",
    "goods-receipts.update"
  );

  /* ── Debounced search ────────────────────────────────────── */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => window.clearTimeout(t);
  }, [search]);

  /* ── Form option loaders (PO + supplier + user). Warehouses = useWarehouses. ─ */
  const loadFormOptions = useCallback(async () => {
    try {
      const [poRes, supRes, userRes] = await Promise.all([
        api.get("/purchase-orders", { params: { per_page: 200, all: 1 } }),
        api.get("/suppliers", { params: { per_page: 200 } }),
        api.get("/users", { params: { per_page: 100 } }),
      ]);

      const pos: PurchaseOrder[] = getItems(poRes.data).map((item) => {
        const row = asRecord(item);
        const poNumber = String(row.po_number ?? row.number ?? row.id);
        const cached = readCachedPoLines(poNumber);
        const supplier = asRecord(row.supplier);
        const warehouse = asRecord(row.warehouse);

        return {
          id: String(row.id),
          po_number: poNumber,
          supplier_id:
            row.supplier_id != null
              ? String(row.supplier_id)
              : supplier.id != null
                ? String(supplier.id)
                : null,
          warehouse_id:
            row.warehouse_id != null
              ? String(row.warehouse_id)
              : warehouse.id != null
                ? String(warehouse.id)
                : null,
          items: row.items as number | undefined,
          total: row.total as number | string | undefined,
          status: row.status != null ? String(row.status) : undefined,
          supplier:
            supplier.id != null
              ? {
                  id: String(supplier.id),
                  name: String(supplier.name ?? ""),
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
            Array.isArray(row.lines) && (row.lines as PoLine[]).length > 0
              ? (row.lines as PoLine[])
              : cached.length
                ? cached
                : [],
        };
      });

      const sups: Supplier[] = getItems(supRes.data).map((i) => {
        const row = asRecord(i);
        return {
          id: String(row.id),
          name: String(row.name ?? row.id),
        };
      });

      pos.forEach((p) => {
        if (p.supplier && !sups.find((s) => s.id === p.supplier!.id)) {
          sups.push(p.supplier);
        }
      });

      const users: User[] = getItems(userRes.data).map((i) => {
        const row = asRecord(i);
        return {
          id: String(row.id),
          name: String(row.name ?? row.email ?? row.id),
        };
      });

      setPurchaseOrders(pos);
      setSuppliers(sups.sort((a, b) => a.name.localeCompare(b.name)));
      setReceivers(users.sort((a, b) => a.name.localeCompare(b.name)));

      return { pos, sups, users };
    } catch (e) {
      console.error("[Receiving] form options failed:", e);
      showToast("error", "Lookups failed", "Could not load form options.");
      return {
        pos: [] as PurchaseOrder[],
        sups: [] as Supplier[],
        users: [] as User[],
      };
    }
  }, [showToast]);

  /** Open modal immediately; warehouses from React Query, PO/suppliers load in background. */
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
    const firstWh = warehouseOptions[0]?.id ?? "";
    setForm({
      ...emptyForm(),
      warehouse_id: firstWh,
      receiver_id: receivers[0]?.id ?? "",
    });
    setShowAdd(true);

    if (warehouses.length === 0) void refetchWarehouses();

    void loadFormOptions().then(({ pos, users }) => {
      const firstPo = pos[0];
      const whId =
        firstPo?.warehouse_id ??
        firstPo?.warehouse?.id ??
        warehouseOptions[0]?.id ??
        warehouses[0]?.id ??
        "";
      if (firstPo) {
        setForm({
          ...emptyForm(),
          purchase_order_id: firstPo.id,
          supplier_id: firstPo.supplier_id ?? firstPo.supplier?.id ?? "",
          warehouse_id: whId,
          receiver_id: users[0]?.id ?? receivers[0]?.id ?? "",
          lines: linesFromPo(firstPo),
        });
      } else {
        setForm((f) => ({
          ...f,
          warehouse_id: f.warehouse_id || whId,
          receiver_id: f.receiver_id || users[0]?.id || "",
        }));
      }
    });
  };

  // Auto-fill warehouse when query arrives while modal is open
  useEffect(() => {
    if (!showAdd) return;
    if (warehouseOptions.length === 0) return;
    setForm((f) => {
      if (f.warehouse_id && warehouseOptions.some((w) => w.id === f.warehouse_id)) {
        return f;
      }
      return { ...f, warehouse_id: warehouseOptions[0].id };
    });
  }, [showAdd, warehouseOptions]);

  const onPoChange = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    setForm((f) => ({
      ...f,
      purchase_order_id: poId,
      supplier_id: po?.supplier_id ?? po?.supplier?.id ?? f.supplier_id,
      warehouse_id: po?.warehouse_id ?? po?.warehouse?.id ?? f.warehouse_id,
      lines: linesFromPo(po),
    }));
  };

  const setLine = (key: string, patch: Partial<GrLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
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

  /* ── Create receipt ──────────────────────────────────────── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.purchase_order_id) {
      setFormError("Purchase Order is required.");
      return;
    }
    if (!form.supplier_id) {
      setFormError("Supplier is required.");
      return;
    }
    if (warehouseOptions.length > 0 && !form.warehouse_id) {
      setFormError("Select a warehouse for receiving.");
      return;
    }

    const { expected, received } = lineTotals(form.lines);
    if (received <= 0) {
      setFormError("Received quantity must be greater than zero.");
      return;
    }

    const po = purchaseOrders.find((p) => p.id === form.purchase_order_id);

    setSaving(true);
    try {
      const { data: body } = await api.post("/goods-receipts", {
        purchase_order_id: form.purchase_order_id,
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id || null,
        receiver_id: form.receiver_id || null,
        date: form.date || null,
        expected,
        received,
        status: form.status || "pending",
      });

      const data = body.data ?? body;
      const receiptId = String(data.id ?? "");
      const receiptNumber = String(
        data.receipt_number ?? `GR-${Date.now().toString().slice(-6)}`
      );

      await Promise.all(
        form.lines
          .filter((l) => l.product_name.trim() && Number(l.received) > 0)
          .map(async (l) => {
            try {
              await api.post("/product-transactions", {
                product_id:
                  l.product_id && UUID_RE.test(l.product_id)
                    ? l.product_id
                    : null,
                product_name: l.product_name.trim(),
                transaction_type: "receiving",
                reference_id:
                  receiptId && UUID_RE.test(receiptId) ? receiptId : null,
                reference_number: receiptNumber,
                partner_id: form.supplier_id,
                partner_type: "supplier",
                quantity: Number(l.received) || 0,
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
        "Receipt created",
        `${receiptNumber}${po ? ` · ${po.po_number}` : ""} · ${received.toLocaleString()} units`
      );
      setPage(1);
      await invalidateGoodsReceipts();
      await refetchAll();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: any } })?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        (err as Error)?.message ||
        "Failed to create receipt";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  /* ── Complete receipt ────────────────────────────────────── */
  const complete = async (id: string, receiptNumber: string) => {
    if (!canUpdate) {
      showToast(
        "error",
        "Permission denied",
        "You cannot complete goods receipts."
      );
      return;
    }
    setCompletingId(id);
    try {
      await api.post(`/goods-receipts/${id}/complete`);
      showToast(
        "success",
        "Receiving complete",
        `${receiptNumber} closed. Post stock-in via Stock Movements if needed.`
      );
      await invalidateGoodsReceipts();
      await refetchAll();
    } catch (err) {
      showToast(
        "error",
        "Complete failed",
        err instanceof Error ? err.message : "Could not complete receipt"
      );
    } finally {
      setCompletingId(null);
    }
  };

  const totals = lineTotals(form.lines);

  const handleRefresh = () => {
    void refetchAll();
    void refetchWarehouses();
    showToast("success", "Refreshed", "Receipts reloaded.");
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
                grant <code>receiving.view</code>.
              </p>
            </div>
          )}

          <div className="page-header">
            <div>
              <h1 className="page-title">Goods Receiving</h1>
              <p className="page-subtitle">
                Link PO · count received qty · receiving transactions
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
                  <IconPlus /> New Receipt
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
                  <div className="stat-label">All Receipts</div>
                  <div className="stat-value">
                    {loading ? "…" : statsView.all.toLocaleString()}
                  </div>
                  <div className="stat-hint">Total documents</div>
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
                    {loading ? "…" : statsView.open.toLocaleString()}
                  </div>
                  <div className="stat-hint">Pending / processing</div>
                </button>
                <button
                  type="button"
                  className={`stat-card${
                    status === "completed" || status === "received"
                      ? " is-active"
                      : ""
                  }`}
                  style={{ cursor: "pointer", textAlign: "left", width: "100%" }}
                  onClick={() => {
                    setStatus(status === "completed" ? "all" : "completed");
                    setPage(1);
                  }}
                >
                  <div className="stat-label">Completed</div>
                  <div className="stat-value success">
                    {loading ? "…" : statsView.done.toLocaleString()}
                  </div>
                  <div className="stat-hint">Closed receipts</div>
                </button>
                <div className="stat-card">
                  <div className="stat-label">Lines Received</div>
                  <div className="stat-value">
                    {loading ? "…" : statsView.lines.toLocaleString()}
                  </div>
                  <div className="stat-hint">Units posted</div>
                </div>
              </div>

              <div className="card">
                <div className="table-toolbar">
                  <div className="table-search">
                    <IconSearch />
                    <input
                      type="text"
                      placeholder="Search receipt, PO, supplier…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search goods receipts"
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
                      <option value="partial">Partial</option>
                      <option value="received">Received</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                      value={wh}
                      onChange={(e) => {
                        setWh(e.target.value);
                        setPage(1);
                      }}
                      aria-label="Filter by warehouse"
                    >
                      <option value="all">All sites</option>
                      {warehouseOptions.map((w) => (
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
                        <th>Receipt #</th>
                        <th>PO</th>
                        <th>Supplier</th>
                        <th>Warehouse</th>
                        <th>Date</th>
                        <th>Expected</th>
                        <th>Received</th>
                        <th>Status</th>
                        <th>Actions</th>
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
                                    width: j === 0 ? 110 : 64,
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
                      ) : receipts.length === 0 ? (
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
                              <p style={{ margin: 0, fontWeight: 550 }}>
                                No receipts match your filters
                              </p>
                              {canCreate && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => void openAdd()}
                                >
                                  <IconPlus /> New Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        receipts.map((r) => {
                          const canComplete = OPEN_STATUSES.includes(
                            (r.status || "").toLowerCase()
                          );
                          return (
                            <tr key={r.id}>
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
                                    <div className="product-name">
                                      {r.receipt_number}
                                    </div>
                                    {r.receiver?.name && (
                                      <div className="product-meta">
                                        {r.receiver.name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="fw-600">
                                {r.purchase_order?.po_number ?? "—"}
                              </td>
                              <td>{r.supplier?.name ?? "—"}</td>
                              <td>{r.warehouse ? r.warehouse.code : "—"}</td>
                              <td className="text-muted">
                                {formatDateLong(r.date)}
                              </td>
                              <td>
                                {Number(r.expected).toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="fw-600">
                                {Number(r.received).toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td>
                                <span
                                  className={`status-badge status-${r.status}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td>
                                {canComplete && canUpdate ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={completingId === r.id}
                                    onClick={() =>
                                      void complete(r.id, r.receipt_number)
                                    }
                                  >
                                    <IconCheck />
                                    {completingId === r.id ? "…" : "Complete"}
                                  </button>
                                ) : canComplete && !canUpdate ? (
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
            aria-labelledby="gr-create-title"
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
                  id="gr-create-title"
                  style={{ margin: 0, fontSize: 18, fontWeight: 650 }}
                >
                  New Goods Receipt
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "var(--sa-muted)",
                  }}
                >
                  Link a PO · count received qty · recorded as receiving
                  transactions
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
                  <label htmlFor="gr-po">Purchase Order *</label>
                  <select
                    id="gr-po"
                    required
                    value={form.purchase_order_id}
                    onChange={(e) => onPoChange(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">— Select PO —</option>
                    {purchaseOrders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.po_number}
                        {p.supplier?.name ? ` · ${p.supplier.name}` : ""}
                        {p.status ? ` (${p.status})` : ""}
                      </option>
                    ))}
                  </select>
                  {purchaseOrders.length === 0 && (
                    <span className="po-field-hint">
                      No purchase orders found. Create a PO first.
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="gr-supplier">Supplier *</label>
                  <select
                    id="gr-supplier"
                    required
                    value={form.supplier_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier_id: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="">— Select —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="gr-wh">
                    Warehouse {warehouseOptions.length > 0 ? "*" : ""}
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      id="gr-wh"
                      value={form.warehouse_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warehouse_id: e.target.value }))
                      }
                      disabled={saving || whBusy}
                      style={{ flex: 1 }}
                      required={warehouseOptions.length > 0}
                    >
                      {warehouseOptions.length === 0 ? (
                        <option value="">
                          {whBusy ? "Loading warehouses…" : "— No warehouses —"}
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
                        disabled={whBusy || saving}
                        onClick={() => void refetchWarehouses()}
                        title="Reload warehouses"
                      >
                        {whBusy ? "…" : "Retry"}
                      </button>
                    )}
                  </div>
                  {warehouseOptions.length === 0 && !whBusy && (
                    <span className="po-field-hint">
                      No warehouses loaded. Create a site under Warehouses, then
                      click Retry.
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="gr-receiver">Receiver</label>
                  <select
                    id="gr-receiver"
                    value={form.receiver_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, receiver_id: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="">— Select —</option>
                    {receivers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="gr-date">Date</label>
                  <input
                    id="gr-date"
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="gr-status">Status</label>
                  <select
                    id="gr-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="partial">Partial</option>
                    <option value="received">Received</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="po-lines-section">
                <div className="po-lines-header">
                  <div>
                    <span className="po-lines-title">Products received</span>
                    <span className="po-lines-hint">
                      From PO lines · adjust received qty · receiving
                      transactions
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addLine}
                    disabled={saving}
                  >
                    <IconPlus /> Add line
                  </button>
                </div>

                <div className="po-lines-list">
                  {form.lines.map((line, idx) => {
                    const exp = Number(line.expected) || 0;
                    const rec = Number(line.received) || 0;
                    const variance = rec - exp;
                    return (
                      <div key={line.key} className="po-line-row">
                        <div className="form-field po-line-product">
                          {idx === 0 && <label>Product</label>}
                          <input
                            type="text"
                            value={line.product_name}
                            onChange={(e) =>
                              setLine(line.key, {
                                product_name: e.target.value,
                              })
                            }
                            disabled={saving}
                            placeholder="Product name"
                          />
                          {exp > 0 && (
                            <span
                              className={`po-line-meta ${
                                variance === 0
                                  ? "so-stock-ok"
                                  : variance < 0
                                    ? "so-stock-warn"
                                    : "so-stock-ok"
                              }`}
                            >
                              {variance === 0
                                ? "Matches expected"
                                : variance < 0
                                  ? `Short ${Math.abs(variance).toLocaleString()}`
                                  : `Over +${variance.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                        <div className="form-field po-line-qty">
                          {idx === 0 && <label>Expected</label>}
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={line.expected}
                            onChange={(e) =>
                              setLine(line.key, { expected: e.target.value })
                            }
                            disabled={saving}
                          />
                        </div>
                        <div className="form-field po-line-qty">
                          {idx === 0 && <label>Received *</label>}
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={line.received}
                            onChange={(e) =>
                              setLine(line.key, { received: e.target.value })
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
                              setLine(line.key, { unit_price: e.target.value })
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
                      Receipt summary
                    </div>
                    <span>
                      Expected {totals.expected.toLocaleString()} · Received{" "}
                      {totals.received.toLocaleString()}
                      {totals.expected > 0 &&
                        totals.received !== totals.expected && (
                          <span className="so-footer-warn">
                            {" "}
                            · Δ{" "}
                            {(
                              totals.received - totals.expected
                            ).toLocaleString()}
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
                  disabled={saving || purchaseOrders.length === 0}
                >
                  {saving ? "Saving…" : "Create Receipt"}
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

export default Receiving;