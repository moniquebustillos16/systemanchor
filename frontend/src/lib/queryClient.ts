import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient for SystemAnchor (WMS).
 *
 * Defaults rationale (ops software, not social feed):
 * - staleTime 60s: match existing soft TTLs in Dashboard/Inventory (~60s).
 *   Cached data is shown immediately; background refetch only after 60s of "stale".
 * - gcTime 10 min: match hard sessionStorage bootstrap window; unused cache
 *   stays available if user navigates away and back within a shift window.
 * - retry 1: one retry for flaky network; avoid hammering Laravel on real 4xx/5xx.
 * - refetchOnWindowFocus: true — warehouse data changes while tab is backgrounded;
 *   only refetches if query is stale (respects staleTime).
 * - refetchOnReconnect: true — after network drop, sync once when online again.
 * - refetchOnMount: true — if data is stale when a page mounts, refresh in background
 *   while showing cache (stale-while-revalidate).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 60 seconds
      gcTime: 10 * 60_000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0, // mutations (stock in/out, saves) should not auto-retry
    },
  },
});

/**
 * Query key factory — use consistently across modules.
 * Keeps invalidation predictable.
 */
export const queryKeys = {
  me: ["me"] as const,
  dashboard: (range: string = "7m") => ["dashboard", range] as const,

  inventory: {
    all: ["inventory"] as const,
    stats: ["inventory", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["inventory", "list", params] as const,
    detail: (id: string) => ["inventory", "detail", id] as const,
  },

  stockMovements: {
    all: ["stock-movements"] as const,
    list: (params: Record<string, unknown>) =>
      ["stock-movements", "list", params] as const,
    products: ["stock-movements", "products"] as const,
    warehouses: ["stock-movements", "warehouses"] as const,
  },

  warehouses: {
    all: ["warehouses"] as const,
    list: (params?: Record<string, unknown>) =>
      ["warehouses", "list", params ?? {}] as const,
  },

  purchaseOrders: {
    all: ["purchase-orders"] as const,
    stats: ["purchase-orders", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["purchase-orders", "list", params] as const,
  },

  salesOrders: {
    all: ["sales-orders"] as const,
    stats: ["sales-orders", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["sales-orders", "list", params] as const,
  },

  goodsReceipts: {
    all: ["goods-receipts"] as const,
    stats: ["goods-receipts", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["goods-receipts", "list", params] as const,
  },

  shipments: {
    all: ["shipments"] as const,
    stats: ["shipments", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["shipments", "list", params] as const,
  },

  returns: {
    all: ["returns"] as const,
    stats: ["returns", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["returns", "list", params] as const,
  },

  categories: ["categories"] as const,

  // ── Partners (Customers / Suppliers) ───────────────────────
  customers: {
    all: ["customers"] as const,
    list: (params?: Record<string, unknown>) =>
      ["customers", "list", params ?? {}] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (params?: Record<string, unknown>) =>
      ["suppliers", "list", params ?? {}] as const,
  },

  // ── System: Users / Roles ─────────────────────────────────
  users: {
    all: ["users"] as const,
    stats: ["users", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["users", "list", params] as const,
  },

    // ── System: Roles / Permissions ───────────────────────────
  roles: {
    all: ["roles"] as const,
    list: (params?: Record<string, unknown>) =>
      ["roles", "list", params ?? {}] as const,
    detail: (id: string) => ["roles", "detail", id] as const,
    permissions: (id: string) => ["roles", "permissions", id] as const,
    users: (id: string) => ["roles", "users", id] as const,
  },
  permissions: {
    all: ["permissions"] as const,
    list: (params?: Record<string, unknown>) =>
      ["permissions", "list", params ?? {}] as const,
  },
  

    profile: {
    all: ["profile"] as const,
    me: ["profile", "me"] as const,
    sessions: ["profile", "sessions"] as const,
    activity: ["profile", "activity"] as const,
    twoFactor: ["profile", "2fa"] as const,
  },

  
} as const;