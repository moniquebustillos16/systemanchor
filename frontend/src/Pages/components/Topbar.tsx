import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { getAuthToken, clearAuthToken } from "../../lib/auth";
import { useProfile } from "../../hooks/useProfile";
import { usePermissions } from "../../hooks/useCurrentUser";
import "../css/Topbar.css";

/* ===================== ICONS ===================== */

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconPackage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconTruck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconWarehouse = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconAlertTriangle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ===================== SEARCH / NOTIFS ===================== */

type SearchHit = {
  type: string;
  label: string;
  page: string;
  subtitle?: string;
};

const SEARCH_INDEX: SearchHit[] = [
  { type: "Product", label: "SKU-10001 — Industrial Widget Pro", page: "/products", subtitle: "In stock · WH-Naga" },
  { type: "Product", label: "SKU-10002 — Heavy Duty Conveyor Belt", page: "/products", subtitle: "Low stock" },
  { type: "Product", label: "SKU-10003 — Safety Helmet Pack (10)", page: "/products", subtitle: "Below min (15/50)" },
  { type: "Product", label: "SKU-10004 — Stainless Steel Fastener Kit", page: "/products", subtitle: "In stock" },
  { type: "PO", label: "PO-2026-0841 — TechParts Inc", page: "/purchase-orders", subtitle: "Pending receipt" },
  { type: "PO", label: "PO-2026-0840 — MechSupply Co", page: "/purchase-orders", subtitle: "Received" },
  { type: "SO", label: "SO-2026-2105 — Apex Manufacturing", page: "/sales-orders", subtitle: "Processing" },
  { type: "SO", label: "SO-2026-2104 — Summit Retail Group", page: "/sales-orders", subtitle: "Shipped" },
  { type: "Warehouse", label: "WH-Naga — Naga Main Hub", page: "/warehouses", subtitle: "87% capacity" },
  { type: "Warehouse", label: "WH-Legazpi — Legazpi Depot", page: "/warehouses", subtitle: "62% capacity" },
  { type: "Supplier", label: "TechParts Inc", page: "/suppliers", subtitle: "Active" },
  { type: "Supplier", label: "MechSupply Co", page: "/suppliers", subtitle: "Active" },
  { type: "Customer", label: "Apex Manufacturing", page: "/customers", subtitle: "Preferred" },
  { type: "Customer", label: "Summit Retail Group", page: "/customers", subtitle: "Active" },
];

const TYPE_ICON: Record<string, () => ReactElement> = {
  Product: IconPackage,
  PO: IconTruck,
  SO: IconTruck,
  Warehouse: IconWarehouse,
  Supplier: IconUsers,
  Customer: IconUsers,
};

type Notif = {
  id: string;
  type: "warning" | "success" | "info" | "danger";
  title: string;
  msg: string;
  time: string;
  read: boolean;
  page?: string;
};

const INITIAL_NOTIFS: Notif[] = [
  {
    id: "demo-1",
    type: "warning",
    title: "Low stock alert",
    msg: "SKU-10003 Safety Helmet Pack is below minimum (15 / 50)",
    time: "12 min ago",
    read: false,
    page: "/products",
  },
  {
    id: "demo-2",
    type: "info",
    title: "PO received",
    msg: "PO-2026-0840 from MechSupply Co marked received",
    time: "1 hr ago",
    read: false,
    page: "/purchase-orders",
  },
  {
    id: "demo-3",
    type: "success",
    title: "Shipment completed",
    msg: "SO-2026-2103 to Global Logistics Corp shipped",
    time: "3 hr ago",
    read: false,
    page: "/shipping",
  },
  {
    id: "demo-4",
    type: "warning",
    title: "Capacity alert",
    msg: "WH-Naga utilization at 87%",
    time: "Yesterday",
    read: true,
    page: "/capacity",
  },
  {
    id: "demo-5",
    type: "danger",
    title: "Failed receipt",
    msg: "PO-2026-0838 quantity mismatch on line 3",
    time: "2 days ago",
    read: true,
    page: "/purchase-orders",
  },
];

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  if (sec < 172800) return "Yesterday";
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString();
}

function mapApiNotif(row: any): Notif {
  const type = ["warning", "success", "info", "danger"].includes(row.type) ? row.type : "info";
  return {
    id: String(row.id),
    type,
    title: row.title ?? "",
    msg: row.message ?? row.msg ?? "",
    time: formatRelativeTime(row.created_at) || row.time || "",
    read: Boolean(row.is_read ?? row.read),
    page: row.page || undefined,
  };
}

