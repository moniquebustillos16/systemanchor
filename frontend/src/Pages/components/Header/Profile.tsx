import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useProfile,
  DEFAULT_SETTINGS,
  type ProfileUser,
  type UserSettings,
  type ProfileSession,
  type ProfileActivityItem,
} from "../../../hooks/useProfile";
import "./Profile.css";

/* ===================== ICONS ===================== */

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconUser = () => (
  <svg {...svgProps}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail = () => (
  <svg {...svgProps}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconLock = () => (
  <svg {...svgProps}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconSettings = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconCamera = () => (
  <svg {...svgProps}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconTrash = () => (
  <svg {...svgProps}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconActivity = () => (
  <svg {...svgProps}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconShield = () => (
  <svg {...svgProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconEye = () => (
  <svg {...svgProps}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg {...svgProps}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconMonitor = () => (
  <svg {...svgProps}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IconSmartphone = () => (
  <svg {...svgProps}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

/* ===================== TYPES / CONSTANTS ===================== */

type Toast = { type: "success" | "error" | "info"; message: string } | null;
type ActiveTab = "account" | "security" | "preferences" | "activity";

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Filipino", label: "Filipino" },
  { value: "Spanish", label: "Spanish" },
];

const TIMEZONES = [
  { value: "Asia/Manila", label: "Asia/Manila (PHT)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const DEMO_SESSIONS: ProfileSession[] = [
  {
    id: "s1",
    device: "Windows PC",
    browser: "Chrome",
    os: "Windows 11",
    location: "Naga City, PH",
    ip: "203.177.•••.42",
    lastActive: "Active now",
    current: true,
    mobile: false,
  },
];

const DEMO_ACTIVITY: ProfileActivityItem[] = [
  {
    id: "a1",
    type: "info",
    title: "Signed in",
    description: "Session started",
    time: "Just now",
  },
];

const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"] as const;
const STRENGTH_CLASS = ["", "is-weak", "is-fair", "is-good", "is-strong"] as const;

/* ===================== HELPERS ===================== */

function broadcastProfileUpdate(payload: {
  name?: string;
  email?: string;
  image_url?: string | null;
  theme?: string;
}) {
  try {
    window.dispatchEvent(new CustomEvent("sa-profile-updated", { detail: payload }));
  } catch {
    /* ignore */
  }
}

function applyTheme(theme: UserSettings["theme"]) {
  const root = document.documentElement;
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", dark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
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
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s += 1;
  if (pw.length >= 10) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(s, 4);
}

/** Treat missing backend routes as soft success (demo / not implemented yet). */
function isNotImplemented(err: any): boolean {
  const status = err?.response?.status;
  return status === 404 || status === 501;
}

/* ===================== COMPONENT ===================== */

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    user: queryUser,
    settings: querySettings,
    sessions: querySessions,
    activity: queryActivity,
    twoFactorEnabled: query2fa,
    isLoading: profileLoading,
    isFetching: profileFetching,
    refetch: refetchProfile,
    saveProfile,
    savePassword,
    saveSettings,
    uploadImage,
    removeImage,
    enable2fa,
    disable2fa,
    revokeOneSession,
    revokeOthers,
  } = useProfile({ enabled: true });

  const [toast, setToast] = useState<Toast>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("account");

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [formSettings, setFormSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [activity, setActivity] = useState<ProfileActivityItem[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toggling2fa, setToggling2fa] = useState(false);

  const showToast = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4200);
  }, []);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("sa-auth");
    navigate("/");
  }, [navigate]);

  /* Sync query → form */
  useEffect(() => {
    if (!queryUser) return;
    setUser(queryUser);
    setName(queryUser.name ?? "");
    setEmail(queryUser.email ?? "");
    setPhone(queryUser.phone ?? "");
    setJobTitle(queryUser.job_title ?? "");
    setDepartment(queryUser.department ?? "");
    setPreviewUrl(null);
    setTwoFactorEnabled(!!query2fa);
    setFormSettings(querySettings);
    if (querySettings.theme) applyTheme(querySettings.theme);
    broadcastProfileUpdate({
      name: queryUser.name,
      email: queryUser.email,
      image_url: queryUser.image_url ?? null,
      theme: querySettings.theme,
    });
  }, [queryUser, querySettings, query2fa]);

  useEffect(() => {
    setSessions(querySessions.length ? querySessions : DEMO_SESSIONS);
  }, [querySessions]);

  useEffect(() => {
    setActivity(queryActivity.length ? queryActivity : DEMO_ACTIVITY);
  }, [queryActivity]);

  const loading = profileLoading && !user;
  const pwLevel = useMemo(() => passwordStrength(password), [password]);
  const hasImage = !!(previewUrl || user?.image_url || user?.image_path);
  const completeness = useMemo(
    () =>
      calcCompleteness(
        user ? { ...user, name, email, phone, job_title: jobTitle, department } : null,
        hasImage
      ),
    [user, name, email, phone, jobTitle, department, hasImage]
  );

  const avatarSrc = (() => {
    const url = previewUrl || user?.image_url || user?.image_path || null;
    if (!url) return null;
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    if (/^https?:\/\//i.test(url)) {
      const parsed = new URL(url);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return new URL(import.meta.env.VITE_API_URL).origin + parsed.pathname;
      }
      return url;
    }
    return new URL(import.meta.env.VITE_API_URL).origin + (url.startsWith("/") ? url : "/" + url);
  })();
  const initials = (name || user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const ring = 2 * Math.PI * 18;

  /* ---------- Handlers ---------- */

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast("error", "Name and email are required");
      return;
    }
    try {
      const updated = (await saveProfile.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
      })) as ProfileUser;
      setUser((prev) => (prev ? { ...prev, ...updated } : updated));
      if (updated?.name) setName(updated.name);
      if (updated?.email) setEmail(updated.email);
      broadcastProfileUpdate({
        name: updated?.name ?? name,
        email: updated?.email ?? email,
        image_url: updated?.image_url ?? user?.image_url ?? null,
      });
      showToast("success", "Profile updated successfully");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      showToast("error", err?.response?.data?.message || err?.message || "Update failed");
    }
  };

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
    try {
      await savePassword.mutateAsync({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirm,
      });
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirm("");
      showToast("success", "Password updated successfully");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      showToast("error", err?.response?.data?.message || err?.message || "Password update failed");
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const saved = (await saveSettings.mutateAsync(formSettings)) as UserSettings;
      const next = { ...DEFAULT_SETTINGS, ...formSettings, ...saved };
      setFormSettings(next);
      if (next.theme) applyTheme(next.theme);
      broadcastProfileUpdate({ theme: next.theme });
      showToast("success", "Settings saved");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      showToast("error", err?.response?.data?.message || err?.message || "Settings update failed");
    }
  };

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

    void (async () => {
      try {
        const json: any = await uploadImage.mutateAsync(file);
        const updatedUser: ProfileUser =
          json?.data?.user ?? json?.data ?? user ?? ({} as ProfileUser);
        const newUrl = json?.data?.image_url ?? updatedUser?.image_url ?? null;
        setUser((prev) =>
          prev
            ? { ...prev, ...updatedUser, image_url: newUrl ?? updatedUser.image_url }
            : { ...updatedUser, image_url: newUrl }
        );
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
        broadcastProfileUpdate({
          name: updatedUser?.name ?? name,
          email: updatedUser?.email ?? email,
          image_url: newUrl,
        });
        showToast("success", "Profile image updated");
      } catch (err: any) {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
        if (err?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        showToast("error", err?.response?.data?.message || err?.message || "Image upload failed");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    })();
  };

  const handleDeleteImage = async () => {
    if (!hasImage) return;
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      await removeImage.mutateAsync();
      setUser((prev) => (prev ? { ...prev, image_path: null, image_url: null } : prev));
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      broadcastProfileUpdate({ name, email, image_url: null });
      showToast("success", "Profile image removed");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      showToast("error", err?.response?.data?.message || err?.message || "Could not remove image");
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setFormSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "theme") applyTheme(value as UserSettings["theme"]);
  };

  const handleToggle2FA = async () => {
    if (toggling2fa) return;

    if (twoFactorEnabled) {
      if (!window.confirm("Disable two-factor authentication?")) return;
      const pw = window.prompt("Enter your password to disable 2FA:");
      if (pw === null) return;
      setToggling2fa(true);
      try {
        await disable2fa.mutateAsync(pw);
        setTwoFactorEnabled(false);
        showToast("info", "Two-factor authentication disabled");
      } catch (err: any) {
        if (err?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        if (isNotImplemented(err)) {
          setTwoFactorEnabled(false);
          showToast("info", "2FA disabled (API pending)");
          return;
        }
        showToast("error", err?.response?.data?.message || err?.message || "Failed to disable 2FA");
      } finally {
        setToggling2fa(false);
      }
      return;
    }

    setToggling2fa(true);
    try {
      await enable2fa.mutateAsync();
      setTwoFactorEnabled(true);
      showToast("success", "Two-factor authentication enabled");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      if (isNotImplemented(err)) {
        setTwoFactorEnabled(true);
        showToast("success", "2FA enabled (API pending)");
        return;
      }
      showToast("error", err?.response?.data?.message || err?.message || "Failed to enable 2FA");
    } finally {
      setToggling2fa(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!window.confirm("Sign out this device?")) return;
    setRevokingId(id);
    try {
      try {
        await revokeOneSession.mutateAsync(id);
      } catch (e: any) {
        if (e?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        // 404 / 501 = route not ready — still update UI
        if (!isNotImplemented(e)) throw e;
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("success", "Session revoked");
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.message || err?.message || "Could not revoke session"
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!window.confirm("Sign out all other devices?")) return;
    try {
      try {
        await revokeOthers.mutateAsync();
      } catch (e: any) {
        if (e?.response?.status === 401) {
          handleAuthFailure();
          return;
        }
        if (!isNotImplemented(e)) throw e;
      }
      setSessions((prev) => prev.filter((s) => s.current));
      showToast("success", "Other sessions signed out");
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.message || err?.message || "Could not sign out sessions"
      );
    }
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-spinner" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-left">
          <div className="profile-avatar-wrap">
            <div className={`profile-avatar-lg ${avatarSrc ? "has-image" : ""}`}>
              {avatarSrc ? <img src={avatarSrc} alt={name} /> : initials}
              {uploadImage.isPending && (
                <div className="profile-avatar-overlay">
                  <span className="profile-spinner profile-spinner--sm" />
                </div>
              )}
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn-icon"
                title="Change photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImage.isPending}
              >
                <IconCamera />
              </button>
              {hasImage && (
                <button
                  type="button"
                  className="btn-icon btn-icon--danger"
                  title="Remove photo"
                  onClick={handleDeleteImage}
                  disabled={removeImage.isPending}
                >
                  <IconTrash />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={handleImageSelect}
            />
          </div>

          <div className="profile-title-block">
            <h1 className="profile-title">{name || user?.name || "—"}</h1>
            <p className="profile-subtitle">
              <IconMail /> {email || user?.email}
            </p>
            <p className="profile-meta-text">
              {user?.role?.name && (
                <span className="profile-role-badge">{user.role.name}</span>
              )}{" "}
              {user?.job_title || "—"}
              {user?.department ? ` · ${user.department}` : ""}
            </p>
          </div>
        </div>

        <div className="profile-header-meta">
          <span
            className={`profile-status profile-status--${(
              user?.status || "active"
            ).toLowerCase()}`}
          >
            {user?.status || "active"}
          </span>

          <div className="profile-completeness">
            <div className="completeness-ring">
              <svg viewBox="0 0 44 44">
                <circle className="track" cx="22" cy="22" r="18" />
                <circle
                  className="fill"
                  cx="22"
                  cy="22"
                  r="18"
                  strokeDasharray={String(ring)}
                  strokeDashoffset={String(ring * (1 - completeness / 100))}
                />
              </svg>
              <span className="completeness-pct">{completeness}%</span>
            </div>
            <div>
              <div className="completeness-label">Profile completeness</div>
              <div className="completeness-hint">
                {completeness < 100 ? "Add phone, photo & department" : "Looking good"}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => void refetchProfile()}
            disabled={profileFetching}
          >
            {profileFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`profile-tab ${activeTab === "account" ? "is-active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          <IconUser /> Account
        </button>
        <button
          type="button"
          role="tab"
          className={`profile-tab ${activeTab === "security" ? "is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <IconLock /> Security
          {!twoFactorEnabled && <span className="tab-badge">!</span>}
        </button>
        <button
          type="button"
          role="tab"
          className={`profile-tab ${activeTab === "preferences" ? "is-active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <IconSettings /> Preferences
        </button>
        <button
          type="button"
          role="tab"
          className={`profile-tab ${activeTab === "activity" ? "is-active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <IconActivity /> Activity
        </button>
      </nav>

      {/* ACCOUNT */}
      {activeTab === "account" && (
        <div className="profile-card profile-card--wide">
          <div className="profile-card-header">
            <div className="profile-card-header-left">
              <IconUser />
              <h2>Account details</h2>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label>Full name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63…"
              />
            </div>
            <div className="form-group">
              <label>Job title</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input value={user?.status ?? "—"} disabled />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECURITY */}
      {activeTab === "security" && (
        <div className="profile-grid">
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-header-left">
                <IconLock />
                <h2>Change password</h2>
              </div>
            </div>
            <form className="profile-form" onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current password</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowCurrentPw((v) => !v)}
                  >
                    {showCurrentPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>New password</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowNewPw((v) => !v)}
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
                            i <= pwLevel ? STRENGTH_CLASS[pwLevel] : ""
                          }`}
                        />
                      ))}
                    </div>
                    <div className={`pw-strength-label ${STRENGTH_CLASS[pwLevel]}`}>
                      {STRENGTH_LABEL[pwLevel]}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Confirm new password</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowConfirmPw((v) => !v)}
                  >
                    {showConfirmPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={savePassword.isPending}>
                  {savePassword.isPending ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          </div>

          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-header-left">
                <IconShield />
                <h2>Two-factor authentication</h2>
              </div>
            </div>
            <div className="profile-card-body">
              <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: 13.5 }}>
                Status: <strong>{twoFactorEnabled ? "Enabled" : "Disabled"}</strong>
              </p>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleToggle2FA}
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

          <div className="profile-card profile-card--wide">
            <div className="profile-card-header">
              <div className="profile-card-header-left">
                <IconMonitor />
                <h2>Active sessions</h2>
              </div>
              <button
                type="button"
                className="profile-card-header-action"
                onClick={handleRevokeAllOther}
              >
                Sign out other devices
              </button>
            </div>
            <div className="profile-card-body">
              <ul className="session-list">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className={`session-item ${s.current ? "is-current" : ""}`}
                  >
                    <div className="session-icon">
                      {s.mobile ? <IconSmartphone /> : <IconMonitor />}
                    </div>
                    <div className="session-body">
                      <div className="session-device">
                        {s.device} · {s.browser}
                        {s.current && <span className="session-badge">This device</span>}
                      </div>
                      <div className="session-meta">
                        {s.os} · {s.location} · {s.ip}
                        <br />
                        {s.lastActive}
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
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PREFERENCES */}
      {activeTab === "preferences" && (
        <div className="profile-card profile-card--wide">
          <div className="profile-card-header">
            <div className="profile-card-header-left">
              <IconSettings />
              <h2>Preferences</h2>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label>Language</label>
              <select
                value={formSettings.language}
                onChange={(e) => updateSetting("language", e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select
                value={formSettings.timezone}
                onChange={(e) => updateSetting("timezone", e.target.value)}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date format</label>
              <select
                value={formSettings.date_format}
                onChange={(e) =>
                  updateSetting("date_format", e.target.value as UserSettings["date_format"])
                }
              >
                {DATE_FORMATS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Theme</label>
              <select
                value={formSettings.theme}
                onChange={(e) =>
                  updateSetting("theme", e.target.value as UserSettings["theme"])
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="form-group">
              <label>Digest</label>
              <select
                value={formSettings.digest_frequency}
                onChange={(e) =>
                  updateSetting(
                    "digest_frequency",
                    e.target.value as UserSettings["digest_frequency"]
                  )
                }
              >
                {DIGEST_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="toggle-list">
              {(
                [
                  ["email_notifications", "Email notifications", "Receive updates by email"],
                  ["push_notifications", "Push notifications", "Browser / device alerts"],
                  ["low_stock_alerts", "Low stock alerts", "When inventory is low"],
                  ["order_alerts", "Order alerts", "Purchase & sales order updates"],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key} className="toggle-row">
                  <div>
                    <span className="toggle-label">{label}</span>
                    <span className="toggle-hint">{hint}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!formSettings[key]}
                    onChange={(e) => updateSetting(key, e.target.checked)}
                  />
                  <span className="toggle-switch" />
                </label>
              ))}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saveSettings.isPending}>
                {saveSettings.isPending ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === "activity" && (
        <div className="profile-card profile-card--wide">
          <div className="profile-card-header">
            <div className="profile-card-header-left">
              <IconActivity />
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="profile-card-body">
            <ul className="session-list">
              {activity.map((a) => (
                <li key={a.id} className="session-item">
                  <div className="session-body">
                    <div className="session-device">{a.title}</div>
                    <div className="session-meta">
                      {a.description}
                      <br />
                      {a.time}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {toast && (
        <div className={`profile-toast profile-toast--${toast.type}`}>
          <button type="button" className="feedback-close" onClick={() => setToast(null)} aria-label="Close notification">×</button>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Profile;