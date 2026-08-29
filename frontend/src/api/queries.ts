import { useQuery } from "@tanstack/react-query";
import api from "./axios";

/**
 * Dashboard KPI statistics
 * staleTime 60s + placeholder-friendly keys so revisiting the dashboard
 * does not hard-reload every time.
 */

export const useDashboardInventoryStats = () => {
  return useQuery({
    queryKey: ["dashboard", "inventory-stats"],
    queryFn: async () => {
      const response = await api.get("/inventories/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardSalesStats = () => {
  return useQuery({
    queryKey: ["dashboard", "sales-stats"],
    queryFn: async () => {
      const response = await api.get("/sales-orders/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardPurchaseStats = () => {
  return useQuery({
    queryKey: ["dashboard", "purchase-stats"],
    queryFn: async () => {
      const response = await api.get("/purchase-orders/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardReceivingStats = () => {
  return useQuery({
    queryKey: ["dashboard", "receiving-stats"],
    queryFn: async () => {
      const response = await api.get("/goods-receipts/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardShippingStats = () => {
  return useQuery({
    queryKey: ["dashboard", "shipping-stats"],
    queryFn: async () => {
      const response = await api.get("/shipments/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardReturnsStats = () => {
  return useQuery({
    queryKey: ["dashboard", "returns-stats"],
    queryFn: async () => {
      const response = await api.get("/returns/stats");
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useDashboardWarehouseStats = () => {
  return useQuery({
    queryKey: ["dashboard", "warehouse-stats"],
    queryFn: async () => {
      // Prefer a dedicated endpoint if you have one; otherwise list is fine
      const response = await api.get("/warehouses", {
        params: { per_page: 200, all: 1 },
      });
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};