const NOTIF_COLORS: Record<string, string> = {
  warning: "#C49A5A",
  success: "#5A9A6E",
  info: "#9A6B45",
  danger: "#C07060",
};

const NOTIF_ICONS: Record<string, () => ReactElement> = {
  warning: IconAlertTriangle,
  success: IconCheck,
  info: IconInfo,
  danger: IconAlertTriangle,
};

/* ===================== HELPERS ===================== */

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const base =
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
      "http://127.0.0.1:8000/api";
    const origin = new URL(base, window.location.origin).origin;
    return origin + (url.startsWith("/") ? url : `/${url}`);
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

function computeInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function applyTheme(theme: "light" | "dark" | "system") {
  let resolved: "light" | "dark" = "light";
  if (theme === "dark") resolved = "dark";
  else if (theme === "light") resolved = "light";
  else {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem("sa-theme", resolved);
  return resolved;
}

function isCanceled(err: unknown): boolean {
  const e = err as any;
  return e?.name === "CanceledError" || e?.code === "ERR_CANCELED" || e?.name === "AbortError";
}

/* ===================== NOTIF CACHE ===================== */

type CacheEntry<T> = { data: T; at: number };

const NOTIFS_TTL_MS = 45_000;
const UNREAD_POLL_MS = 45_000;
const REQUEST_TIMEOUT_MS = 20_000;

const notifsCache: {
  entry: CacheEntry<{ list: Notif[]; fromApi: boolean }> | null;
  inflight: Promise<{ list: Notif[]; fromApi: boolean }> | null;
} = { entry: null, inflight: null };

const unreadCache: {
  entry: CacheEntry<number> | null;
  inflight: Promise<number> | null;
  lastKnown: number;
} = { entry: null, inflight: null, lastKnown: -1 };

let topbarBootstrapStarted = false;

function isFresh<T>(entry: CacheEntry<T> | null, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.at < ttl;
}

function extractNotifRows(json: any): any[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json)) return json;
  return [];
}

async function fetchNotificationsOnce(force = false): Promise<{ list: Notif[]; fromApi: boolean }> {
  if (!force && isFresh(notifsCache.entry, NOTIFS_TTL_MS)) return notifsCache.entry.data;
  if (notifsCache.inflight) return notifsCache.inflight;

  const token = getAuthToken();
  if (!token) {
    const fallback = { list: INITIAL_NOTIFS, fromApi: false };
    notifsCache.entry = { data: fallback, at: Date.now() };
    return fallback;
  }

  const request = (async () => {
    try {
      const { data: json } = await api.get("/notifications", {
        params: { per_page: 30 },
        timeout: REQUEST_TIMEOUT_MS,
      });
      const mapped = extractNotifRows(json).map(mapApiNotif);
      const result = { list: mapped, fromApi: true };
      notifsCache.entry = { data: result, at: Date.now() };
      const unread = mapped.filter((n) => !n.read).length;
      unreadCache.entry = { data: unread, at: Date.now() };
      unreadCache.lastKnown = unread;
      return result;
    } catch (err) {
      if (isCanceled(err) && notifsCache.entry) return notifsCache.entry.data;
      if (notifsCache.entry) return notifsCache.entry.data;
      const fallback = { list: INITIAL_NOTIFS, fromApi: false };
      notifsCache.entry = { data: fallback, at: Date.now() };
      return fallback;
    } finally {
      notifsCache.inflight = null;
    }
  })();

  notifsCache.inflight = request;
  return request;
}

async function fetchUnreadCountOnce(force = false): Promise<number> {
  if (!force && isFresh(unreadCache.entry, NOTIFS_TTL_MS)) return unreadCache.entry.data;
  if (unreadCache.inflight) return unreadCache.inflight;

  const token = getAuthToken();
  if (!token) return 0;

  const request = (async () => {
    try {
      const { data: json } = await api.get("/notifications/unread-count", {
        timeout: REQUEST_TIMEOUT_MS,
      });
      const count = Number(json?.data?.unread_count ?? json?.unread_count ?? 0);
      unreadCache.entry = { data: count, at: Date.now() };
      return count;
    } catch (err) {
      if (isCanceled(err) && unreadCache.entry) return unreadCache.entry.data;
      if (unreadCache.entry) return unreadCache.entry.data;
      return unreadCache.lastKnown >= 0 ? unreadCache.lastKnown : 0;
    } finally {
      unreadCache.inflight = null;
    }
  })();

  unreadCache.inflight = request;
  return request;
}

