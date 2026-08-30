import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import api from "../api/axios";

/* ── Extract helpers ───────────────────────────────────────── */
function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as T[];
  if (Array.isArray(o.roles)) return o.roles as T[];
  if (Array.isArray(o.permissions)) return o.permissions as T[];
  if (Array.isArray(o.items)) return o.items as T[];
  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data)) return n.data as T[];
  }
  return [];
}

const STALE_MS = 60_000;
const CATALOG_STALE_MS = 5 * 60_000; // roles/perms change rarely

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  status?: "active" | "inactive";
  permission_count?: number;
  user_count?: number;
};

export type PermissionRow = {
  id: string;
  name: string;
  description: string | null;
  roles_count?: number;
};

export type RoleUserRow = {
  id: string;
  name: string;
  email: string;
  status?: string;
  role?: { id: string } | null;
  role_id?: string;
  warehouse_id?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code?: string;
    location?: string | null;
    address?: string | null;
  } | null;
  warehouses?: {
    id: string;
    name: string;
    code?: string;
    location?: string | null;
    address?: string | null;
  }[] | null;
  access_all_warehouses?: boolean;
};

export type WarehouseRow = {
  id: string;
  name: string;
  code?: string;
  location?: string | null;
  address?: string | null;
};

/* ── Roles list (with counts) ──────────────────────────────── */
export function useRolesList(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const params = useMemo(
    () =>
      ({
        per_page: 200,
        all: 1,
        sort: "name",
        dir: "asc",
        with_counts: 1,
      }) as Record<string, unknown>,
    []
  );

  const q = useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: async () => {
      const { data } = await api.get("/roles", { params });
      return data;
    },
    enabled,
    staleTime: CATALOG_STALE_MS,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<RoleRow>(q.data),
    [q.data]
  );

  return {
    rows,
    data: q.data,
    isLoading: q.isLoading && !q.data,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/* ── Full permissions catalog ──────────────────────────────── */
export function usePermissionsCatalog(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const params = useMemo(
    () => ({ per_page: 500, all: 1 }) as Record<string, unknown>,
    []
  );

  const q = useQuery({
    queryKey: queryKeys.permissions.list(params),
    queryFn: async () => {
      const { data } = await api.get("/permissions", { params });
      return data;
    },
    enabled,
    staleTime: CATALOG_STALE_MS,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<PermissionRow>(q.data),
    [q.data]
  );

  return {
    rows,
    data: q.data,
    isLoading: q.isLoading && !q.data,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/* ── Assigned permission IDs for one role ──────────────────── */
export function useRolePermissions(
  roleId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  const q = useQuery({
    queryKey: roleId
      ? queryKeys.roles.permissions(roleId)
      : ["roles", "permissions", "none"],
    queryFn: async () => {
  if (!roleId) return [] as string[];
  const { data } = await api.get(`/roles/${roleId}/permissions`);

  // Possible shapes:
  //  - Permission[] 
  //  - { data: Permission[] }
  //  - { data: { permission_ids: string[] } }
  //  - string[]
  const root = data?.data ?? data;
  if (Array.isArray(root)) {
    return root
      .map((p: any) => (typeof p === "string" ? p : String(p?.id ?? "")))
      .filter(Boolean);
  }
  if (root && typeof root === "object") {
    if (Array.isArray(root.permission_ids)) {
      return root.permission_ids.map(String).filter(Boolean);
    }
    if (Array.isArray(root.permissions)) {
      return root.permissions
        .map((p: any) => (typeof p === "string" ? p : String(p?.id ?? "")))
        .filter(Boolean);
    }
    if (Array.isArray(root.data)) {
      return root.data
        .map((p: any) => (typeof p === "string" ? p : String(p?.id ?? "")))
        .filter(Boolean);
    }
  }
  return extractArr<any>(data)
    .map((p) => (typeof p === "string" ? p : String(p?.id ?? "")))
    .filter(Boolean);
},
    enabled: enabled && !!roleId,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
  });

  const ids = useMemo(() => new Set(q.data ?? []), [q.data]);

  return {
    ids,
    data: q.data,
    isLoading: q.isLoading && !q.data,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/* ── Users assigned to a role ──────────────────────────────── */
export function useRoleUsers(
  roleId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  const q = useQuery({
    queryKey: roleId
      ? queryKeys.roles.users(roleId)
      : ["roles", "users", "none"],
    queryFn: async () => {
      if (!roleId) return [] as RoleUserRow[];
      // Prefer dedicated endpoint; fall back to filtered users list
      try {
        const { data } = await api.get(`/roles/${roleId}/users`);
        return extractArr<RoleUserRow>(data);
      } catch {
        const { data } = await api.get("/users", {
          params: { role_id: roleId, per_page: 200 },
        });
        return extractArr<RoleUserRow>(data);
      }
    },
    enabled: enabled && !!roleId,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<RoleUserRow>(q.data ?? q.data),
    [q.data]
  );

  // If queryFn already returned array, use it
  const list = useMemo(() => {
    if (Array.isArray(q.data)) return q.data as RoleUserRow[];
    return rows;
  }, [q.data, rows]);

  return {
    rows: list,
    data: q.data,
    isLoading: q.isLoading && !q.data,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/* ── Warehouses catalog (shared key with Users page) ───────── */
export function useWarehousesCatalog(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const params = useMemo(
    () => ({ per_page: 200, all: 1 }) as Record<string, unknown>,
    []
  );

  const q = useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: async () => {
      const { data: j } = await api.get("/warehouses", { params });
      const raw = Array.isArray(j)
        ? j
        : Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j?.data?.data)
            ? j.data.data
            : Array.isArray(j?.warehouses)
              ? j.warehouses
              : [];
      return (raw as any[])
        .map((w: any) => ({
          id: String(w.id ?? ""),
          name: String(w.name ?? w.code ?? ""),
          code: w.code != null ? String(w.code) : undefined,
          location: w.location ?? null,
          address: w.address ?? null,
        }))
        .filter((w) => w.id) as WarehouseRow[];
    },
    enabled,
    staleTime: CATALOG_STALE_MS,
    placeholderData: (prev) => prev,
  });

  // Shared query key may hold a raw API body from useWarehouses — always normalize to array
  const rows = useMemo(() => {
    const d = q.data as unknown;
    if (Array.isArray(d)) return d as WarehouseRow[];
    if (d && typeof d === "object") {
      const o = d as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as WarehouseRow[];
      if (Array.isArray(o.warehouses)) return o.warehouses as WarehouseRow[];
    }
    return [] as WarehouseRow[];
  }, [q.data]);

  return {
    rows,
    data: q.data,
    isLoading: q.isLoading && rows.length === 0,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}