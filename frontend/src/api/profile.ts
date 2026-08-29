import api from "./axios";

export type ProfileRole = { id: string; name: string } | null;

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  role?: ProfileRole;
  last_login_at?: string | null;
  created_at?: string;
  email_verified_at?: string | null;
  two_factor_enabled?: boolean;
};

export type UserSettings = {
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

export type ProfilePayload = {
  user: ProfileUser;
  settings: UserSettings;
};

export type ProfileSession = {
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

export type ProfileActivityItem = {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  time: string;
};

function unwrap<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in (json as object)) {
    return (json as { data: T }).data;
  }
  return json as T;
}
export async function getProfileActivity(): Promise<ProfileActivityItem[]> {
  try {
    const { data } = await api.get("/profile/activity");
    const list = (data as any)?.data ?? data;
    return Array.isArray(list) ? list : [];
  } catch (err: any) {
    const status = err?.response?.status;
    // 404 / 500 / 501 → empty list (don't break Profile)
    if (status === 404 || status === 500 || status === 501) return [];
    return [];
  }
}

export async function getTwoFactorStatus(): Promise<{ enabled: boolean }> {
  try {
    const { data } = await api.get("/profile/2fa");
    const body = (data as any)?.data ?? data;
    return { enabled: !!(body?.enabled ?? body?.two_factor_enabled) };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 500 || status === 501) {
      return { enabled: false };
    }
    return { enabled: false };
  }
}

export async function enableTwoFactor() {
  try {
    const { data } = await api.post("/profile/2fa/enable");
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 501) {
      return { ok: true, soft: true };
    }
    throw err;
  }
}

export async function disableTwoFactor(password: string) {
  try {
    const { data } = await api.post("/profile/2fa/disable", { password });
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 501) {
      return { ok: true, soft: true };
    }
    throw err;
  }
}

export async function getProfile(): Promise<ProfilePayload> {
  const { data } = await api.get("/profile");
  const body = (data as any)?.data ?? data;

  // user may be body.user or the body itself
  const rawUser = body?.user ?? body;
  const settings = body?.settings ?? {};

  const role =
    rawUser?.role ??
    body?.role ??
    (rawUser?.role_name || rawUser?.roleName
      ? { id: String(rawUser?.role_id ?? ""), name: String(rawUser.role_name || rawUser.roleName) }
      : null);

  const user: ProfileUser = {
    id: String(rawUser?.id ?? ""),
    name: String(rawUser?.name ?? ""),
    email: String(rawUser?.email ?? ""),
    status: String(rawUser?.status ?? "active"),
    phone: rawUser?.phone ?? null,
    job_title: rawUser?.job_title ?? rawUser?.jobTitle ?? null,
    department: rawUser?.department ?? null,
    image_path: rawUser?.image_path ?? null,
    image_url: rawUser?.image_url ?? null,
    role: role
      ? {
          id: String(role.id ?? role.role_id ?? ""),
          name: String(role.name ?? role.role_name ?? ""),
        }
      : null,
    last_login_at: rawUser?.last_login_at ?? null,
    created_at: rawUser?.created_at,
    email_verified_at: rawUser?.email_verified_at ?? null,
    two_factor_enabled: !!rawUser?.two_factor_enabled,
  };

  return { user, settings };
}
export async function updateProfile(body: {
  name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
}) {
  const { data } = await api.put("/profile", body);
  return unwrap<ProfileUser>(data) ?? (data as { user?: ProfileUser })?.user ?? data;
}

export async function updatePassword(body: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) {
  const { data } = await api.put("/profile/password", body);
  return data;
}

export async function updateSettings(settings: Partial<UserSettings>) {
  const { data } = await api.put("/profile/settings", settings);
  return unwrap<UserSettings>(data) ?? data;
}

export async function uploadProfileImage(file: File) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/profile/image", form);
  return data;
}

export async function deleteProfileImage() {
  const { data } = await api.delete("/profile/image");
  return data;
}

export async function getProfileSessions(): Promise<ProfileSession[]> {
  try {
    const { data } = await api.get("/profile/sessions");
    const list = (data as any)?.data ?? data;
    return Array.isArray(list) ? list : [];
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 501) return []; // backend not ready
    return [];
  }
}

export async function revokeSession(id: string) {
  try {
    const { data } = await api.delete(`/profile/sessions/${id}`);
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 501) {
      // treat as success so UI can drop the row
      return { ok: true, soft: true };
    }
    throw err;
  }
}

export async function revokeOtherSessions() {
  try {
    const { data } = await api.delete("/profile/sessions");
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 501) {
      return { ok: true, soft: true };
    }
    throw err;
  }
}



