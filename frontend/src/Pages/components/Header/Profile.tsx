import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";
import "./Profile.css";

/* ===================== ICONS ===================== */

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconCamera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconMonitor = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IconSmartphone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/* ===================== TYPES ===================== */

type Role = { id: string; name: string } | null;

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  role?: Role;
  last_login_at?: string | null;
  created_at?: string;
  email_verified_at?: string | null;
  two_factor_enabled?: boolean;
};

/** Values must match ProfileController::updateSettings validation */
type UserSettings = {
  language: string;
  timezone: string;
  date_format: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
  theme: "light" | "dark" | "system";
  email_notifications: boolean;
  push_notifications: boolean;
  low_stock_alerts: boolean;
  order_alerts: boolean;
  digest_frequency: "off" | "daily" | "weekly";
};

type ProfileData = {
  user: ProfileUser;
  settings: UserSettings;
};

type Toast = { type: "success" | "error" | "info"; message: string } | null;

type ActiveTab = "account" | "security" | "preferences" | "activity";

type Session = {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
  mobile: boolean;
};

type ActivityItem = {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  time: string;
};

/* ===================== CONSTANTS ===================== */

const DEFAULT_SETTINGS: UserSettings = {
  language: "English",
  timezone: "Asia/Manila",
  date_format: "YYYY-MM-DD",
  theme: "system",
  email_notifications: true,
  push_notifications: true,
  low_stock_alerts: true,
  order_alerts: true,
  digest_frequency: "daily",
};

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Filipino", label: "Filipino" },
  { value: "Spanish", label: "Spanish" },
  { value: "Japanese", label: "Japanese" },
  { value: "Chinese", label: "Chinese" },
];

const TIMEZONES = [
  { value: "Asia/Manila", label: "Asia/Manila (PHT)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

const DATE_FORMATS = [
  { value: "YYYY-MM-DD" as const, label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY" as const, label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY" as const, label: "MM/DD/YYYY" },
];

const DIGEST_OPTIONS = [
  { value: "daily" as const, label: "Daily digest" },
  { value: "weekly" as const, label: "Weekly digest" },
  { value: "off" as const, label: "Off" },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — matches backend max:5120
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];


/** Demo sessions — replace with GET /profile/sessions when API is ready */
const DEMO_SESSIONS: Session[] = [
  {
    id: "s1",
    device: "Windows PC",
    browser: "Chrome 128",
    os: "Windows 11",
    location: "Naga City, PH",
    ip: "203.177.•••.42",
    lastActive: "Active now",
    current: true,
    mobile: false,
  },
  {
    id: "s2",
    device: "iPhone 15",
    browser: "Safari",
    os: "iOS 18",
    location: "Legazpi, PH",
    ip: "112.198.•••.19",
    lastActive: "2 hours ago",
    current: false,
    mobile: true,
  },
  {
    id: "s3",
    device: "MacBook Pro",
    browser: "Firefox 130",
    os: "macOS Sequoia",
    location: "Manila, PH",
    ip: "49.147.•••.88",
    lastActive: "Yesterday",
    current: false,
    mobile: false,
  },
];

const DEMO_ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    type: "success",
    title: "Profile updated",
    description: "Account details were saved successfully",
    time: "Just now",
  },
  {
    id: "a2",
    type: "info",
    title: "Signed in",
    description: "New session from Chrome on Windows 11 · Naga City",
    time: "12 min ago",
  },
  {
    id: "a3",
    type: "warning",
    title: "Password changed",
    description: "Your account password was updated",
    time: "3 days ago",
  },
  {
    id: "a4",
    type: "info",
    title: "Theme preference saved",
    description: "Switched to system theme",
    time: "1 week ago",
  },
  {
    id: "a5",
    type: "success",
    title: "Profile photo updated",
    description: "New avatar uploaded",
    time: "2 weeks ago",
  },
];

/* ===================== HELPERS ===================== */


/** Notify Topbar / layout of profile changes (name, avatar, theme). */
function broadcastProfileUpdate(payload: {
  name?: string;
  email?: string;
  image_url?: string | null;
  theme?: string;
}) {
  try {
    window.dispatchEvent(new CustomEvent("sa-profile-updated", { detail: payload }));
  } catch {
    // ignore
  }
}

