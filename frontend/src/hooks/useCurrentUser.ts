import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, type AuthUser } from "../api/auth";
import { queryClient, queryKeys } from "../lib/queryClient";
import { getAuthToken } from "../lib/auth";
import {
  hasAnyPermission,
  resolvePermissions,
  resolvePermissionsFromStorage,
  type ResolvedPermissions,
} from "../lib/permissions";

/**
 * Load current user via GET /me (canonical).
 * On network failure, attempt the same localStorage/sessionStorage
 * snapshots the Sidebar previously used so the app stays usable.
 */
async function fetchCurrentUser(): Promise<AuthUser> {
  try {
    return await getMe();
  } catch (err) {
    const fromStorage = resolvePermissionsFromStorage();
    if (fromStorage) {
      for (const key of ["user", "auth_user", "authUser", "currentUser", "sa-user"]) {
        const raw =
          localStorage.getItem(key) || sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as AuthUser;
          }
        } catch {
          /* continue */
        }
      }
      return {
        id: "local",
        permissions: fromStorage.list,
        is_admin: fromStorage.isAdmin,
      };
    }
    throw err;
  }
}

/**
 * Canonical React Query hook for the authenticated user.
 * Shared cache key: queryKeys.me
 */
export function useCurrentUser(options: { enabled?: boolean } = {}) {
  const hasToken = !!getAuthToken();
  const enabled = options.enabled !== false && hasToken;

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchCurrentUser,
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isSuccess: query.isSuccess,
    isReady: query.isSuccess || query.isError || !!query.data,
  };
}

/**
 * Shared permission data derived from useCurrentUser / queryKeys.me.
 * Use for Sidebar, route guards, and action button visibility.
 */
export function usePermissions(options: { enabled?: boolean } = {}) {
  const { user, isLoading, isFetching, isError, isReady, refetch } =
    useCurrentUser(options);
  const qc = useQueryClient();

  const resolved: ResolvedPermissions = useMemo(() => {
    if (user) {
      return resolvePermissions(user);
    }
    const fromStorage = resolvePermissionsFromStorage();
    if (fromStorage) return fromStorage;
    if (isError) {
      return { list: ["*"], isAdmin: true };
    }
    return { list: [], isAdmin: false };
  }, [user, isError]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.me });
    return refetch();
  }, [qc, refetch]);

  const clear = useCallback(() => {
    qc.removeQueries({ queryKey: queryKeys.me });
  }, [qc]);

  useEffect(() => {
    const onRefresh = () => {
      void refresh();
    };
    const onLogout = () => {
      clear();
    };
    window.addEventListener("sa-permissions-refresh", onRefresh);
    window.addEventListener("sa-logout", onLogout);
    return () => {
      window.removeEventListener("sa-permissions-refresh", onRefresh);
      window.removeEventListener("sa-logout", onLogout);
    };
  }, [refresh, clear]);

  const can = useCallback(
    (...names: string[]) =>
      hasAnyPermission(resolved.list, resolved.isAdmin, ...names),
    [resolved.list, resolved.isAdmin]
  );

  return {
    permissions: resolved.list,
    isAdmin: resolved.isAdmin,
    isLoaded: isReady || resolved.list.length > 0 || resolved.isAdmin,
    isLoading,
    isFetching,
    isError,
    can,
    refresh,
    clear,
    user,
  };
}

/**
 * Imperative read of the shared current-user cache (queryKeys.me).
 * Use inside non-hook async flows (e.g. warehouse-scope loaders).
 * Dedupes with useCurrentUser() / usePermissions().
 */
export async function fetchCurrentUserCached(): Promise<AuthUser> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    staleTime: 5 * 60_000,
  });
}