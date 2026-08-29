import api from "./axios";
import { extractData } from "./types";

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  role_id?: string | null;
  role?: { id?: string; name?: string; permissions?: unknown[] } | null;
  permissions?: unknown[];
  [key: string]: unknown;
};

/** GET /me or /user — current authenticated user + permissions payload. */
export async function getMe(): Promise<AuthUser> {
  try {
    const { data } = await api.get("/me");
    return extractData<AuthUser>(data) ?? (data as AuthUser);
  } catch {
    const { data } = await api.get("/user");
    return extractData<AuthUser>(data) ?? (data as AuthUser);
  }
}

/** POST /logout */
export async function logout(): Promise<void> {
  try {
    await api.post("/logout");
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  }
}

/** GET /roles/{roleId}/permissions — names list when not embedded on /me. */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const { data: json } = await api.get(`/roles/${roleId}/permissions`);
  const root = json as Record<string, unknown>;
  const candidates = [
    root.data,
    root.permissions,
    (root.data as Record<string, unknown> | undefined)?.permissions,
    (root.data as Record<string, unknown> | undefined)?.data,
  ];

  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    const names = c
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const o = p as { name?: string; permission?: string; permission_name?: string };
          return o.name || o.permission || o.permission_name || null;
        }
        return null;
      })
      .filter((x): x is string => !!x && x.length > 0);
    if (names.length > 0) return names;
  }
  return [];
}