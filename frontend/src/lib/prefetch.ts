import { queryClient, queryKeys } from "./queryClient";
import { resolvePermissionsFromStorage, hasAnyPermission } from "./permissions";
import { ROUTE_VIEW } from "./routePermissions";
import { getDashboard } from "../api/dashboard";
import { getInventoryList, getInventoryStats } from "../api/inventory";

/**
 * Background-warm TanStack Query after login for Dashboard + Inventory only.
 * Params must match the first paint of each page so keys collide (one cache entry).
 */
export async function prefetchAppData(): Promise<void> {
  const perms = resolvePermissionsFromStorage();
  const list = perms?.list ?? [];
  const isAdmin = perms?.isAdmin ?? false;

  const canView = (path: keyof typeof ROUTE_VIEW) =>
    hasAnyPermission(list, isAdmin, ...ROUTE_VIEW[path]);

  const tasks: Promise<unknown>[] = [];

  // Dashboard — same key as useDashboard({ range: "7m" })
  if (canView("/dashboard")) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard("7m"),
        queryFn: () => getDashboard("7m"),
        staleTime: 60_000,
      })
    );
  }

  // Inventory — must match Inventory.tsx first paint:
  // page=1, pageSize=50, sortKey="sku", sortAsc=true, no filters
  if (canView("/products")) {
    const invListParams = {
      page: 1,
      per_page: 50,
      sort: "sku",
      dir: "asc" as const,
      paginate: true,
      with_images: true,
    };

    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.inventory.list(invListParams as Record<string, unknown>),
        queryFn: () => getInventoryList(invListParams),
        staleTime: 60_000,
      })
    );

    tasks.push(
      queryClient.prefetchQuery({
        queryKey: queryKeys.inventory.stats,
        queryFn: () => getInventoryStats(),
        staleTime: 60_000,
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((r) => {
    if (r.status === "rejected") {
      console.warn("[prefetch] background prefetch failed (non-fatal):", r.reason);
    }
  });
}

/** Idle-friendly wrapper — first paint wins. */
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