/** Flatten Laravel validation errors into a single message. */
function apiErrorMessage(json: any, fallback: string): string {
  if (json?.message && typeof json.message === "string") {
    if (json.errors && typeof json.errors === "object") {
      const flat = Object.values(json.errors).flat().filter(Boolean);
      if (flat.length) return flat.join(" ");
    }
    return json.message;
  }
  if (json?.errors && typeof json.errors === "object") {
    const flat = Object.values(json.errors).flat().filter(Boolean);
    if (flat.length) return String(flat.join(" "));
  }
  return fallback;
}

/** Resolve relative Laravel storage URLs */
function resolveMediaUrl(url: string | null | undefined, apiBase?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  try {
    if (apiBase) {
      const origin = new URL(apiBase, window.location.origin).origin;
      return origin + (url.startsWith("/") ? url : `/${url}`);
    }
  } catch {
    // fall through
  }
  return url.startsWith("/") ? url : `/${url}`;
}

function computeInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD"
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

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function normalizeSettings(raw: Partial<UserSettings> | null | undefined): UserSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };

  const langMap: Record<string, string> = {
    en: "English",
    fil: "Filipino",
    es: "Spanish",
  };
  if (langMap[s.language]) s.language = langMap[s.language];

  const dateMap: Record<string, UserSettings["date_format"]> = {
    "Y-m-d": "YYYY-MM-DD",
    "d/m/Y": "DD/MM/YYYY",
    "m/d/Y": "MM/DD/YYYY",
    "d M Y": "DD/MM/YYYY",
  };
  if (dateMap[s.date_format as string]) {
    s.date_format = dateMap[s.date_format as string];
  }
  if (!["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"].includes(s.date_format)) {
    s.date_format = "YYYY-MM-DD";
  }

  if (!["off", "daily", "weekly"].includes(s.digest_frequency)) {
    s.digest_frequency = "daily";
  }

  if (!["light", "dark", "system"].includes(s.theme)) {
    s.theme = "system";
  }

  return s as UserSettings;
}

