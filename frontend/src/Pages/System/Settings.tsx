import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
import "../css/System.css";

type Warehouse = {
  id: string;
  code?: string;
  name: string;
};

type SettingsForm = {
  company_name: string;
  trading_name: string;
  tin: string;
  industry: string;
  street_address: string;
  city: string;
  province: string;
  region: string;
  zip_code: string;
  country: string;
  landmark: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  currency: string;
  date_format: string;
  language: string;
  default_warehouse_id: string;
  fiscal_year_start: string;
  low_stock_threshold: string;
  auto_reorder: string;
};

const EMPTY_FORM: SettingsForm = {
  company_name: "",
  trading_name: "",
  tin: "",
  industry: "Warehousing & Logistics",
  street_address: "",
  city: "",
  province: "",
  region: "",
  zip_code: "",
  country: "Philippines",
  landmark: "",
  phone: "",
  email: "",
  website: "",
  timezone: "Asia/Manila",
  currency: "PHP",
  date_format: "YYYY-MM-DD",
  language: "English",
  default_warehouse_id: "",
  fiscal_year_start: "January",
  low_stock_threshold: "15",
  auto_reorder: "disabled",
};

function Settings() {
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsForm>(EMPTY_FORM);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; title: string; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const showToast = (type: string, title: string, msg: string) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const mapApiToForm = (data: Record<string, unknown>): SettingsForm => ({
    company_name: String(data.company_name ?? ""),
    trading_name: String(data.trading_name ?? ""),
    tin: String(data.tin ?? ""),
    industry: String(data.industry ?? "Warehousing & Logistics"),
    street_address: String(data.street_address ?? ""),
    city: String(data.city ?? ""),
    province: String(data.province ?? ""),
    region: String(data.region ?? ""),
    zip_code: String(data.zip_code ?? ""),
    country: String(data.country ?? "Philippines"),
    landmark: String(data.landmark ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    website: String(data.website ?? ""),
    timezone: String(data.timezone ?? "Asia/Manila"),
    currency: String(data.currency ?? "PHP"),
    date_format: String(data.date_format ?? "YYYY-MM-DD"),
    language: String(data.language ?? "English"),
    default_warehouse_id: String(data.default_warehouse_id ?? ""),
    fiscal_year_start: String(data.fiscal_year_start ?? "January"),
    low_stock_threshold: String(data.low_stock_threshold ?? "15"),
    auto_reorder: String(data.auto_reorder ?? "disabled"),
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: json } = await api.get("/settings");
      const data = json.data ?? json;
      const mapped = mapApiToForm(data);
      setForm(mapped);
      setSavedSnapshot(mapped);
      setDirty(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Unable to load settings";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      const { data: json } = await api.get("/warehouses?per_page=100");
      const list: Warehouse[] = Array.isArray(json) ? json : json.data ?? [];
      setWarehouses(list);
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchWarehouses();
  }, [fetchSettings, fetchWarehouses]);

  const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      showToast("error", "Validation", "Company name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        trading_name: form.trading_name.trim() || null,
        tin: form.tin.trim() || null,
        industry: form.industry || null,
        street_address: form.street_address.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        region: form.region.trim() || null,
        zip_code: form.zip_code.trim() || null,
        country: form.country.trim() || null,
        landmark: form.landmark.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        timezone: form.timezone || null,
        currency: form.currency || null,
        date_format: form.date_format || null,
        language: form.language || null,
        default_warehouse_id: form.default_warehouse_id || null,
        fiscal_year_start: form.fiscal_year_start || null,
        low_stock_threshold: form.low_stock_threshold
          ? Number(form.low_stock_threshold)
          : 15,
        auto_reorder: form.auto_reorder || "disabled",
      };

      const { data: json } = await api.put("/settings", payload);
      const data = json.data ?? json;
      const mapped = mapApiToForm(data);
      setForm(mapped);
      setSavedSnapshot(mapped);
      setDirty(false);
      showToast("success", "Saved", "Company settings updated successfully.");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.errors &&
          Object.values(err.response.data.errors).flat().join(" ")) ||
        err.message ||
        "Save failed";
      showToast("error", "Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(savedSnapshot);
    setDirty(false);
    showToast("info", "Reset", "Form reset to last saved values.");
  };

  if (loading) {
    return (
      <div className="system-page">
        <Sidebar />
        <div className="main-wrapper">
          <Topbar />
          <main className="content">
            <div className="page-header">
              <div>
                <h1 className="page-title">Company Settings</h1>
                <p className="page-subtitle">Loading…</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="system-page">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Company Settings</h1>
              <p className="page-subtitle">
                Organization profile for System Anchor — Naga City, Camarines Sur
                {dirty ? " · Unsaved changes" : ""}
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={saving || !dirty}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ marginBottom: 16, padding: 16 }}>
              <span style={{ color: "var(--danger, #c0392b)" }}>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ marginLeft: 12 }}
                onClick={fetchSettings}
              >
                Retry
              </button>
            </div>
          )}

          <div className="settings-layout">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Organization Profile</span>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Company Name *</label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => updateField("company_name", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Trading Name</label>
                    <input
                      type="text"
                      value={form.trading_name}
                      onChange={(e) => updateField("trading_name", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>TIN / Tax ID</label>
                    <input
                      type="text"
                      value={form.tin}
                      onChange={(e) => updateField("tin", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Industry</label>
                    <select
                      value={form.industry}
                      onChange={(e) => updateField("industry", e.target.value)}
                    >
                      <option value="Warehousing & Logistics">Warehousing & Logistics</option>
                      <option value="Wholesale Distribution">Wholesale Distribution</option>
                      <option value="Manufacturing">Manufacturing</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Primary Address</span>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-field full">
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={form.street_address}
                      onChange={(e) => updateField("street_address", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>City / Municipality</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Province</label>
                    <input
                      type="text"
                      value={form.province}
                      onChange={(e) => updateField("province", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Region</label>
                    <input
                      type="text"
                      value={form.region}
                      onChange={(e) => updateField("region", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>ZIP / Postal Code</label>
                    <input
                      type="text"
                      value={form.zip_code}
                      onChange={(e) => updateField("zip_code", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Country</label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => updateField("country", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Landmark</label>
                    <input
                      type="text"
                      value={form.landmark}
                      onChange={(e) => updateField("landmark", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Contact & Localization</span>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Website</label>
                    <input
                      type="text"
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Timezone</label>
                    <select
                      value={form.timezone}
                      onChange={(e) => updateField("timezone", e.target.value)}
                    >
                      <option value="Asia/Manila">Asia/Manila (PHT, UTC+8)</option>
                      <option value="Asia/Singapore">Asia/Singapore</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Currency</label>
                    <select
                      value={form.currency}
                      onChange={(e) => updateField("currency", e.target.value)}
                    >
                      <option value="PHP">PHP — Philippine Peso</option>
                      <option value="USD">USD — US Dollar</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Date Format</label>
                    <select
                      value={form.date_format}
                      onChange={(e) => updateField("date_format", e.target.value)}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Language</label>
                    <select
                      value={form.language}
                      onChange={(e) => updateField("language", e.target.value)}
                    >
                      <option value="English">English</option>
                      <option value="Filipino">Filipino</option>
                      <option value="Bikol">Bikol</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Operational Defaults</span>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Default Warehouse</label>
                    <select
                      value={form.default_warehouse_id}
                      onChange={(e) => updateField("default_warehouse_id", e.target.value)}
                    >
                      <option value="">— None —</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code ? `${w.code} — ${w.name}` : w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Fiscal Year Start</label>
                    <select
                      value={form.fiscal_year_start}
                      onChange={(e) => updateField("fiscal_year_start", e.target.value)}
                    >
                      <option value="January">January</option>
                      <option value="July">July</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Low Stock Threshold</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={form.low_stock_threshold}
                      onChange={(e) => updateField("low_stock_threshold", e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Auto-reorder</label>
                    <select
                      value={form.auto_reorder}
                      onChange={(e) => updateField("auto_reorder", e.target.value)}
                    >
                      <option value="disabled">Disabled</option>
                      <option value="draft_po">Draft PO when below min</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                    disabled={saving || !dirty}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      {toast && (
        <div className={`orders-toast ${toast.type}`}>
          <strong>{toast.title}</strong>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default Settings;