function invalidateNotifCaches() {
  notifsCache.entry = null;
  unreadCache.entry = null;
}

/* ===================== COMPONENT ===================== */

type TopbarProps = {
  userName?: string;
  userInitials?: string;
  userEmail?: string;
  userImageUrl?: string;
  onLogout?: () => void;
  syncProfile?: boolean;
};

function Topbar({
  userName: propUserName,
  userInitials: propUserInitials,
  userEmail: propUserEmail,
  userImageUrl: propUserImageUrl,
  onLogout,
  syncProfile = true,
}: TopbarProps = {}) {
  const navigate = useNavigate();
  const { isAdmin, can } = usePermissions();
  const canCompanySettings =
    isAdmin ||
    can(
      "settings.view",
      "setting.view",
      "config.view",
      "company.view",
      "system.view"
    );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isDark, setIsDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>(() =>
    notifsCache.entry ? notifsCache.entry.data.list : []
  );
  const [notifsLoading, setNotifsLoading] = useState(() => !notifsCache.entry);
  const [notifsFromApi, setNotifsFromApi] = useState(() =>
    notifsCache.entry ? notifsCache.entry.data.fromApi : false
  );

  /* No loading state — show empty until data arrives, or last known name */
  const [displayName, setDisplayName] = useState(propUserName ?? "");
  const [displayEmail, setDisplayEmail] = useState(propUserEmail ?? "");
  const [displayInitials, setDisplayInitials] = useState(
    propUserInitials ?? (propUserName ? computeInitials(propUserName) : "")
  );
  const [displayImage, setDisplayImage] = useState<string | null>(
    propUserImageUrl ? resolveMediaUrl(propUserImageUrl) : null
  );
  const [roleName, setRoleName] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const [badgePulse, setBadgePulse] = useState(false);
  const prevUnreadRef = useRef(0);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBadgePulse(true);
      const t = setTimeout(() => setBadgePulse(false), 900);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* Profile: minimal = only GET /profile (no sessions/activity/2fa) */
  const { user: profileUser, settings: profileSettings } = useProfile({
    enabled: syncProfile,
    minimal: true,
  });

  useEffect(() => {
    if (!profileUser) return;

    if (profileUser.name && !propUserName) {
      setDisplayName(profileUser.name);
      setDisplayInitials(computeInitials(profileUser.name));
    }
    if (profileUser.email != null && !propUserEmail) {
      setDisplayEmail(profileUser.email);
    }
    if (profileUser.image_url !== undefined && !propUserImageUrl) {
      setDisplayImage(resolveMediaUrl(profileUser.image_url) || null);
    }
    if (profileUser.role?.name) {
      setRoleName(profileUser.role.name);
    }
    if (profileSettings?.theme) {
      const resolved = applyTheme(profileSettings.theme);
      setIsDark(resolved === "dark");
    }
  }, [profileUser, profileSettings, propUserName, propUserEmail, propUserImageUrl]);

  /* Live updates when Profile page saves */
  useEffect(() => {
    const onProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        name?: string;
        email?: string;
        image_url?: string | null;
        theme?: "light" | "dark" | "system";
      } | undefined;
      if (!detail) return;

      if (detail.name) {
        setDisplayName(detail.name);
        setDisplayInitials(computeInitials(detail.name));
      }
      if (detail.email !== undefined) setDisplayEmail(detail.email || "");
      if (detail.image_url !== undefined) {
        setDisplayImage(resolveMediaUrl(detail.image_url) || null);
      }
      if (detail.theme) {
        const resolved = applyTheme(detail.theme);
        setIsDark(resolved === "dark");
      }
    };

    window.addEventListener("sa-profile-updated", onProfileUpdated);
    return () => window.removeEventListener("sa-profile-updated", onProfileUpdated);
  }, []);

  useEffect(() => {
    if (propUserName) {
      setDisplayName(propUserName);
      setDisplayInitials(propUserInitials ?? computeInitials(propUserName));
    }
  }, [propUserName, propUserInitials]);

  useEffect(() => {
    if (propUserEmail !== undefined) setDisplayEmail(propUserEmail);
  }, [propUserEmail]);

  useEffect(() => {
    if (propUserImageUrl !== undefined) {
      setDisplayImage(resolveMediaUrl(propUserImageUrl) || null);
    }
  }, [propUserImageUrl]);

  useEffect(() => {
    const stored = localStorage.getItem("sa-theme");
    const dark = stored === "dark";
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  const toggleDarkMode = async () => {
    const next = !isDark;
    setIsDark(next);
    const themeValue = next ? "dark" : "light";
    applyTheme(themeValue);

    if (!getAuthToken()) return;
    try {
      await api.put("/profile/settings", { theme: themeValue }, { timeout: REQUEST_TIMEOUT_MS });
    } catch {
      /* local theme kept */
    }
  };

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setActiveIndex(-1);
    if (!q || q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const ql = q.toLowerCase();
    const hits = SEARCH_INDEX.filter(
      (r) =>
        r.label.toLowerCase().includes(ql) ||
        r.type.toLowerCase().includes(ql) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(ql))
    ).slice(0, 8);
    setResults(hits);
    setShowResults(true);
  }, []);

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <span className="search-highlight">{text.slice(i, i + q.length)}</span>
        {text.slice(i + q.length)}
      </>
    );
  };

  const goToResult = (hit: SearchHit) => {
    setShowResults(false);
    setQuery("");
    setActiveIndex(-1);
    navigate(hit.page);
  };

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) {
      if (e.key === "Escape") {
        setShowResults(false);
        searchRef.current?.blur();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToResult(results[activeIndex]);
    } else if (e.key === "Escape") {
      setShowResults(false);
      setActiveIndex(-1);
    }
  };

  const applyNotifs = useCallback((list: Notif[], fromApi: boolean) => {
    if (!mountedRef.current) return;
    setNotifications(list);
    setNotifsFromApi(fromApi);
    setNotifsLoading(false);
  }, []);

  const loadNotifications = useCallback(
    async (force = false) => {
      if (!force && isFresh(notifsCache.entry, NOTIFS_TTL_MS)) {
        applyNotifs(notifsCache.entry.data.list, notifsCache.entry.data.fromApi);
        return;
      }
      if (!force && notifsCache.entry) {
        applyNotifs(notifsCache.entry.data.list, notifsCache.entry.data.fromApi);
      } else if (!notifsCache.entry) {
        setNotifsLoading(true);
      }
      const result = await fetchNotificationsOnce(force);
      applyNotifs(result.list, result.fromApi);
    },
    [applyNotifs]
  );

  useEffect(() => {
    if (topbarBootstrapStarted) {
      if (notifsCache.entry) {
        applyNotifs(notifsCache.entry.data.list, notifsCache.entry.data.fromApi);
      } else if (notifsCache.inflight) {
        notifsCache.inflight.then((r) => applyNotifs(r.list, r.fromApi)).catch(() => {});
      }
      return;
    }
    topbarBootstrapStarted = true;

    if (notifsCache.entry) {
      applyNotifs(notifsCache.entry.data.list, notifsCache.entry.data.fromApi);
      return;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) void loadNotifications(false);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 1800);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [loadNotifications, applyNotifs]);

  useEffect(() => {
    if (!notifOpen) return;
    if (isFresh(notifsCache.entry, NOTIFS_TTL_MS)) return;
    void loadNotifications(false);
  }, [notifOpen, loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || cancelled || !getAuthToken()) return;
      try {
        const count = await fetchUnreadCountOnce(true);
        if (cancelled) return;
        const prev = unreadCache.lastKnown;
        if (prev === -1) {
          unreadCache.lastKnown = count;
          if (!notifsCache.entry) await loadNotifications(false);
          return;
        }
        if (count !== prev) {
          unreadCache.lastKnown = count;
          await loadNotifications(true);
        }
      } catch {
        /* ignore */
      }
    };
    const boot = setTimeout(tick, 12_000);
    const id = window.setInterval(tick, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const onRefresh = () => {
      invalidateNotifCaches();
      void loadNotifications(true);
    };
    window.addEventListener("sa-notifications-refresh", onRefresh);
    return () => window.removeEventListener("sa-notifications-refresh", onRefresh);
  }, [loadNotifications]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (isFresh(notifsCache.entry, NOTIFS_TTL_MS)) return;
      void loadNotifications(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadNotifications]);

  const syncNotifCacheFromState = (list: Notif[]) => {
    notifsCache.entry = {
      data: { list, fromApi: notifsFromApi },
      at: Date.now(),
    };
    const unread = list.filter((n) => !n.read).length;
    unreadCache.entry = { data: unread, at: Date.now() };
    unreadCache.lastKnown = unread;
  };

  const markAllRead = async () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      syncNotifCacheFromState(next);
      return next;
    });
    if (!notifsFromApi) return;
    try {
      await api.post("/notifications/read-all", null, { timeout: REQUEST_TIMEOUT_MS });
    } catch {
      /* optimistic */
    }
  };

  const markOneRead = async (id: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, read: true } : x));
      syncNotifCacheFromState(next);
      return next;
    });
    if (!notifsFromApi) return;
    try {
      await api.post(`/notifications/${id}/read`, null, { timeout: REQUEST_TIMEOUT_MS });
    } catch {
      /* optimistic */
    }
  };

  const dismissNotif = async (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => {
      const next = prev.filter((x) => x.id !== id);
      syncNotifCacheFromState(next);
      return next;
    });
    if (!notifsFromApi) return;
    try {
      await api.delete(`/notifications/${id}`, { timeout: REQUEST_TIMEOUT_MS });
    } catch {
      /* optimistic */
    }
  };

  const openNotif = async (n: Notif) => {
    setNotifications((prev) => {
      const next = prev.map((x) => (x.id === n.id ? { ...x, read: true } : x));
      syncNotifCacheFromState(next);
      return next;
    });
    setNotifOpen(false);
    if (notifsFromApi && !n.read) {
      try {
        await api.post(`/notifications/${n.id}/read`, null, { timeout: REQUEST_TIMEOUT_MS });
      } catch {
        /* ignore */
      }
    }
    if (n.page) navigate(n.page);
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowResults(false);
        setNotifOpen(false);
        setUserOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      const t = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(t)) {
        setShowResults(false);
        setActiveIndex(-1);
      }
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || !resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

    const handleLogout = () => {
    setUserOpen(false);
    notifsCache.entry = null;
    notifsCache.inflight = null;
    unreadCache.entry = null;
    unreadCache.inflight = null;
    unreadCache.lastKnown = -1;
    topbarBootstrapStarted = false;
    window.dispatchEvent(new Event("sa-logout"));
    if (onLogout) onLogout();
    else {
      clearAuthToken();
      navigate("/");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setActiveIndex(-1);
    searchRef.current?.focus();
  };

  const groupedResults = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const r of results) {
      const list = map.get(r.type) || [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }, [results]);

  const shownName = displayName || propUserName || "";
  const shownInitials =
    displayInitials ||
    propUserInitials ||
    (shownName ? computeInitials(shownName) : "");

  return (
    <header className="header">
      <div className="global-search" ref={searchWrapRef}>
        <button
          type="button"
          className="search-icon-btn"
          onClick={() => searchRef.current?.focus()}
          aria-label="Focus search"
          tabIndex={-1}
        >
          <IconSearch />
        </button>
        <input
          ref={searchRef}
          type="text"
          id="global-search"
          placeholder="Search products, orders, suppliers, locations"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onKeyDown={onSearchKeyDown}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="search-results-list"
          aria-expanded={showResults}
        />
        {query && (
          <button type="button" className="search-clear" onClick={clearSearch} aria-label="Clear search">
            <IconX />
          </button>
        )}
        <div
          className={`search-results ${showResults ? "show" : ""}`}
          id="search-results-list"
          role="listbox"
          ref={resultsRef}
        >
          {results.length === 0 && query.length >= 2 ? (
            <div className="search-result-item search-empty">
              <span className="fw-600">No matches</span>
              <span className="text-muted">Try a SKU, order ID, or partner name</span>
            </div>
          ) : (
            (() => {
              let flatIndex = 0;
              return Array.from(groupedResults.entries()).map(([type, hits]) => (
                <div key={type} className="search-group">
                  <div className="search-group-label">{type}</div>
                  {hits.map((r) => {
                    const idx = flatIndex++;
                    const TypeIcon = TYPE_ICON[r.type] || IconPackage;
                    return (
                      <div
                        key={`${r.type}-${r.label}`}
                        data-index={idx}
                        className={`search-result-item ${activeIndex === idx ? "is-active" : ""}`}
                        onClick={() => goToResult(r)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        role="option"
                        aria-selected={activeIndex === idx}
                      >
                        <span className="search-result-icon">
                          <TypeIcon />
                        </span>
                        <span className="search-result-text">
                          <span className="search-result-label">{highlightMatch(r.label, query)}</span>
                          {r.subtitle && <span className="search-result-sub">{r.subtitle}</span>}
                        </span>
                        <span className="search-result-type">{r.type}</span>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
          {results.length > 0 && (
            <div className="search-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>Enter</kbd> open
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="header-actions">
        <button
          className="header-btn"
          type="button"
          onClick={toggleDarkMode}
          data-tooltip={isDark ? "Light theme" : "Dark theme"}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>

        <div className="notif-wrap" ref={notifRef}>
          <button
            className="header-btn"
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setUserOpen(false);
            }}
            data-tooltip="Notifications"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notifOpen}
          >
            <IconBell />
            {unreadCount > 0 && (
              <span className={`dot${badgePulse ? " pulse" : ""}`} id="notif-dot">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <div className={`notif-panel ${notifOpen ? "show" : ""}`}>
            <div className="notif-header">
              <span className="fw-600">
                Notifications
                {unreadCount > 0 && <span className="notif-count-badge">{unreadCount}</span>}
              </span>
              {unreadCount > 0 && (
                <button type="button" className="mark-read-btn" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="notif-list">
              {notifsLoading ? (
                <div className="notif-loading">
                  <div className="notif-loading-row" />
                  <div className="notif-loading-row" />
                  <div className="notif-loading-row" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <IconBell />
                  </div>
                  <div className="empty-state-title">All caught up</div>
                  <div className="empty-state-msg">No notifications right now</div>
                </div>
              ) : (
                notifications.map((n) => {
                  const NIcon = NOTIF_ICONS[n.type] || IconInfo;
                  return (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? "" : "unread"}`}
                      onClick={() => openNotif(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openNotif(n);
                        }
                      }}
                    >
                      <div
                        className="notif-icon"
                        style={{ background: NOTIF_COLORS[n.type] || NOTIF_COLORS.info }}
                      >
                        <NIcon />
                      </div>
                      <div className="notif-body">
                        <div className="notif-title-row">
                          <div className="notif-title">{n.title}</div>
                          <div className="notif-item-actions">
                            {!n.read && (
                              <button
                                type="button"
                                className="notif-action-btn"
                                title="Mark as read"
                                onClick={(e) => markOneRead(n.id, e)}
                                aria-label="Mark as read"
                              >
                                <IconCheck />
                              </button>
                            )}
                            <button
                              type="button"
                              className="notif-action-btn"
                              title="Dismiss"
                              onClick={(e) => dismissNotif(n.id, e)}
                              aria-label="Dismiss notification"
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                        <div className="notif-msg">{n.msg}</div>
                        <div className="notif-time">
                          {n.time}
                          {n.page ? (
                            <span className="notif-open-hint">
                              {" "}
                              · Open <IconChevronRight />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="notif-footer">
              <button
                type="button"
                className="notif-footer-link"
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/profile");
                }}
              >
                View activity
              </button>
            </div>
          </div>
        </div>

        <div className="user-menu" ref={userRef}>
          <div
            className={`user-avatar ${displayImage ? "has-image" : ""}`}
            onClick={() => {
              setUserOpen((v) => !v);
              setNotifOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-haspopup="true"
            aria-expanded={userOpen}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setUserOpen((v) => !v);
              }
            }}
            title={shownName || undefined}
          >
            {displayImage ? <img src={displayImage} alt="" /> : shownInitials || "?"}
          </div>
          <div className={`dropdown-menu ${userOpen ? "show" : ""}`} id="user-dropdown">
            <div className="dropdown-user-info">
              <div className="dropdown-user-avatar">
                {displayImage ? <img src={displayImage} alt="" /> : <span>{shownInitials || "?"}</span>}
              </div>
              <div className="dropdown-user-meta">
                <div className="dropdown-user-name">{shownName || "\u00A0"}</div>
                {displayEmail ? <div className="dropdown-user-email">{displayEmail}</div> : null}
                {roleName ? <div className="dropdown-user-role">{roleName}</div> : null}
              </div>
            </div>
            <div className="dropdown-divider" />
            <div
              className="dropdown-item"
              onClick={() => {
                setUserOpen(false);
                navigate("/profile");
              }}
              role="menuitem"
            >
              <IconUser /> Profile Settings
            </div>
            {canCompanySettings && (
              <div
                className="dropdown-item"
                onClick={() => {
                  setUserOpen(false);
                  navigate("/company-settings");
                }}
                role="menuitem"
              >
                <IconSettings /> Company Settings
              </div>
            )}
            <div className="dropdown-divider" />
            <div className="dropdown-item dropdown-item--danger" onClick={handleLogout} role="menuitem">
              <IconLogout /> Sign Out
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;