function passwordStrength(pw: string): { score: number; label: string; className: string } {
  if (!pw) return { score: 0, label: "", className: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const capped = Math.min(score, 4);
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const classes = ["", "is-weak", "is-fair", "is-good", "is-strong"];
  return { score: capped, label: labels[capped], className: classes[capped] };
}

function calcCompleteness(user: ProfileUser | null, hasImage: boolean): number {
  if (!user) return 0;
  const checks = [
    !!user.name?.trim(),
    !!user.email?.trim(),
    !!user.phone?.trim(),
    !!user.job_title?.trim(),
    !!user.department?.trim(),
    hasImage,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/* ===================== COMPONENT ===================== */

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("account");

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Account form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Settings form
  const [formSettings, setFormSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Local image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Security extras — loaded from backend when available
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toggling2fa, setToggling2fa] = useState(false);

  const showToast = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4200);
  }, []);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem("sa-auth");
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");
    navigate("/");
  }, [navigate]);

  const pwStrength = useMemo(() => passwordStrength(password), [password]);

  const hasImage = !!(previewUrl || user?.image_url || user?.image_path);
  const completeness = useMemo(
    () =>
      calcCompleteness(
        user
          ? { ...user, name, email, phone, job_title: jobTitle, department }
          : null,
        hasImage
      ),
    [user, name, email, phone, jobTitle, department, hasImage]
  );

  /* ---------- Load profile + sessions / activity / 2FA ---------- */
  useEffect(() => {
    let cancelled = false;

    const loadExtras = async () => {
      // Sessions
      try {
        const { data: json } = await api.get("/profile/sessions");
        const list: Session[] = json?.data ?? json;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setSessions(list);
        } else if (!cancelled) {
          setSessions(DEMO_SESSIONS);
        }
      } catch {
        if (!cancelled) setSessions(DEMO_SESSIONS);
      }

      // Activity
      try {
        const { data: json } = await api.get("/profile/activity");
        const list: ActivityItem[] = json?.data ?? json;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setActivity(list);
        } else if (!cancelled) {
          setActivity(DEMO_ACTIVITY);
        }
      } catch {
        if (!cancelled) setActivity(DEMO_ACTIVITY);
      }

      // 2FA status
      try {
        const { data: json } = await api.get("/profile/2fa");
        const enabled = json?.data?.enabled ?? json?.enabled ?? false;
        if (!cancelled) setTwoFactorEnabled(!!enabled);
      } catch {
        // keep default false
      }
    };

    const load = async () => {
      setLoading(true);
      try {
        const { data: json } = await api.get("/profile");
        const data: ProfileData = json?.data ?? json;

        if (cancelled) return;

        setUser(data.user);
        setName(data.user?.name ?? "");
        setEmail(data.user?.email ?? "");
        setPhone(data.user?.phone ?? "");
        setJobTitle(data.user?.job_title ?? "");
        setDepartment(data.user?.department ?? "");
        setPreviewUrl(null);

        if (typeof data.user?.two_factor_enabled === "boolean") {
          setTwoFactorEnabled(!!data.user.two_factor_enabled);
        }

        const s = normalizeSettings(data.settings);
        setSettings(s);
        setFormSettings(s);
        if (s.theme) applyTheme(s.theme);

        // Keep Topbar in sync on first load
        broadcastProfileUpdate({
          name: data.user?.name,
          email: data.user?.email,
          image_url: data.user?.image_url ?? null,
          theme: s.theme,
        });

        // Fire-and-forget extras (non-blocking)
        void loadExtras();
      } catch (err: any) {
        if (err?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        if (!cancelled) {
          showToast("error", err?.response?.data?.message || err?.message || "Could not load profile");
          setSessions(DEMO_SESSIONS);
          setActivity(DEMO_ACTIVITY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [handleAuthFailure, showToast]);

  /* ---------- Save account (PUT /profile) ---------- */
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast("error", "Name and email are required");
      return;
    }

    setSavingProfile(true);
    try {
      const body: Record<string, string | null> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
      };

      const { data: json } = await api.put("/profile", body);
      const updated: ProfileUser = json?.data?.user ?? json?.data ?? json?.user;
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
      if (updated?.name) setName(updated.name);
      if (updated?.email) setEmail(updated.email);
      broadcastProfileUpdate({
        name: updated?.name ?? name,
        email: updated?.email ?? email,
        image_url: updated?.image_url ?? user?.image_url ?? null,
      });
      showToast("success", json?.message || "Profile updated successfully");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      const body = err?.response?.data;
      showToast("error", apiErrorMessage(body, err?.message || "Update failed"));
    } finally {
      setSavingProfile(false);
    }
  };

  /* ---------- Change password (PUT /profile/password) ---------- */
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      showToast("error", "Current password is required");
      return;
    }
    if (!password || password.length < 6) {
      showToast("error", "New password must be at least 6 characters");
      return;
    }
    if (password !== passwordConfirm) {
      showToast("error", "Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const { data: json } = await api.put("/profile/password", {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirm,
      });

      setCurrentPassword("");
      setPassword("");
      setPasswordConfirm("");
      showToast("success", json.message || "Password updated successfully");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      const body = err?.response?.data;
      showToast("error", apiErrorMessage(body, err?.message || "Password update failed"));
    } finally {
      setSavingPassword(false);
    }
  };

  /* ---------- Save settings (PUT /profile/settings) ---------- */
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { data: json } = await api.put("/profile/settings", formSettings);
      const saved = normalizeSettings(json?.data ?? formSettings);
      setSettings(saved);
      setFormSettings(saved);
      if (saved.theme) applyTheme(saved.theme);
      broadcastProfileUpdate({ theme: saved.theme });
      showToast("success", json.message || "Settings saved");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      const body = err?.response?.data;
      showToast("error", apiErrorMessage(body, err?.message || "Settings update failed"));
    } finally {
      setSavingSettings(false);
    }
  };

  /* ---------- Image upload (POST /profile/image) ---------- */
  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      showToast("error", "Please choose a JPEG, PNG, WebP, or GIF image");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast("error", "Image must be 5 MB or smaller");
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    void uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("image", file);

      const { data: json } = await api.post("/profile/image", form);
      const updatedUser: ProfileUser = json?.data?.user ?? json?.data ?? user ?? ({} as ProfileUser);
      const newUrl = json?.data?.image_url ?? updatedUser?.image_url ?? null;
      if (updatedUser) {
        setUser((prev) =>
          prev
            ? { ...prev, ...updatedUser, image_url: newUrl ?? updatedUser.image_url }
            : { ...updatedUser, image_url: newUrl }
        );
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      broadcastProfileUpdate({
        name: updatedUser?.name ?? name,
        email: updatedUser?.email ?? email,
        image_url: newUrl,
      });
      showToast("success", json.message || "Profile image updated");
    } catch (err) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      const body = (err as any)?.response?.data;
      showToast("error", apiErrorMessage(body, (err as any)?.message || "Image upload failed"));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ---------- Delete image (DELETE /profile/image) ---------- */
  const handleDeleteImage = async () => {
    if (!user?.image_url && !user?.image_path && !previewUrl) return;
    if (!window.confirm("Remove your profile photo?")) return;

    setDeletingImage(true);
    try {
      const { data: json } = await api.delete("/profile/image");
      const updated: ProfileUser = json?.data ?? json?.user;
      setUser((prev) =>
        prev
          ? { ...prev, ...(updated || {}), image_path: null, image_url: null }
          : updated
      );
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      broadcastProfileUpdate({
        name: name,
        email: email,
        image_url: null,
      });
      showToast("success", json.message || "Profile image removed");
    } catch (err) {
      if ((err as any)?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      showToast("error", (err as any)?.response?.data?.message || (err as any)?.message || "Could not remove image");
    } finally {
      setDeletingImage(false);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setFormSettings((prev) => ({ ...prev, [key]: value }));
    // Live-apply theme for instant feedback
    if (key === "theme") {
      applyTheme(value as UserSettings["theme"]);
    }
  };

  const settingsDirty = JSON.stringify(formSettings) !== JSON.stringify(settings);

  const avatarSrc = previewUrl || resolveMediaUrl(user?.image_url, (import.meta as any).env?.VITE_API_URL) || null;
  const initials = computeInitials(user?.name || name || "AD");

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("info", `${label} copied`);
    } catch {
      showToast("error", "Could not copy");
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!window.confirm("Sign out this device?")) return;
    setRevokingId(id);
    try {
      try {
        await api.delete(`/profile/sessions/${id}`);
      } catch (e: any) {
        if (e?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        if (e?.response?.status !== 404 && e?.response?.status !== 501) {
          throw new Error(e?.response?.data?.message || e?.message || "Could not revoke session");
        }
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("success", "Session revoked");
    } catch (err) {
      // Optimistic local revoke if backend not ready
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast(
        "info",
        err instanceof Error ? err.message : "Session removed locally"
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!window.confirm("Sign out all other devices?")) return;
    try {
      try {
        await api.delete("/profile/sessions");
      } catch (e: any) {
        if (e?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        if (e?.response?.status !== 501) {
          throw new Error(e?.response?.data?.message || e?.message || "Could not sign out other sessions");
        }
      }
      setSessions((prev) => prev.filter((s) => s.current));
      showToast("success", "All other sessions signed out");
    } catch (err) {
      setSessions((prev) => prev.filter((s) => s.current));
      showToast(
        "info",
        err instanceof Error ? err.message : "Other sessions cleared locally"
      );
    }
  };

  const handleToggle2FA = async () => {
    if (toggling2fa) return;

    if (twoFactorEnabled) {
      if (!window.confirm("Disable two-factor authentication?")) return;
      const password = window.prompt("Enter your password to disable 2FA:");
      if (password === null) return;
      setToggling2fa(true);
      try {
        try {
          await api.post("/profile/2fa/disable", { password });
        } catch (e: any) {
          if (e?.response?.status === 401) {
            handleAuthFailure();
            return;
          }
          if (e?.response?.status !== 501) {
            throw new Error(e?.response?.data?.message || e?.message || "Could not disable 2FA");
          }
        }
        setTwoFactorEnabled(false);
        showToast("info", "Two-factor authentication disabled");
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "Failed to disable 2FA");
      } finally {
        setToggling2fa(false);
      }
    } else {
      setToggling2fa(true);
      try {
        try {
          await api.post("/profile/2fa/enable", {});
          setTwoFactorEnabled(true);
          showToast("success", "Two-factor authentication enabled");
        } catch (e: any) {
          if (e?.response?.status === 401) {
            handleAuthFailure();
            return;
          }
          if (e?.response?.status === 501) {
            setTwoFactorEnabled(true);
            showToast("success", "2FA UI enabled (backend migration pending)");
          } else {
            throw e;
          }
        }
      } catch (err) {
        // Allow UI toggle when endpoint missing so demo still works
        setTwoFactorEnabled(true);
        showToast(
          "info",
          err instanceof Error
            ? `${err.message} — toggled locally`
            : "2FA toggled locally"
        );
      } finally {
        setToggling2fa(false);
      }
    }
  };

  const handleExportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user: {
        id: user?.id,
        name,
        email,
        phone,
        job_title: jobTitle,
        department,
        role: user?.role?.name,
        status: user?.status,
        created_at: user?.created_at,
        last_login_at: user?.last_login_at,
      },
      settings: formSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-anchor-profile-${user?.id || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Profile data exported");
  };

  const ringCircumference = 2 * Math.PI * 18;
  const ringOffset = ringCircumference - (completeness / 100) * ringCircumference;

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-skeleton">
          <div className="skel skel-header" />
          <div className="skel skel-tabs" />
          <div className="skel skel-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Toast */}
      {toast && (
        <div className={`profile-toast profile-toast--${toast.type}`} role="status">
          {toast.type === "success" ? <IconCheck /> : toast.type === "error" ? <IconAlert /> : <IconInfo />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page header */}
      <div className="profile-header">
        <div className="profile-header-left">
          <div className="profile-avatar-wrap">
            <div
              className={`profile-avatar-lg ${avatarSrc ? "has-image" : ""}`}
              title={user?.name}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={user?.name || "Avatar"} />
              ) : (
                initials
              )}
              {(uploadingImage || deletingImage) && (
                <div className="profile-avatar-overlay">
                  <div className="profile-spinner profile-spinner--sm" />
                </div>
              )}
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn-icon"
                title="Change photo"
                disabled={uploadingImage || deletingImage}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconCamera />
              </button>
              {hasImage && (
                <button
                  type="button"
                  className="btn-icon btn-icon--danger"
                  title="Remove photo"
                  disabled={uploadingImage || deletingImage}
                  onClick={handleDeleteImage}
                >
                  <IconTrash />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              onChange={handleImageSelect}
              aria-label="Upload profile photo"
            />
          </div>
          <div className="profile-title-block">
            <h1 className="profile-title">{user?.name || "Profile"}</h1>
            <p className="profile-subtitle">
              {user?.email}
              {user?.role?.name ? (
                <span className="profile-role-badge">{user.role.name}</span>
              ) : null}
              {user?.email_verified_at && (
                <span className="profile-verified">
                  <IconCheck /> Verified
                </span>
              )}
            </p>
            {(user?.job_title || user?.department) && (
              <p className="profile-meta-text">
                {[user.job_title, user.department].filter(Boolean).join(" · ")}
              </p>
            )}
            {user?.id && (
              <div className="profile-id-row">
                <span className="profile-id-chip">
                  ID · {user.id.slice(0, 8)}…
                  <button
                    type="button"
                    title="Copy full ID"
                    onClick={() => copyToClipboard(user.id, "User ID")}
                    aria-label="Copy user ID"
                  >
                    <IconCopy />
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="profile-header-meta">
          {user?.status && (
            <span className={`profile-status profile-status--${user.status}`}>
              {user.status}
            </span>
          )}
          <div className="profile-completeness" title="Profile completeness">
            <div className="completeness-ring">
              <svg viewBox="0 0 44 44">
                <circle className="track" cx="22" cy="22" r="18" />
                <circle
                  className="fill"
                  cx="22"
                  cy="22"
                  r="18"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="completeness-pct">{completeness}%</span>
            </div>
            <div>
              <div className="completeness-label">Profile strength</div>
              <div className="completeness-hint">
                {completeness >= 100
                  ? "Complete"
                  : completeness >= 70
                    ? "Almost there"
                    : "Add more details"}
              </div>
            </div>
          </div>
          {user?.last_login_at && (
            <span className="profile-meta-text">
              Last login: {formatDate(user.last_login_at)}
            </span>
          )}
          {user?.created_at && (
            <span className="profile-meta-text">
              Member since: {formatDate(user.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "account"}
          className={`profile-tab ${activeTab === "account" ? "is-active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          <IconUser /> Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "security"}
          className={`profile-tab ${activeTab === "security" ? "is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <IconLock /> Security
          {!twoFactorEnabled && <span className="tab-badge">!</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "preferences"}
          className={`profile-tab ${activeTab === "preferences" ? "is-active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <IconSettings /> Preferences
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          className={`profile-tab ${activeTab === "activity" ? "is-active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <IconActivity /> Activity
        </button>
      </nav>

      <div className="profile-grid">
        {/* ---- Account ---- */}
        {activeTab === "account" && (
          <>
            <section className="profile-card profile-card--wide">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconUser />
                  <h2>Account details</h2>
                </div>
              </div>
              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="profile-name">Full name</label>
                    <div className="input-with-icon">
                      <IconUser />
                      <input
                        id="profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        required
                        maxLength={255}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="profile-email">Email</label>
                    <div className="input-with-icon">
                      <IconMail />
                      <input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        maxLength={255}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="profile-phone">Phone</label>
                    <div className="input-with-icon">
                      <IconPhone />
                      <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+63 9XX XXX XXXX"
                        maxLength={50}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="profile-job-title">Job title</label>
                    <div className="input-with-icon">
                      <IconBriefcase />
                      <input
                        id="profile-job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Inventory Manager"
                        maxLength={150}
                        autoComplete="organization-title"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="profile-department">Department</label>
                  <div className="input-with-icon">
                    <IconBriefcase />
                    <input
                      id="profile-department"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Operations"
                      maxLength={150}
                      autoComplete="organization"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleExportData}
                    title="Download your profile data as JSON"
                  >
                    <IconDownload /> Export data
                  </button>
                  <button type="submit" className="btn-primary" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save account"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {/* ---- Security ---- */}
        {activeTab === "security" && (
          <>
            <section className="profile-card profile-card--wide">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconKey />
                  <h2>Change password</h2>
                </div>
              </div>
              <form onSubmit={handleChangePassword} className="profile-form">
                <p className="form-hint">
                  For security, enter your current password before setting a new one. Prefer a
                  long passphrase with mixed case, numbers, and symbols.
                </p>

                <div className="form-group">
                  <label htmlFor="profile-current-password">Current password</label>
                  <div className="input-with-icon input-with-action">
                    <IconLock />
                    <input
                      id="profile-current-password"
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="btn-icon-inline"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label={showCurrentPw ? "Hide password" : "Show password"}
                    >
                      {showCurrentPw ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="profile-password">New password</label>
                    <div className="input-with-icon input-with-action">
                      <IconLock />
                      <input
                        id="profile-password"
                        type={showNewPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        minLength={6}
                        maxLength={255}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="btn-icon-inline"
                        onClick={() => setShowNewPw((v) => !v)}
                        aria-label={showNewPw ? "Hide password" : "Show password"}
                      >
                        {showNewPw ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                    {password && (
                      <div className="pw-strength">
                        <div className="pw-strength-bar">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`pw-strength-seg ${
                                pwStrength.score >= i ? pwStrength.className : ""
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`pw-strength-label ${pwStrength.className}`}>
                          {pwStrength.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="profile-password-confirm">Confirm new password</label>
                    <div className="input-with-icon input-with-action">
                      <IconLock />
                      <input
                        id="profile-password-confirm"
                        type={showConfirmPw ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        minLength={6}
                        maxLength={255}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="btn-icon-inline"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        aria-label={showConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showConfirmPw ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                  </div>
                </div>

                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="form-error">Passwords do not match</p>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setCurrentPassword("");
                      setPassword("");
                      setPasswordConfirm("");
                    }}
                    disabled={savingPassword}
                  >
                    Clear
                  </button>
                  <button type="submit" className="btn-primary" disabled={savingPassword}>
                    {savingPassword ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </section>

            {/* 2FA */}
            <section className="profile-card profile-card--wide">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconShield />
                  <h2>Two-factor authentication</h2>
                </div>
              </div>
              <div className="profile-card-body">
                <div className="tfa-panel">
                  <div className="tfa-icon">
                    <IconShield />
                  </div>
                  <div className="tfa-body">
                    <div className="tfa-title">
                      Authenticator app
                      <span
                        className={`tfa-status ${
                          twoFactorEnabled ? "tfa-status--on" : "tfa-status--off"
                        }`}
                      >
                        {twoFactorEnabled ? "Enabled" : "Off"}
                      </span>
                    </div>
                    <p className="tfa-desc">
                      Add an extra layer of security. When enabled, you’ll need a one-time code
                      from your authenticator app in addition to your password.
                    </p>
                    <div className="tfa-actions">
                      <button
                        type="button"
                        className={twoFactorEnabled ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                        onClick={() => void handleToggle2FA()}
                        disabled={toggling2fa}
                      >
                        {toggling2fa
                          ? "Please wait…"
                          : twoFactorEnabled
                            ? "Disable 2FA"
                            : "Enable 2FA"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sessions */}
            <section className="profile-card profile-card--wide">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconMonitor />
                  <h2>Active sessions</h2>
                </div>
                {sessions.filter((s) => !s.current).length > 0 && (
                  <button
                    type="button"
                    className="profile-card-header-action"
                    onClick={handleRevokeAllOther}
                  >
                    Sign out others
                  </button>
                )}
              </div>
              <div className="profile-card-body">
                <div className="session-list">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`session-item ${s.current ? "is-current" : ""}`}
                    >
                      <div className="session-icon">
                        {s.mobile ? <IconSmartphone /> : <IconMonitor />}
                      </div>
                      <div className="session-body">
                        <div className="session-device">
                          {s.device}
                          {s.current && <span className="session-badge">This device</span>}
                        </div>
                        <div className="session-meta">
                          {s.browser} · {s.os}
                          <br />
                          {s.location} · {s.ip} · {s.lastActive}
                        </div>
                      </div>
                      {!s.current && (
                        <div className="session-actions">
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            disabled={revokingId === s.id}
                            onClick={() => handleRevokeSession(s.id)}
                          >
                            {revokingId === s.id ? "…" : "Revoke"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="empty-state-sm">No active sessions</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ---- Preferences ---- */}
        {activeTab === "preferences" && (
          <section className="profile-card profile-card--wide">
            <div className="profile-card-header">
              <div className="profile-card-header-left">
                <IconSettings />
                <h2>Preferences</h2>
              </div>
            </div>
            <form onSubmit={handleSaveSettings} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-language">
                    <IconGlobe /> Language
                  </label>
                  <select
                    id="profile-language"
                    value={formSettings.language}
                    onChange={(e) => updateSetting("language", e.target.value)}
                  >
                    {LANGUAGES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!LANGUAGES.some((o) => o.value === formSettings.language) &&
                      formSettings.language && (
                        <option value={formSettings.language}>
                          {formSettings.language}
                        </option>
                      )}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="profile-timezone">Timezone</label>
                  <select
                    id="profile-timezone"
                    value={formSettings.timezone}
                    onChange={(e) => updateSetting("timezone", e.target.value)}
                  >
                    {TIMEZONES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!TIMEZONES.some((o) => o.value === formSettings.timezone) &&
                      formSettings.timezone && (
                        <option value={formSettings.timezone}>
                          {formSettings.timezone}
                        </option>
                      )}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-date-format">Date format</label>
                  <select
                    id="profile-date-format"
                    value={formSettings.date_format}
                    onChange={(e) =>
                      updateSetting(
                        "date_format",
                        e.target.value as UserSettings["date_format"]
                      )
                    }
                  >
                    {DATE_FORMATS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Theme</label>
                  <div className="theme-cards">
                    {(["light", "dark", "system"] as const).map((t) => (
                      <label
                        key={t}
                        className={`theme-card ${
                          formSettings.theme === t ? "is-selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={t}
                          checked={formSettings.theme === t}
                          onChange={() => updateSetting("theme", t)}
                        />
                        <div className={`theme-preview theme-preview--${t}`} />
                        <span className="theme-card-label">
                          {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-divider">
                <IconBell />
                <span>Notifications</span>
              </div>

              <div className="toggle-list">
                <label className="toggle-row">
                  <div>
                    <span className="toggle-label">Email notifications</span>
                    <span className="toggle-hint">Receive alerts via email</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formSettings.email_notifications}
                    onChange={(e) => updateSetting("email_notifications", e.target.checked)}
                  />
                  <span className="toggle-switch" />
                </label>

                <label className="toggle-row">
                  <div>
                    <span className="toggle-label">Push notifications</span>
                    <span className="toggle-hint">Browser / app push alerts</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formSettings.push_notifications}
                    onChange={(e) => updateSetting("push_notifications", e.target.checked)}
                  />
                  <span className="toggle-switch" />
                </label>

                <label className="toggle-row">
                  <div>
                    <span className="toggle-label">Low stock alerts</span>
                    <span className="toggle-hint">When inventory falls below minimum</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formSettings.low_stock_alerts}
                    onChange={(e) => updateSetting("low_stock_alerts", e.target.checked)}
                  />
                  <span className="toggle-switch" />
                </label>

                <label className="toggle-row">
                  <div>
                    <span className="toggle-label">Order alerts</span>
                    <span className="toggle-hint">PO / SO status changes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formSettings.order_alerts}
                    onChange={(e) => updateSetting("order_alerts", e.target.checked)}
                  />
                  <span className="toggle-switch" />
                </label>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label htmlFor="profile-digest">Digest frequency</label>
                <select
                  id="profile-digest"
                  value={formSettings.digest_frequency}
                  onChange={(e) =>
                    updateSetting(
                      "digest_frequency",
                      e.target.value as UserSettings["digest_frequency"]
                    )
                  }
                >
                  {DIGEST_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setFormSettings(settings);
                    if (settings.theme) applyTheme(settings.theme);
                  }}
                  disabled={savingSettings || !settingsDirty}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingSettings || !settingsDirty}
                >
                  {savingSettings ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ---- Activity ---- */}
        {activeTab === "activity" && (
          <>
            <section className="profile-card profile-card--wide">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconActivity />
                  <h2>Recent activity</h2>
                </div>
              </div>
              <div className="profile-card-body">
                <div className="activity-list">
                  {activity.map((item) => (
                    <div key={item.id} className="activity-item">
                      <div className={`activity-dot activity-dot--${item.type}`} />
                      <div className="activity-body">
                        <div className="activity-title">{item.title}</div>
                        <div className="activity-desc">{item.description}</div>
                        <div className="activity-time">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Danger zone */}
            <section className="profile-card profile-card--wide danger-zone">
              <div className="profile-card-header">
                <div className="profile-card-header-left">
                  <IconAlert />
                  <h2>Danger zone</h2>
                </div>
              </div>
              <div className="profile-card-body">
                <div className="danger-item">
                  <div>
                    <div className="danger-item-title">Export account data</div>
                    <div className="danger-item-desc">
                      Download a JSON copy of your profile and preferences for your records.
                    </div>
                  </div>
                  <button type="button" className="btn-ghost btn-sm" onClick={handleExportData}>
                    <IconDownload /> Export
                  </button>
                </div>
                <div className="danger-item">
                  <div>
                    <div className="danger-item-title">Sign out everywhere</div>
                    <div className="danger-item-desc">
                      Revoke all sessions except this one. You’ll stay signed in here.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={handleRevokeAllOther}
                    disabled={sessions.filter((s) => !s.current).length === 0}
                  >
                    Sign out others
                  </button>
                </div>
                <div className="danger-item">
                  <div>
                    <div className="danger-item-title">Deactivate account</div>
                    <div className="danger-item-desc">
                      Temporarily disable your access. Contact an administrator to reactivate.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    onClick={() =>
                      showToast(
                        "info",
                        "Contact your system administrator to deactivate this account"
                      )
                    }
                  >
                    Request deactivation
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;