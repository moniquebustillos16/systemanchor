import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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
import Profile from "./Pages/components/Header/Profile.tsx";   // ← add this file

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* App shell (login / layout) */}
        <Route path="/" element={<App />} />

        {/* ===================== MAIN ===================== */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Inventory />} />
        <Route path="/inventory" element={<Navigate to="/products" replace />} />
        <Route path="/stock-movements" element={<StockMovements />} />

        {/* ===================== ORDERS ===================== */}
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/sales-orders" element={<SalesOrders />} />
        <Route path="/goods-receiving" element={<Receiving />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/returns" element={<Returns />} />

        {/* ===================== WAREHOUSE ===================== */}
        <Route path="/warehouses" element={<Warehouses />} />
        <Route path="/locations" element={<Navigate to="/warehouses" replace />} />
        <Route path="/capacity" element={<Capacity />} />
        <Route path="/cycle-count" element={<CycleCount />} />

        {/* ===================== PARTNERS ===================== */}
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />

        {/* ===================== INSIGHTS ===================== */}
        <Route path="/reports" element={<Reports />} />
        <Route path="/analytics" element={<Analytics />} />

        {/* ===================== SYSTEM ===================== */}
        <Route path="/users" element={<Users />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/profile" element={<Profile />} />                    {/* ← NEW */}
        <Route path="/company-settings" element={<Settings />} />
        <Route path="/settings" element={<Navigate to="/company-settings" replace />} />

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
  </StrictMode>
);