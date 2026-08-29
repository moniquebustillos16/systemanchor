import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import { getUsers, getUserStats, getRoles } from "../api/users";

/* ── Options ───────────────────────────────────────────────── */
export type UseUsersOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
  roleId?: string | null;
  warehouseId?: string | null;
  enabled?: boolean;
};

export type UseRolesOptions = {
  enabled?: boolean;
  perPage?: number;
};

/* ── Extract helpers ───────────────────────────────────────── */
function extractArr<T>(json: unknown): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (typeof json !== "object") return [];

  const o = json as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as T[];
  if (Array.isArray(o.items)) return o.items as T[];
  if (Array.isArray(o.results)) return o.results as T[];
  if (Array.isArray(o.rows)) return o.rows as T[];

  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (Array.isArray(n.data)) return n.data as T[];
    if (Array.isArray(n.items)) return n.items as T[];
    if (Array.isArray(n.results)) return n.results as T[];
    if (Array.isArray(n.rows)) return n.rows as T[];
  }

  return [];
}

function asStatsRecord(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const root = json as Record<string, unknown>;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }
  return root;
}

export type UserStatsView = {
  all: number;
  active: number;
  inactive: number;
  suspended: number;
};

function extractUserStats(json: unknown): UserStatsView {
  const raw = asStatsRecord(json);
  return {
    all: Number(raw.all ?? raw.total ?? 0),
    active: Number(raw.active ?? 0),
    inactive: Number(raw.inactive ?? 0),
    suspended: Number(raw.suspended ?? 0),
  };
}

function buildMeta(
  data: unknown,
  page: number,
  perPage: number,
  rowsLen: number
) {
  if (!data || Array.isArray(data)) {
    return {
      current_page: page,
      last_page: 1,
      per_page: perPage,
      total: rowsLen,
    };
  }
  const d = data as {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    meta?: {
      current_page?: number;
      last_page?: number;
      per_page?: number;
      total?: number;
    };
  };
  return {
    current_page: d.current_page ?? d.meta?.current_page ?? page,
    last_page: d.last_page ?? d.meta?.last_page ?? 1,
    per_page: d.per_page ?? d.meta?.per_page ?? perPage,
    total: d.total ?? d.meta?.total ?? rowsLen,
  };
}

const STALE_MS = 60_000;

const localKeys = {
  users: {
    all: ["users"] as const,
    stats: ["users", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["users", "list", params] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (params: Record<string, unknown>) =>
      ["roles", "list", params] as const,
  },
};

function usersListKey(params: Record<string, unknown>) {
  const qk = queryKeys as typeof queryKeys & {
    users?: { list: (p: Record<string, unknown>) => readonly unknown[] };
  };
  return qk.users?.list?.(params) ?? localKeys.users.list(params);
}

function usersStatsKey() {
  const qk = queryKeys as typeof queryKeys & {
    users?: { stats: readonly unknown[] };
  };
  return qk.users?.stats ?? localKeys.users.stats;
}

function rolesListKey(params: Record<string, unknown>) {
  const qk = queryKeys as typeof queryKeys & {
    roles?: { list: (p: Record<string, unknown>) => readonly unknown[] };
  };
  return qk.roles?.list?.(params) ?? localKeys.roles.list(params);
}

/* ── Users list ────────────────────────────────────────────── */
export function useUsers(options: UseUsersOptions = {}) {
  const {
    page = 1,
    perPage = 200,
    search = "",
    status = "",
    roleId = null,
    warehouseId = null,
    enabled = true,
  } = options;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      search: search.trim() || undefined,
      status: status && status !== "all" ? status : undefined,
      role_id: roleId || undefined,
      warehouse_id: warehouseId || undefined,
      sort: "name",
      dir: "asc",
    }),
    [page, perPage, search, status, roleId, warehouseId]
  );

  const list = useQuery({
    queryKey: usersListKey(params as Record<string, unknown>),
    queryFn: () => getUsers(params),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );
  const meta = useMemo(
    () => buildMeta(list.data, page, perPage, rows.length),
    [list.data, page, perPage, rows.length]
  );

  return {
    rows,
    meta,
    data: list.data,
    isLoading: list.isLoading && !list.data,
    isFetching: list.isFetching,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
  };
}

/* ── User stats ────────────────────────────────────────────── */
export function useUserStats(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const q = useQuery({
    queryKey: usersStatsKey(),
    queryFn: () => getUserStats(),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
  });

  const stats = useMemo(() => extractUserStats(q.data), [q.data]);

  return {
    stats,
    data: q.data,
    isLoading: q.isLoading && !q.data,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/* ── Roles (for filters / form) ────────────────────────────── */
export function useRoles(options: UseRolesOptions = {}) {
  const { enabled = true, perPage = 200 } = options;

  const params = useMemo(
    () =>
      ({
        per_page: perPage,
        all: 1,
        sort: "name",
        dir: "asc",
      }) as Record<string, unknown>,
    [perPage]
  );

  const list = useQuery({
    queryKey: rolesListKey(params),
    queryFn: () => getRoles(params),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => extractArr<Record<string, unknown>>(list.data),
    [list.data]
  );

  return {
    rows,
    data: list.data,
    isLoading: list.isLoading && !list.data,
    isFetching: list.isFetching,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
  };
}