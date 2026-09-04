import {  useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useCustomers } from "../../hooks/usePartners";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../api/partners";
import { invalidateCustomers } from "../../lib/invalidate";
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

type Customer = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  orders?: number;
  revenue?: number;
  open?: number;
  created_at?: string;
  updated_at?: string;
};

function healthClass(orders: number, open: number) {
  if (open > 1) return "mid";
  if (orders >= 50) return "high";
  if (orders >= 20) return "mid";
  return "low";
}

function healthLabel(orders: number, open: number) {
  const cls = healthClass(orders, open);
  if (cls === "high") return "Strong";
  if (cls === "mid") return "Watch";
  return "New";
}

function Customers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [toast, setToast] = useState<{
    type: string;
    title: string;
    msg: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    city: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const {
    rows: customerRows,
    isLoading: loading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useCustomers({
    search: debouncedSearch,
    status,
    perPage: 100,
    enabled: true,
  });

  const customers: Customer[] = useMemo(
    () =>
      (customerRows ?? []).map((raw) => {
        const c = raw as unknown as Customer;
        return {
          ...c,
          id: String(c.id),
          orders: Number(c.orders ?? 0),
          revenue: Number(c.revenue ?? 0),
          open: Number(c.open ?? 0),
        };
      }),
    [customerRows]
  );

  const error = isError
    ? (queryError as Error)?.message ?? "Unable to load customers"
    : null;

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const { can, isLoaded: permsLoaded } = usePermissions();

  const canView = can("customers.view");
  const canCreate = can("customers.create");
  const canUpdate = can("customers.update");

  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status === "active").length;
    const totalRev = customers.reduce((s, c) => s + (c.revenue ?? 0), 0);
    const openSOs = customers.reduce((s, c) => s + (c.open ?? 0), 0);
    const top =
      customers.length > 0
        ? [...customers].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0]
        : null;
    return { all: customers.length, active, totalRev, openSOs, top };
  }, [customers]);

  const openCreate = () => {
    if (!canCreate) {
      showToast("error", "Permission denied", "You cannot create customers.");
      return;
    }
    setEditing(null);
    setForm({
      name: "",
      contact: "",
      email: "",
      phone: "",
      city: "",
      status: "active",
    });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot update customers.");
      return;
    }
    setEditing(c);
    setForm({
      name: c.name || "",
      contact: c.contact || "",
      email: c.email || "",
      phone: c.phone || "",
      city: c.city || "",
      status: c.status || "active",
    });
    setModalOpen(true);
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
        status: form.status || "active",
      };

      if (editing) {
        await updateCustomer(editing.id, payload);
      } else {
        await createCustomer(payload);
      }

      showToast(
        "success",
        editing ? "Updated" : "Created",
        editing
          ? "Customer updated successfully."
          : "Customer created successfully."
      );
      setModalOpen(false);
      await invalidateCustomers();
      await refetch();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: any } })?.response?.data;
      const msg =
        body?.message ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        (err as Error)?.message ||
        "Save failed";
      showToast("error", "Error", String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!canUpdate) {
      showToast("error", "Permission denied", "You cannot delete customers.");
      return;
    }
    if (!window.confirm(`Delete customer "${c.name}"?`)) return;

    try {
      await deleteCustomer(c.id);
      showToast("success", "Deleted", `"${c.name}" removed.`);
      await invalidateCustomers();
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      showToast("error", "Error", msg);
    }
  };

  const handleExport = () => {
    if (customers.length === 0) {
      showToast("info", "Export", "No customers to export.");
      return;
    }
    const header = [
      "Name",
      "Contact",
      "Email",
      "Phone",
      "City",
      "Status",
      "Orders",
      "Revenue",
      "Open",
    ];
    const rows = customers.map((c) =>
      [
        c.name,
        c.contact,
        c.email,
        c.phone,
        c.city,
        c.status,
        c.orders ?? 0,
        c.revenue ?? 0,
        c.open ?? 0,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Export", "Customer list downloaded.");
  };

  return (
    <div className="partners-page">
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
                grant <code>customers.view</code>.
              </p>
            </div>
          )}
          <div className="page-header">
            <div>
              <h1 className="page-title">Customers</h1>
              <p className="page-subtitle">
                Accounts, health, and sales performance across Bicol
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExport}
              >
                <IconDownload /> Export
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void refetch();
                  showToast("success", "Refreshed", "Customer list reloaded.");
                }}
                disabled={isFetching}
              >
                {isFetching ? "Refreshing…" : "Recalculate Scores"}
              </button>
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreate}
                >
                  <IconPlus /> Add Customer
                </button>
              )}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Customers</div>
              <div className="stat-value">{stats.all}</div>
              <div className="stat-hint">{stats.active} active</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">
                ${stats.totalRev.toLocaleString()}
              </div>
              <div className="stat-hint">From sales orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open SOs</div>
              <div className="stat-value warning">{stats.openSOs}</div>
              <div className="stat-hint">Pending / processing / shipped</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Account</div>
              <div className="stat-value" style={{ fontSize: 18 }}>
                {stats.top?.name?.split(" ")[0] || "—"}
              </div>
              <div className="stat-hint">
                {stats.top
                  ? `$${(stats.top.revenue ?? 0).toLocaleString()}`
                  : ""}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-toolbar">
              <div className="table-search">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search name, contact, city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-filters">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>City</th>
                    <th>Health</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>Open</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        Loading customers…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        {error}
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ marginLeft: 12 }}
                          onClick={() => void refetch()}
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        No customers match
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const orders = c.orders ?? 0;
                      const open = c.open ?? 0;
                      const revenue = c.revenue ?? 0;
                      const hc = healthClass(orders, open);
                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="partner-name">{c.name}</div>
                            <div className="partner-email">{c.email || "—"}</div>
                          </td>
                          <td>
                            <div>{c.contact || "—"}</div>
                            <div className="partner-email">{c.phone || "—"}</div>
                          </td>
                          <td>{c.city || "—"}</td>
                          <td>
                            <span className={`score-pill ${hc}`}>
                              {healthLabel(orders, open)}
                            </span>
                          </td>
                          <td className="fw-600">{orders}</td>
                          <td className="fw-600">
                            ${revenue.toLocaleString()}
                          </td>
                          <td>{open}</td>
                          <td>
                            <span className={`status-badge status-${c.status}`}>
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {canUpdate && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => openEdit(c)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => void handleDelete(c)}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
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

      {modalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 480,
              margin: 16,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
              {editing ? "Edit Customer" : "Add Customer"}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Name *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Company / account name"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Contact</span>
                  <input
                    value={form.contact}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contact: e.target.value }))
                    }
                    placeholder="Contact person"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="email@example.com"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+63 …"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>City</span>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                    placeholder="City"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
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

export default Customers;