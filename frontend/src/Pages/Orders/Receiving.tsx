import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import "../css/Orders.css";



/* ── Role permissions ─────────────────────────────────────── */

type AuthPayload = {
  permissions?: string[];
  data?: { permissions?: string[]; user?: { permissions?: string[] } };
  user?: {
    permissions?: string[];
    role_id?: string;
    role?: { id?: string; permissions?: { name: string }[] };
  };
  role_id?: string;
};

function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const j = json as AuthPayload;
  if (Array.isArray(j.permissions)) return j.permissions.map(String);
  if (Array.isArray(j.data?.permissions)) return j.data!.permissions!.map(String);
  if (Array.isArray(j.user?.permissions)) return j.user!.permissions!.map(String);
  const rolePerms = j.user?.role?.permissions;
  if (Array.isArray(rolePerms)) {
    return rolePerms
      .map((p) => (typeof p === "string" ? p : p?.name))
      .filter(Boolean) as string[];
  }
  const du = (j as { data?: { user?: { permissions?: string[] } } }).data?.user;
  if (Array.isArray(du?.permissions)) return du!.permissions!.map(String);
  return [];
}

function can(perms: string[], ...needed: string[]): boolean {
  if (perms.includes("*") || perms.includes("admin") || perms.includes("Admin")) {
    return true;
  }
  return needed.some((n) => perms.includes(n));
}



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

type Stats = {
  all: number;
  open?: number;
  pending?: number;
  done?: number;
  completed?: number;
  lines?: number;
  lines_received?: number;
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function getItems(json: unknown): any[] {
  if (Array.isArray(json)) return json;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o?.data)) return o.data as any[];
  if (o?.data && typeof o.data === "object" && Array.isArray((o.data as any).data)) {
    return (o.data as any).data;
  }
  return [];
}

