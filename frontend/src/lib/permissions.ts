/**
 * Shared permission helpers for SystemAnchor.
 * Frontend checks are for UI visibility/navigation only.
 * Laravel remains the authoritative authorization source.
 */

export function normPerm(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const FULL_ACCESS = new Set(["*", "admin", "super_admin", "superadmin"]);

export function coercePermList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const p of raw) {
    if (typeof p === "string") {
      const n = normPerm(p);
      if (n) out.push(n);
    } else if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const name = o.name ?? o.permission ?? o.key ?? o.slug ?? o.code;
      if (typeof name === "string") {
        const n = normPerm(name);
        if (n) out.push(n);
      }
    }
  }
  return out;
}

/**
 * Extract permission name list from various Laravel /me shapes.
 */
export function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") {
    if (Array.isArray(json)) return coercePermList(json);
    return [];
  }
  const j = json as Record<string, unknown>;

  const candidates: unknown[] = [
    j.permissions,
    j.permission_names,
    (j.data as Record<string, unknown> | undefined)?.permissions,
    (j.data as Record<string, unknown> | undefined)?.permission_names,
    (j.user as Record<string, unknown> | undefined)?.permissions,
    (j.user as Record<string, unknown> | undefined)?.permission_names,
    ((j.user as Record<string, unknown> | undefined)?.role as Record<string, unknown> | undefined)
      ?.permissions,
    ((j.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | undefined)
      ?.permissions,
    ((j.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | undefined)
      ?.permission_names,
    ((j.data as Record<string, unknown> | undefined)?.role as Record<string, unknown> | undefined)
      ?.permissions,
    (j.role as Record<string, unknown> | undefined)?.permissions,
  ];

  for (const raw of candidates) {
    const list = coercePermList(raw);
    if (list.length > 0) return list;
  }

  if (Array.isArray(json)) return coercePermList(json);
  return [];
}

export function isAdminRoleName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const key = name.trim().toLowerCase();
  return (
    key === "admin" ||
    key === "administrator" ||
    key === "system admin" ||
    key === "system administrator" ||
    key === "super admin" ||
    key === "superadmin" ||
    key === "root"
  );
}

export function extractAdminFlag(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const j = json as Record<string, unknown>;
  const data = j.data as Record<string, unknown> | undefined;
  const user = (j.user || data?.user || j) as Record<string, unknown> | undefined;

  if (
    user?.is_admin === true ||
    user?.isAdmin === true ||
    data?.is_admin === true ||
    j.is_admin === true
  ) {
    return true;
  }

  const roleName =
    (user?.role as Record<string, unknown> | undefined)?.name ||
    user?.role_name ||
    (data?.role as Record<string, unknown> | undefined)?.name ||
    (j.role as Record<string, unknown> | undefined)?.name ||
    j.role_name;

  if (isAdminRoleName(roleName)) return true;

  const perms = extractPermissions(json);
  if (perms.some((p) => FULL_ACCESS.has(p) || p.endsWith(".*"))) {
    return true;
  }

  return false;
}

export type ResolvedPermissions = {
  list: string[];
  isAdmin: boolean;
};

/**
 * Resolve permission list + admin flag from a /me (or user) payload.
 * Admins are represented as list: ["*"].
 */
export function resolvePermissions(json: unknown): ResolvedPermissions {
  const admin = extractAdminFlag(json);
  if (admin) {
    return { list: ["*"], isAdmin: true };
  }
  const list = extractPermissions(json).map(normPerm);
  return { list, isAdmin: false };
}

/**
 * Try local/session storage snapshots when network /me is unavailable.
 * Mirrors the previous Sidebar offline fallback (keeps app usable).
 */
export function resolvePermissionsFromStorage(): ResolvedPermissions | null {
  if (typeof window === "undefined") return null;

  const keys = [
    "permissions",
    "user_permissions",
    "auth_permissions",
    "user",
    "auth_user",
    "authUser",
    "currentUser",
    "sa-user",
  ];

  for (const key of keys) {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.every((x: unknown) => typeof x === "string")
      ) {
        return {
          list: (parsed as string[]).map(normPerm),
          isAdmin: false,
        };
      }
      return resolvePermissions(parsed);
    } catch {
      /* try next */
    }
  }

  return null;
}

/** True when user has full access or any of the given permission names. */
export function hasAnyPermission(
  permissions: string[],
  isAdmin: boolean,
  ...names: string[]
): boolean {
  if (isAdmin || permissions.includes("*")) return true;
  const set = new Set(permissions.map(normPerm));
  return names.some((n) => set.has(normPerm(n)));
}