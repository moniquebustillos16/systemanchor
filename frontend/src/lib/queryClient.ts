import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient for SystemAnchor (WMS).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Render cached data first, then refresh stale data in the background.
      // TanStack Query deduplicates an already-running prefetch by query key.
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Query key factory — use consistently across modules.
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

  /** Per-user warehouse assignment scope: GET /users/:id/warehouses */
  userWarehouses: (userId: string) =>
    ["users", userId, "warehouses"] as const,

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
  cycleCounts: ["cycle-counts"] as const,
  settings: ["settings"] as const,

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

  users: {
    all: ["users"] as const,
    stats: ["users", "stats"] as const,
    list: (params: Record<string, unknown>) =>
      ["users", "list", params] as const,
  },

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