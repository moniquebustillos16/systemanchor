import { queryClient, queryKeys } from "./queryClient";

/**
 * Background-warm TanStack Query cache for high-traffic modules.
 * Safe to call multiple times — React Query dedupes in-flight requests.
 */
export async function prefetchAppData(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  // ── Inventory (list + stats) ─────────────────────────────
  const invListParams = {
    page: 1,
    per_page: 15,
    sort: "updated_at",
    dir: "desc",
  };

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

  // ── Stock movements ──────────────────────────────────────
  const stockParams = {
    page: 1,
    per_page: 15,
    sort: "movement_date",
    dir: "desc",
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.stockMovements.list(stockParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/stock-movements", { params: stockParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Purchase orders ──────────────────────────────────────
  const poParams = {
    page: 1,
    per_page: 15,
    sort: "order_date",
    dir: "desc",
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.purchaseOrders.list(poParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/purchase-orders", { params: poParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.purchaseOrders.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/purchase-orders/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Sales orders ─────────────────────────────────────────
  const soParams = {
    page: 1,
    per_page: 15,
    sort: "order_date",
    dir: "desc",
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.salesOrders.list(soParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/sales-orders", { params: soParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.salesOrders.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/sales-orders/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Warehouses ───────────────────────────────────────────
  const whParams = { per_page: 200, all: 1 };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.warehouses.list(whParams),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/warehouses", { params: whParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Goods receipts (Receiving) ───────────────────────────
  const grParams = {
    page: 1,
    per_page: 15,
    sort: "date",
    dir: "desc",
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.goodsReceipts.list(grParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/goods-receipts", { params: grParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.goodsReceipts.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/goods-receipts/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Shipments ────────────────────────────────────────────
  const shipParams = {
    page: 1,
    per_page: 15,
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.shipments.list(shipParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/shipments", { params: shipParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.shipments.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/shipments/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Returns (RMA) ────────────────────────────────────────
  const retParams = {
    page: 1,
    per_page: 15,
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.returns.list(retParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/returns", { params: retParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.returns.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/returns/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Partners: Customers ──────────────────────────────────
  const customerParams = {
    page: 1,
    per_page: 100,
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.customers.list(customerParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/customers", { params: customerParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── Partners: Suppliers ──────────────────────────────────
  const supplierParams = {
    page: 1,
    per_page: 100,
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.suppliers.list(supplierParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/suppliers", { params: supplierParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── System: Users (list + stats) ─────────────────────────
  // Match useUsers default: page 1, per_page 200, no filters
  const userListParams = {
    page: 1,
    per_page: 200,
    sort: "name",
    dir: "asc",
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.list(userListParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/users", { params: userListParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.stats,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/users/stats");
        return data;
      },
      staleTime: 60_000,
    })
  );

  // ── System: Roles (for Users form / filters) ─────────────
    // ── System: Roles + Permissions catalog ──────────────────
  const roleListParams = {
    per_page: 200,
    all: 1,
    sort: "name",
    dir: "asc",
    with_counts: 1,
  };

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.roles.list(roleListParams as Record<string, unknown>),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/roles", { params: roleListParams });
        return data;
      },
      staleTime: 60_000,
    })
  );

  tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.permissions.list({ per_page: 500, all: 1 }),
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data } = await api.get("/permissions", {
          params: { per_page: 500, all: 1 },
        });
        return data;
      },
      staleTime: 60_000,
    })
  );


    tasks.push(
    queryClient.prefetchQuery({
      queryKey: queryKeys.profile.me,
      queryFn: async () => {
        const { default: api } = await import("../api/axios");
        const { data: json } = await api.get("/profile");
        return json?.data ?? json;
      },
      staleTime: 60_000,
    })
  );
}

/** Idle-friendly wrapper — waits a tick so Dashboard paint wins. */
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
