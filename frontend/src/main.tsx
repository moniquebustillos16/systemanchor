import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import RequirePermission from "./Pages/components/RequirePermission";

import App from "./App.tsx";
import "./Pages/css/Sidebar.css";

/* ===================== MAIN ===================== */
import Dashboard from "./Pages/Main/Dashboard.tsx";
import Inventory from "./Pages/Main/Inventory.tsx";
import StockMovements from "./Pages/Main/StockMovements.tsx";

/* ===================== ORDERS ===================== */
import PurchaseOrders from "./Pages/Orders/PurchaseOrders.tsx";
import SalesOrders from "./Pages/Orders/SalesOrders.tsx";
import Receiving from "./Pages/Orders/Receiving.tsx";
import Shipping from "./Pages/Orders/Shipping.tsx";
import Returns from "./Pages/Orders/Returns.tsx";

/* ===================== WAREHOUSE ===================== */
import Warehouses from "./Pages/Warehouse/Locations.tsx";
import Capacity from "./Pages/Warehouse/Capacity.tsx";
import CycleCount from "./Pages/Warehouse/CycleCount.tsx";

/* ===================== PARTNERS ===================== */
import Suppliers from "./Pages/Partners/Suppliers.tsx";
import Customers from "./Pages/Partners/Customers.tsx";

/* ===================== INSIGHTS ===================== */
import Reports from "./Pages/Insights/Reports.tsx";
import Analytics from "./Pages/Insights/Analytics.tsx";

/* ===================== SYSTEM ===================== */
import Users from "./Pages/System/Users.tsx";
import Roles from "./Pages/System/Roles.tsx";
import Settings from "./Pages/System/Settings.tsx";
import Profile from "./Pages/components/Header/Profile.tsx";


function guard(path: string, element: React.ReactNode) {
  return <RequirePermission path={path}>{element}</RequirePermission>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* App shell (login / layout) */}
          <Route path="/" element={<App />} />

          {/* ===================== MAIN ===================== */}
          <Route path="/dashboard" element={guard("/dashboard", <Dashboard />)} />
          <Route path="/products" element={guard("/products", <Inventory />)} />
          <Route path="/stock-movements" element={guard("/stock-movements", <StockMovements />)} />
          <Route path="/purchase-orders" element={guard("/purchase-orders", <PurchaseOrders />)} />
          <Route path="/sales-orders" element={guard("/sales-orders", <SalesOrders />)} />
          <Route path="/goods-receiving" element={guard("/goods-receiving", <Receiving />)} />
          <Route path="/shipping" element={guard("/shipping", <Shipping />)} />
          <Route path="/returns" element={guard("/returns", <Returns />)} />
          <Route path="/warehouses" element={guard("/warehouses", <Warehouses />)} />
          <Route path="/capacity" element={guard("/capacity", <Capacity />)} />
          <Route path="/cycle-count" element={guard("/cycle-count", <CycleCount />)} />
          <Route path="/suppliers" element={guard("/suppliers", <Suppliers />)} />
          <Route path="/customers" element={guard("/customers", <Customers />)} />
          <Route path="/reports" element={guard("/reports", <Reports />)} />
          <Route path="/analytics" element={guard("/analytics", <Analytics />)} />
          <Route path="/users" element={guard("/users", <Users />)} />
          <Route path="/roles" element={guard("/roles", <Roles />)} />
          <Route path="/profile" element={guard("/profile", <Profile />)} />
          <Route path="/company-settings" element={guard("/company-settings", <Settings />)} />

          {/* ---------- Legacy redirects (old paths → new) ---------- */}
          <Route path="/stockin" element={<Navigate to="/stock-movements" replace />} />
          <Route path="/stockout" element={<Navigate to="/stock-movements" replace />} />
          <Route path="/transfers" element={<Navigate to="/stock-movements" replace />} />
          <Route path="/adjustments" element={<Navigate to="/stock-movements" replace />} />
          <Route path="/cycle-counts" element={<Navigate to="/cycle-count" replace />} />
          <Route path="/orders" element={<Navigate to="/sales-orders" replace />} />
          <Route path="/pick-pack" element={<Navigate to="/sales-orders" replace />} />
          <Route path="/customerss" element={<Navigate to="/customers" replace />} />
          <Route path="/audit-logs" element={<Navigate to="/roles" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);