function formatDate(d: string) {
  return d ? d.slice(0, 10) : "—";
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

const OPEN_STATUSES = ["pending", "processing", "partial"];

function Receiving() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [wh, setWh] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receivers, setReceivers] = useState<User[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<GrForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };


  const fetchUserPermissions = useCallback(async () => {
    const finish = (list: string[]) => {
      setUserPermissions(list);
      setPermsLoaded(true);
    };

    const loadRolePerms = async (roleId: string): Promise<string[] | null> => {
      try {
        const { data: json } = await api.get(`/roles/${roleId}/permissions`);
        const perms =
          json?.data?.permissions ?? json?.permissions ?? json?.data ?? [];
        if (!Array.isArray(perms)) return null;
        return perms
          .map((p: { name?: string } | string) =>
            typeof p === "string" ? p : p?.name
          )
          .filter(Boolean) as string[];
      } catch {
        return null;
      }
    };

    let roleId: string | null = null;
    try {
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
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
            finish(parsed);
            return;
          }
          const list = extractPermissions(parsed);
          if (list.length > 0) {
            finish(list);
            return;
          }
          const u = parsed?.data ?? parsed?.user ?? parsed;
          roleId = u?.role_id || u?.role?.id || parsed?.role_id || roleId;
        } catch {
          /* not JSON */
        }
      }
    } catch {
      /* ignore */
    }

    if (!roleId) {
      roleId =
        localStorage.getItem("role_id") ||
        localStorage.getItem("auth_role_id") ||
        null;
    }

    if (roleId) {
      const names = await loadRolePerms(roleId);
      if (names) {
        finish(names);
        return;
      }
    }

    try {
      const { data: json } = await api.get("/me");
      if (json) {
        const list = extractPermissions(json);
        if (list.length > 0) {
          finish(list);
          return;
        }
        const u = json?.data ?? json?.user ?? json;
        const rid = u?.role_id || u?.role?.id;
        if (rid) {
          const names = await loadRolePerms(String(rid));
          if (names) {
            finish(names);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }

    finish(["*"]);
  }, []);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const canView = can(userPermissions, "receiving.view", "goods_receipts.view", "goods-receipts.view");
  const canCreate = can(userPermissions, "receiving.create", "goods_receipts.create", "goods-receipts.create");
  const canUpdate = can(userPermissions, "receiving.update", "goods_receipts.update", "goods-receipts.update");


  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("per_page", String(pageSize));
    params.set("page", String(page));
    params.set("sort", "date");
    params.set("dir", "desc");
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (wh !== "all") params.set("warehouse_id", wh);

    try {
      const [listSettled, statsSettled] = await Promise.allSettled([
        api.get("/goods-receipts", { params: Object.fromEntries(params) }),
        api.get("/goods-receipts/stats"),
      ]);

      if (listSettled.status === "rejected") {
        const e: any = listSettled.reason;
        throw new Error(
          `Receipts HTTP ${e?.response?.status ?? "?"}: ${String(e?.response?.data?.message || e?.message || "").slice(0, 200)}`
        );
      }
      if (statsSettled.status === "rejected") {
        const e: any = statsSettled.reason;
        throw new Error(`Stats HTTP ${e?.response?.status ?? "?"}`);
      }

      const listJson = listSettled.value.data;
      const statsJson: Stats = statsSettled.value.data;
      const rows: GoodsReceipt[] = getItems(listJson);

      setReceipts(rows);
      setTotal(Array.isArray(listJson) ? rows.length : listJson.total ?? rows.length);
      setLastPage(Array.isArray(listJson) ? 1 : listJson.last_page ?? 1);
      setStats(statsJson);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load goods receipts");
      setReceipts([]);
      setTotal(0);
      setLastPage(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, wh]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const statsView = {
    all: stats?.all ?? 0,
    open: stats?.open ?? stats?.pending ?? 0,
    done: stats?.done ?? stats?.completed ?? 0,
    lines: stats?.lines ?? stats?.lines_received ?? 0,
  };

  const loadFormOptions = async () => {
    const soft = async (path: string, params?: Record<string, string | number>) => {
      try {
        const { data } = await api.get(path, params ? { params } : undefined);
        return getItems(data);
      } catch {
        return [];
      }
    };

    const [poItems, supItems, whItems, userItems] = await Promise.all([
      soft("/purchase-orders", { per_page: 200 }),
      soft("/suppliers", { per_page: 200 }),
      soft("/warehouses", { per_page: 100 }),
      soft("/users", { per_page: 100 }),
    ]);

    const pos: PurchaseOrder[] = poItems.map((item: any) => {
      const poNumber = item.po_number ?? item.number ?? item.id;
      const cached = readCachedPoLines(String(poNumber));
      return {
        id: String(item.id),
        po_number: String(poNumber),
        supplier_id: item.supplier_id ?? item.supplier?.id ?? null,
        warehouse_id: item.warehouse_id ?? item.warehouse?.id ?? null,
        items: item.items,
        total: item.total,
        status: item.status,
        supplier: item.supplier
          ? { id: String(item.supplier.id), name: item.supplier.name }
          : null,
        warehouse: item.warehouse
          ? {
              id: String(item.warehouse.id),
              code: item.warehouse.code ?? item.warehouse.name,
              name: item.warehouse.name,
            }
          : null,
        lines: item.lines?.length ? item.lines : cached.length ? cached : [],
      };
    });

    const sups: Supplier[] = supItems.map((i: any) => ({
      id: String(i.id),
      name: i.name ?? i.id,
    }));
    const whs: Warehouse[] = whItems.map((i: any) => ({
      id: String(i.id),
      code: i.code ?? i.name ?? i.id,
      name: i.name,
    }));
    const users: User[] = userItems.map((i: any) => ({
      id: String(i.id),
      name: i.name ?? i.email ?? i.id,
    }));

    // Enrich suppliers/warehouses from POs
    pos.forEach((p) => {
      if (p.supplier && !sups.find((s) => s.id === p.supplier!.id)) {
        sups.push(p.supplier);
      }
      if (p.warehouse && !whs.find((w) => w.id === p.warehouse!.id)) {
        whs.push(p.warehouse);
      }
    });

    setPurchaseOrders(pos);
    setSuppliers(sups.sort((a, b) => a.name.localeCompare(b.name)));
    setWarehouses(whs.sort((a, b) => a.code.localeCompare(b.code)));
    setReceivers(users.sort((a, b) => a.name.localeCompare(b.name)));

    return { pos, sups, whs, users };
  };

  const applyPo = (poId: string, base?: GrForm) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    const linesFromPo: GrLine[] =
      po?.lines && po.lines.length > 0
        ? po.lines.map((ln) => {
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
          })
        : [
            {
              ...emptyLine(),
              product_name: po ? `PO ${po.po_number}` : "",
              expected: String(po?.items ?? 1),
              received: String(po?.items ?? 1),
            },
          ];

    return {
      ...(base ?? form),
      purchase_order_id: poId,
      supplier_id: po?.supplier_id ?? po?.supplier?.id ?? base?.supplier_id ?? form.supplier_id,
      warehouse_id:
        po?.warehouse_id ?? po?.warehouse?.id ?? base?.warehouse_id ?? form.warehouse_id,
      lines: linesFromPo,
    };
  };

  const openAdd = async () => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create records on this page.");
      return;
    }

    setFormError(null);
    setShowAdd(true);
    const { pos, users } = await loadFormOptions();
    const firstPo = pos[0];
    if (firstPo) {
      // need purchaseOrders state — use returned pos
      const linesFromPo: GrLine[] =
        firstPo.lines && firstPo.lines.length > 0
          ? firstPo.lines.map((ln) => {
              const name = ln.product_name || ln.name || "Product";
              const qty = String(Math.max(0, Number(ln.qty) || 0));
              return {
                key: newLineKey(),
                product_id: ln.product_id ? String(ln.product_id) : "",
                product_name: name,
                expected: qty || String(firstPo.items ?? 1),
                received: qty || String(firstPo.items ?? 1),
                unit_price: String(Number(ln.unit_price) || 0),
              };
            })
          : [
              {
                ...emptyLine(),
                product_name: `PO ${firstPo.po_number}`,
                expected: String(firstPo.items ?? 1),
                received: String(firstPo.items ?? 1),
              },
            ];
      setForm({
        ...emptyForm(),
        purchase_order_id: firstPo.id,
        supplier_id: firstPo.supplier_id ?? firstPo.supplier?.id ?? "",
        warehouse_id: firstPo.warehouse_id ?? firstPo.warehouse?.id ?? "",
        receiver_id: users[0]?.id ?? "",
        lines: linesFromPo,
      });
    } else {
      setForm({
        ...emptyForm(),
        receiver_id: users[0]?.id ?? "",
      });
    }
  };

  const onPoChange = (poId: string) => {
    setForm((f) => applyPo(poId, f));
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

      // Product transactions — receiving
      await Promise.all(
        form.lines
          .filter((l) => l.product_name.trim() && Number(l.received) > 0)
          .map(async (l) => {
            try {
              await api.post("/product-transactions", {
                product_id:
                  l.product_id && UUID_RE.test(l.product_id) ? l.product_id : null,
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
      await fetchReceipts();
    } catch (err: any) {
      const body = err?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        err?.message ||
        "Failed to create receipt";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const complete = async (id: string, receiptNumber: string) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot complete goods receipts.");
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
      await fetchReceipts();
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

  return (
    <div className="orders-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Goods Receiving</h1>
              <p className="page-subtitle">
                Receive against PO · product lines as transactions · stock into warehouse
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  fetchReceipts();
                  showToast("success", "Refreshed", "Receipts reloaded.");
                }}
                disabled={loading}
              >
                <IconRefresh /> Refresh
              </button>
              {canCreate && (
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                <IconPlus /> New Receipt
              </button>
              )}
            </div>
          </div>

          {permsLoaded && !canView ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div className="empty-state">
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
                <p className="text-muted">
                  You do not have permission to view this page. Ask an admin to grant 
                  <code>receiving.view</code>.
                </p>
              </div>
            </div>
          ) : (
          <>

          <div className="order-steps">
            <div className="order-step">
              <span className="os-num">1</span>
              <div>
                <strong>Select PO</strong>
                <span>Link purchase order</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">2</span>
              <div>
                <strong>Count goods</strong>
                <span>Expected vs received</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">3</span>
              <div>
                <strong>Confirm</strong>
                <span>Post receipt + transactions</span>
              </div>
            </div>
            <div className="order-step">
              <span className="os-num">4</span>
              <div>
                <strong>Complete</strong>
                <span>Close &amp; stock-in</span>
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
              <div className="stat-label">Receipts</div>
              <div className="stat-value">
                {loading ? "…" : statsView.all.toLocaleString()}
              </div>
              <div className="stat-hint">All receipts</div>
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
              <div className="stat-label">In Progress</div>
              <div className="stat-value warning">
                {loading ? "…" : statsView.open.toLocaleString()}
              </div>
              <div className="stat-hint">Open receipts</div>
            </button>
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
                            onClick={openAdd}
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
                                <div className="product-name">{r.receipt_number}</div>
                                {r.receiver?.name && (
                                  <div className="product-meta">{r.receiver.name}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="fw-600">
                            {r.purchase_order?.po_number ?? "—"}
                          </td>
                          <td>{r.supplier?.name ?? "—"}</td>
                          <td>
                            {r.warehouse
                              ? r.warehouse.name
                                ? `${r.warehouse.code}`
                                : r.warehouse.code
                              : "—"}
                          </td>
                          <td className="text-muted">{formatDateLong(r.date)}</td>
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
                            <span className={`status-badge status-${r.status}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            {canComplete && canUpdate ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={completingId === r.id}
                                onClick={() => complete(r.id, r.receipt_number)}
                              >
                                <IconCheck />
                                {completingId === r.id ? "…" : "Complete"}
                              </button>
                            ) : canComplete && !canUpdate ? (
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                No permission
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: 12 }}>
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
                <h2 id="gr-create-title" style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>
                  New Goods Receipt
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sa-muted)" }}>
                  Link a PO · count received qty · recorded as receiving transactions
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
                  <label>Purchase Order *</label>
                  <select
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
                  <label>Supplier *</label>
                  <select
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
                  <label>Warehouse</label>
                  <select
                    value={form.warehouse_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, warehouse_id: e.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="">— None —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name ? `${w.code} — ${w.name}` : w.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Receiver</label>
                  <select
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
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
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
                      From PO lines · adjust received qty · receiving transactions
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
                              setLine(line.key, { product_name: e.target.value })
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
                            · Δ {(totals.received - totals.expected).toLocaleString()}
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