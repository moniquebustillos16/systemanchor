import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import { useSuppliers } from "../../hooks/usePartners";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../api/partners";
import { invalidateSuppliers } from "../../lib/invalidate";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Partners.css";



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
const IconDownload = () => (
  <svg {...svg} width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconSearch = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconRefresh = () => (
  <svg {...svg} width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IconClose = () => (
  <svg {...svg} width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconEdit = () => (
  <svg {...svg} width="15" height="15">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg {...svg} width="15" height="15">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const IconUsers = () => (
  <svg {...svg} width="20" height="20">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  product_offers: string | null;
  score: number;
  status: string;
  orders?: number;
  orders_count?: number;
  created_at?: string;
  updated_at?: string;
};

/** Split free-text product offers into keywords (shared logic with Purchase Orders) */
function parseProductOffers(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,;|/·\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 1);
}

/** Join offer keywords back to stored string */
function joinProductOffers(tags: string[]): string {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .join(", ");
}

/** Common offer suggestions for quick-add */
const OFFER_SUGGESTIONS = [
  "Steel",
  "Bolts",
  "Nuts",
  "Washers",
  "Electrical components",
  "Wire",
  "Cable",
  "Pipes",
  "Valves",
  "Lumber",
  "Plywood",
  "Cement",
  "Paint",
  "Tools",
  "Safety equipment",
  "Fasteners",
  "Bearings",
  "Motors",
  "Sensors",
  "Packaging",
];

type PurchaseOrderLite = {
  id: string;
  supplier_id?: string | null;
  supplier?: { id: string; name?: string } | null;
  status?: string;
};

type PaginatedResponse<T> = {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

function scoreClass(score: number) {
  if (score >= 90) return "high";
  if (score >= 80) return "mid";
  return "low";
}


function countOrdersBySupplier(orders: PurchaseOrderLite[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const o of orders) {
    const sid = o.supplier_id || o.supplier?.id;
    if (!sid) continue;
    map.set(sid, (map.get(sid) || 0) + 1);
  }
  return map;
}

function Suppliers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [poCounts, setPoCounts] = useState<Map<string, number>>(new Map());
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    city: "",
    product_offers: "",
    score: "80",
    status: "active",
  });
  const [offerInput, setOfferInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const {
    rows: supplierRows,
    isLoading: loading,
    
    isError,
    error: queryError,
    refetch,
  } = useSuppliers({
    search: debouncedSearch,
    status,
    perPage: 100,
    enabled: true,
  });

  const suppliers: Supplier[] = useMemo(
    () =>
      (supplierRows ?? []).map((raw) => {
        const s = raw as unknown as Supplier;
        return {
          ...s,
          id: String(s.id),
          score: Number(s.score ?? 0),
          product_offers: s.product_offers ?? null,
          orders: Number(s.orders_count ?? s.orders ?? 0),
        };
      }),
    [supplierRows]
  );

  const error = isError
    ? (queryError as Error)?.message ?? "Unable to load suppliers"
    : null;

  const formOfferTags = useMemo(
    () => parseProductOffers(form.product_offers),
    [form.product_offers]
  );

  const addOfferTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const existing = formOfferTags.map((t) => t.toLowerCase());
    if (existing.includes(tag.toLowerCase())) {
      setOfferInput("");
      return;
    }
    const next = [...formOfferTags, tag];
    setForm((f) => ({ ...f, product_offers: joinProductOffers(next) }));
    setOfferInput("");
  };

  const removeOfferTag = (tag: string) => {
    const next = formOfferTags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    setForm((f) => ({ ...f, product_offers: joinProductOffers(next) }));
  };

  const onOfferKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addOfferTag(offerInput);
    } else if (e.key === "Backspace" && !offerInput && formOfferTags.length > 0) {
      removeOfferTag(formOfferTags[formOfferTags.length - 1]);
    }
  };

  const suggestionPool = useMemo(() => {
    const have = new Set(formOfferTags.map((t) => t.toLowerCase()));
    return OFFER_SUGGESTIONS.filter((s) => !have.has(s.toLowerCase()));
  }, [formOfferTags]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();
  const canView = can("suppliers.view");
  const canCreate = can("suppliers.create");
  const canUpdate = can("suppliers.update");

  const fetchPoCounts = useCallback(async () => {
    try {
      const { data: json } = await api.get("/purchase-orders", {
        params: { per_page: 200, sort: "order_date", dir: "desc" },
      });
      const list: PurchaseOrderLite[] = Array.isArray(json)
        ? json
        : (json as PaginatedResponse<PurchaseOrderLite>)?.data ?? [];
      setPoCounts(countOrdersBySupplier(list));
    } catch {
      /* keep previous counts */
    }
  }, []);

  useEffect(() => {
    void fetchPoCounts();
  }, [fetchPoCounts]);

  const fetchSuppliers = useCallback(async () => {
    await Promise.all([refetch(), fetchPoCounts()]);
  }, [refetch, fetchPoCounts]);

  const orderCountFor = useCallback(
    (s: Supplier): number => {
      const fromPo = poCounts.get(String(s.id));
      if (typeof fromPo === "number") return fromPo;
      return Number(s.orders_count ?? s.orders ?? 0);
    },
    [poCounts]
  );

  const stats = useMemo(() => {
    const active = suppliers.filter((s) => s.status === "active").length;
    const atRisk = suppliers.filter((s) => Number(s.score) < 80).length;
    const avgScore =
      suppliers.length > 0
        ? Math.round(suppliers.reduce((sum, x) => sum + Number(x.score), 0) / suppliers.length)
        : 0;
    const totalOrders = suppliers.reduce((sum, x) => sum + orderCountFor(x), 0);
    return { all: suppliers.length, active, atRisk, avgScore, totalOrders };
  }, [suppliers, orderCountFor]);

  const openCreate = () => {
    if (!canCreate) { showToast("error", "Permission denied", "You cannot create suppliers."); return; }
    setEditing(null);
    setForm({
      name: "",
      contact: "",
      email: "",
      phone: "",
      city: "",
      product_offers: "",
      score: "80",
      status: "active",
    });
    setOfferInput("");
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    if (!canUpdate) { showToast("error", "Permission denied", "You cannot update suppliers."); return; }
    setEditing(s);
    setForm({
      name: s.name || "",
      contact: s.contact || "",
      email: s.email || "",
      phone: s.phone || "",
      city: s.city || "",
      product_offers: s.product_offers || "",
      score: String(s.score ?? 80),
      status: s.status || "active",
    });
    setOfferInput("");
    setDetailOpen(false);
    setModalOpen(true);
  };

  const openDetail = (s: Supplier) => {
    setSelected(s);
    setDetailOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("error", "Validation", "Name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        product_offers: form.product_offers.trim() || null,
        score: form.score ? Number(form.score) : 80,
        status: form.status || "active",
      };

      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload);
      }

      showToast(
        "success",
        editing ? "Updated" : "Created",
        editing ? "Supplier updated successfully." : "Supplier created successfully."
      );
      setModalOpen(false);
      await invalidateSuppliers();
      await fetchSuppliers();
    } catch (err: any) {
      const body = err?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        err?.message ||
        "Save failed";
      showToast("error", "Error", String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!canUpdate) { showToast("error", "Permission denied", "You cannot delete suppliers."); return; }
    const linked = orderCountFor(s);
    const warn =
      linked > 0
        ? `"${s.name}" has ${linked} purchase order(s). Delete anyway?`
        : `Delete supplier "${s.name}"?`;
    if (!window.confirm(warn)) return;

    try {
      await deleteSupplier(s.id);

      showToast("success", "Deleted", `"${s.name}" removed.`);
      setDetailOpen(false);
      setSelected(null);
      await invalidateSuppliers();
      await fetchSuppliers();
    } catch (err: any) {
      const body = err?.response?.data;
      const msg =
        body?.message ||
        err?.message ||
        "Delete failed";
      showToast("error", "Error", String(msg));
    }
  };

  const handleExport = () => {
    if (suppliers.length === 0) {
      showToast("info", "Export", "No suppliers to export.");
      return;
    }
    const header = [
      "Name",
      "Contact",
      "Email",
      "Phone",
      "City",
      "Product Offers",
      "Score",
      "Orders",
      "Status",
    ];
    const rows = suppliers.map((s) =>
      [
        s.name,
        s.contact,
        s.email,
        s.phone,
        s.city,
        s.product_offers,
        s.score,
        orderCountFor(s),
        s.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Export", "Supplier list downloaded.");
  };

  return (
    <div className="partners-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          {permsLoaded && !canView && (
            <div className="card" style={{ padding: 40, textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Access restricted</p>
              <p className="text-muted" style={{ margin: 0 }}>
                You do not have permission to view this page. Ask an admin to grant <code>suppliers.view</code>.
              </p>
            </div>
          )}
          <div className="page-header">
            <div>
              <h1 className="page-title">Suppliers</h1>
              <p className="page-subtitle">
                Vendor scorecard, contacts, product offers, and purchase history
              </p>
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-secondary" onClick={handleExport}>
                <IconDownload /> Export
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  fetchSuppliers();
                  showToast("success", "Refreshed", "Suppliers and PO counts updated.");
                }}
              >
                <IconRefresh /> Refresh
              </button>
              {canCreate && (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <IconPlus /> Add Supplier
              </button>
              )}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Suppliers</div>
              <div className="stat-value">{stats.all}</div>
              <div className="stat-hint">{stats.active} active</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Score</div>
              <div className="stat-value">{stats.avgScore}</div>
              <div className="stat-hint">Performance index</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">At Risk</div>
              <div className="stat-value warning">{stats.atRisk}</div>
              <div className="stat-hint">Score below 80</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Orders</div>
              <div className="stat-value">{stats.totalOrders}</div>
              <div className="stat-hint">Linked purchase orders</div>
            </div>
          </div>

          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search name, contact, city, product offers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-filters">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="table-wrap">
              <table className="orders-table partners-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>City</th>
                    <th>Product Offers</th>
                    <th>Score</th>
                    <th>Orders</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="empty-state">
                          <div className="empty-spinner" />
                          <span>Loading suppliers…</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="empty-state">
                          <p className="empty-title">{error}</p>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={fetchSuppliers}
                          >
                            <IconRefresh /> Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        <div className="empty-state">
                          <div className="empty-icon">
                            <IconUsers />
                          </div>
                          <p className="empty-title">No suppliers match</p>
                          <p className="empty-hint">
                            {search || status !== "all"
                              ? "Try adjusting your search or filters."
                              : "Add your first supplier to get started."}
                          </p>
                          {!search && status === "all" && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={openCreate}
                            >
                              <IconPlus /> Add Supplier
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => {
                      const orders = orderCountFor(s);
                      const sc = Number(s.score);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => openDetail(s)}
                          className="clickable-row"
                        >
                          <td>
                            <div className="partner-name">{s.name}</div>
                            <div className="partner-email">{s.email || "—"}</div>
                          </td>
                          <td>
                            <div>{s.contact || "—"}</div>
                            <div className="partner-email">{s.phone || "—"}</div>
                          </td>
                          <td>{s.city || "—"}</td>
                          <td>
                            {(() => {
                              const tags = parseProductOffers(s.product_offers);
                              if (tags.length === 0) {
                                return <span className="partner-email">—</span>;
                              }
                              const shown = tags.slice(0, 3);
                              const extra = tags.length - shown.length;
                              return (
                                <div className="offer-chip-row" title={tags.join(", ")}>
                                  {shown.map((t) => (
                                    <span key={t} className="offer-chip offer-chip--sm">
                                      {t}
                                    </span>
                                  ))}
                                  {extra > 0 && (
                                    <span className="offer-chip offer-chip--sm offer-chip--more">
                                      +{extra}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <div className="score-cell">
                              <span className={`score-pill ${scoreClass(sc)}`}>{sc}</span>
                              <div className="score-bar">
                                <div
                                  className={`score-bar-fill ${scoreClass(sc)}`}
                                  style={{ width: `${Math.min(100, sc)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="fw-600">{orders}</span>
                            {orders > 0 && (
                              <div className="partner-email">
                                {orders === 1 ? "1 order" : `${orders} orders`}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${s.status}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ========== DETAIL MODAL ========== */}
      {detailOpen && selected && (
        <div
          className="modal-overlay"
          onClick={() => setDetailOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-detail-title"
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="supplier-detail-title" className="modal-title">
                  {selected.name}
                </h2>
                <span className={`status-badge status-${selected.status}`}>
                  {selected.status}
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetailOpen(false)}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-label">Contact Person</div>
                <div className="detail-value">{selected.contact || "—"}</div>
              </div>

              <div className="detail-grid-2">
                <div className="detail-section">
                  <div className="detail-label">Email</div>
                  <div className="detail-value">{selected.email || "—"}</div>
                </div>
                <div className="detail-section">
                  <div className="detail-label">Phone</div>
                  <div className="detail-value">{selected.phone || "—"}</div>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-label">City</div>
                <div className="detail-value">{selected.city || "—"}</div>
              </div>

              <div className="detail-section">
                <div className="detail-label">Product Offers</div>
                {parseProductOffers(selected.product_offers).length > 0 ? (
                  <div className="offer-chip-row offer-chip-row--wrap">
                    {parseProductOffers(selected.product_offers).map((t) => (
                      <span key={t} className="offer-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="detail-value partner-email">
                    No product offers set — add some so Purchase Orders can filter inventory
                  </div>
                )}
                {selected.product_offers && (
                  <p className="detail-hint">
                    These keywords filter products when creating a PO for this supplier.
                  </p>
                )}
              </div>

              <div className="detail-grid-2">
                <div className="detail-section">
                  <div className="detail-label">Score</div>
                  <div className="score-cell score-cell--lg">
                    <span
                      className={`score-pill ${scoreClass(Number(selected.score))}`}
                    >
                      {Number(selected.score)}
                    </span>
                    <div className="score-bar score-bar--lg">
                      <div
                        className={`score-bar-fill ${scoreClass(Number(selected.score))}`}
                        style={{
                          width: `${Math.min(100, Number(selected.score))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="detail-section">
                  <div className="detail-label">Linked Orders</div>
                  <div className="detail-value fw-600">
                    {orderCountFor(selected)}
                  </div>
                </div>
              </div>

              {(selected.created_at || selected.updated_at) && (
                <div className="detail-grid-2 detail-meta">
                  {selected.created_at && (
                    <div className="detail-section">
                      <div className="detail-label">Created</div>
                      <div className="detail-value detail-muted">
                        {new Date(selected.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selected.updated_at && (
                    <div className="detail-section">
                      <div className="detail-label">Updated</div>
                      <div className="detail-value detail-muted">
                        {new Date(selected.updated_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {canUpdate && (
                <>
              <button
                type="button"
                className="btn btn-secondary btn-danger-ghost"
                onClick={() => handleDelete(selected)}
              >
                <IconTrash /> Delete
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openEdit(selected)}
              >
                <IconEdit /> Edit
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== CREATE / EDIT MODAL ========== */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-form-title"
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="supplier-form-title" className="modal-title">
                {editing ? "Edit Supplier" : "Add Supplier"}
              </h2>
              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body form-stack">
                <label className="form-field">
                  <span>Name *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Company name"
                    autoFocus
                  />
                </label>

                <label className="form-field">
                  <span>Contact</span>
                  <input
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    placeholder="Contact person"
                  />
                </label>

                <div className="form-grid-2">
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </label>
                  <label className="form-field">
                    <span>Phone</span>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+63 …"
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>City</span>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="City"
                  />
                </label>

                <div className="form-field">
                  <span>Product Offers</span>
                  <p className="form-hint">
                    Keywords used to match inventory when creating Purchase Orders. Press Enter
                    or comma to add.
                  </p>
                  <div className="offer-input-box">
                    <div className="offer-chip-row offer-chip-row--wrap">
                      {formOfferTags.map((t) => (
                        <span key={t} className="offer-chip offer-chip--editable">
                          {t}
                          <button
                            type="button"
                            className="offer-chip-remove"
                            aria-label={`Remove ${t}`}
                            onClick={() => removeOfferTag(t)}
                            disabled={saving}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        className="offer-tag-input"
                        value={offerInput}
                        onChange={(e) => setOfferInput(e.target.value)}
                        onKeyDown={onOfferKeyDown}
                        onBlur={() => {
                          if (offerInput.trim()) addOfferTag(offerInput);
                        }}
                        placeholder={
                          formOfferTags.length === 0
                            ? "e.g. Steel, bolts, electrical…"
                            : "Add another…"
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                  {suggestionPool.length > 0 && (
                    <div className="offer-suggestions">
                      <span className="offer-suggestions-label">Quick add</span>
                      <div className="offer-chip-row offer-chip-row--wrap">
                        {suggestionPool.slice(0, 10).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="offer-chip offer-chip--suggest"
                            disabled={saving}
                            onClick={() => addOfferTag(s)}
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-grid-2">
                  <label className="form-field">
                    <span>Score</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.score}
                      onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                    />
                  </label>
                  <label className="form-field">
                    <span>Status</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Update" : "Create"}
                </button>
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

export default Suppliers;