import api from "./axios";
import { extractData } from "./types";
import { clearAuthToken } from "../lib/auth";

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  role_id?: string | null;
  role?: { id?: string; name?: string; permissions?: unknown[] } | null;
  permissions?: unknown[];
  permission_names?: unknown[];
  is_admin?: boolean;
  isAdmin?: boolean;
  role_name?: string;
  [key: string]: unknown;
};

/**
 * Canonical current-user fetch: GET /me (fallback GET /user).
 * Returns the user object (unwrapped from Laravel { data } when present)
 * while preserving permission-related fields that may live on the wrapper.
 */
export async function getMe(): Promise<AuthUser> {
  let raw: unknown;
  try {
    const { data } = await api.get("/me");
    raw = data;
  } catch {
    const { data } = await api.get("/user");
    raw = data;
  }

  const user = (extractData<AuthUser>(raw) ?? raw) as AuthUser;

  // If permissions only lived on the response wrapper, fold them onto the user.
  if (raw && typeof raw === "object" && user && typeof user === "object") {
    const root = raw as Record<string, unknown>;
    if (user.permissions == null && root.permissions != null) {
      user.permissions = root.permissions as unknown[];
    }
    if (user.permission_names == null && root.permission_names != null) {
      user.permission_names = root.permission_names as unknown[];
    }
    if (user.role == null && root.role != null) {
      user.role = root.role as AuthUser["role"];
    }
    if (user.is_admin == null && typeof root.is_admin === "boolean") {
      user.is_admin = root.is_admin;
    }
  }

  return user;
}

/** POST /logout — clears token/user from local + session storage. */
export async function logout(): Promise<void> {
  try {
    await api.post("/logout");
  } finally {
    clearAuthToken();
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
          const o = p as {
            name?: string;
            permission?: string;
            permission_name?: string;
          };
          return o.name || o.permission || o.permission_name || null;
        }
        return null;
      })
      .filter((x): x is string => !!x && x.length > 0);
    if (names.length > 0) return names;
  }
  return [];
}
