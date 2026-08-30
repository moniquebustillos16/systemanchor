import { queryClient, queryKeys } from "./queryClient";
import { resolvePermissionsFromStorage, hasAnyPermission } from "./permissions";
import { ROUTE_VIEW } from "./routePermissions";

/**
 * Background-warm the TanStack Query cache right after login, for the
 * pages people land on most: Dashboard and Inventory.
 *
 * Kept deliberately small — this used to prefetch ~15 modules (orders,
 * warehouses, users, roles, permissions, etc.) unconditionally, which
 * fired a burst of requests for pages a given user often can't even see.
 * If you need to warm more modules, add them here ONE at a time and gate
 * each behind the same permission check used below, so we never fetch
 * data for a page the current user isn't allowed to open.
 */
export async function prefetchAppData(): Promise<void> {
  const perms = resolvePermissionsFromStorage();
  const list = perms?.list ?? [];
  const isAdmin = perms?.isAdmin ?? false;

  const canView = (path: keyof typeof ROUTE_VIEW) =>
    hasAnyPermission(list, isAdmin, ...ROUTE_VIEW[path]);

  const tasks: Promise<unknown>[] = [];

  // Dashboard — nearly everyone lands here first after login.
  if (canView("/dashboard")) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard("7m"),
        queryFn: async () => {
          const { default: api } = await import("../api/axios");
          const { data } = await api.get("/dashboard", { params: { range: "7m" } });
          return data;
        },
        staleTime: 60_000,
      })
    );
  }

  // Inventory list + stats — the other most-visited page.
  if (canView("/products")) {
    const invListParams = { page: 1, per_page: 15, sort: "updated_at", dir: "desc" };

    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.inventory.list(invListParams as Record<string, unknown>),
        queryFn: async () => {
          const { default: api } = await import("../api/axios");
          const { data } = await api.get("/inventories", { params: invListParams });
          return data;
        },
        staleTime: 60_000,
      })
    );

    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.inventory.stats,
        queryFn: async () => {
          const { default: api } = await import("../api/axios");
          const { data } = await api.get("/inventories/stats");
          return data;
        },
        staleTime: 60_000,
      })
    );
  }

  // Fire-and-forget: log failures for visibility, but never block on them
  // or let one failed prefetch stop the others (they already run in
  // parallel via Promise.allSettled below).
  const results = await Promise.allSettled(tasks);
  results.forEach((r) => {
    if (r.status === "rejected") {
      console.warn("[prefetch] a background prefetch failed (non-fatal):", r.reason);
    }
  });
}

/** Idle-friendly wrapper — waits a tick so the first paint wins. */
export function schedulePrefetch(delayMs = 800): void {
  if (typeof window === "undefined") return;

  const run = () => {
    void prefetchAppData();
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: delayMs + 1500 });
  } else {
    window.setTimeout(run, delayMs);
  }
}
