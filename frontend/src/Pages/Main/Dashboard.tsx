import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart as RAreaChart,
  Area,
  BarChart as RBarChart,
  Bar,
  PieChart as RPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { usePermissions } from "../../hooks/useCurrentUser";
import { hasAnyPermission } from "../../lib/permissions";
import { useDashboard } from "../../hooks/useDashboard";

import "../css/Main.css";

/* ===================== ICONS ===================== */

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconLayers = () => (
  <svg {...svg} width="20" height="20">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconBuilding = () => (
  <svg {...svg} width="20" height="20">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
);
const IconAlert = () => (
  <svg {...svg} width="20" height="20">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconCart = () => (
  <svg {...svg} width="20" height="20">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const IconFileText = () => (
  <svg {...svg} width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const IconPackage = () => (
  <svg {...svg} width="18" height="18">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);
const IconClipboard = () => (
  <svg {...svg} width="18" height="18">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);
const IconReturn = () => (
  <svg {...svg} width="18" height="18">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const IconInbox = () => (
  <svg {...svg} width="18" height="18">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

/* ===================== CHARTS (Recharts) ===================== */

const CHART = {
  brown: "#C4A06A",
  brownDeep: "#8B6B45",
  brownSoft: "#D4B896",
  sage: "#6BBF82",
  sageDeep: "#4A9A62",
  clay: "#D4785C",
  tick: "currentColor",
  grid: "currentColor",
};

const pesoTick = (v: number) =>
  `₱${Number(v).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const compactPeso = (v: number) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return pesoTick(n);
};

const chartTooltipStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(196, 160, 106, 0.28)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  fontSize: 12,
  background: "var(--sa-card, var(--card-bg, var(--surface, #2a241c)))",
  color: "var(--sa-text, var(--text, #f3ebe0))",
  padding: "10px 14px",
  minWidth: 140,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

function ChartEmpty({ height = 160, label = "No data available" }: { height?: number; label?: string }) {
  return (
    <div
      className="chart-empty"
      style={{
        height,
        minHeight: height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        background: "rgba(196, 160, 106, 0.06)",
        color: "rgba(243, 235, 224, 0.45)",
        fontSize: 13,
      }}
      role="img"
      aria-label={label}
    >
      <span>{label}</span>
    </div>
  );
}

function TipBox({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: { name: string; value: string; color?: string }[];
}) {
  if (!active || !rows.length) return null;
  return (
    <div className="dash-chart-tooltip" style={chartTooltipStyle}>
      {label != null && label !== "" && (
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            fontSize: 11,
            opacity: 0.55,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "inherit",
          }}
        >
          {label}
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 5,
            color: "inherit",
          }}
        >
          {r.color && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: r.color,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${r.color}40`,
              }}
            />
          )}
          <span style={{ opacity: 0.72, flex: 1, fontWeight: 500 }}>{r.name}</span>
          <strong
            style={{
              fontVariantNumeric: "tabular-nums",
              fontWeight: 650,
              letterSpacing: "-0.01em",
            }}
          >
            {r.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

function InvTrendChart({
  data,
  height = 200,
}: {
  data: { period: string; value: number }[];
  height?: number;
}) {
  if (!data.length) return <ChartEmpty height={height} label="No trend data available" />;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, maxV * 0.08, 1);
  const yMin = Math.max(0, minV - span * 0.35);
  const yMax = maxV + span * 0.2;

  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Inventory value trend">
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 14, right: 14, left: 2, bottom: 4 }}>
          <defs>
            <linearGradient id="invAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.brown} stopOpacity={0.45} />
              <stop offset="55%" stopColor={CHART.brown} stopOpacity={0.12} />
              <stop offset="100%" stopColor={CHART.brown} stopOpacity={0} />
            </linearGradient>
            <filter id="invGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={CHART.brown} floodOpacity="0.45" />
            </filter>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeOpacity={0.1} vertical={false} strokeDasharray="4 6" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: CHART.tick, opacity: 0.45, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            width={52}
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: CHART.tick, opacity: 0.4 }}
            tickFormatter={compactPeso}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            allowDataOverflow
          />
          <Tooltip
            cursor={{ stroke: CHART.brownSoft, strokeWidth: 1.25, strokeDasharray: "5 5", strokeOpacity: 0.7 }}
            wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none" }}
            contentStyle={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
            content={({ active, label, payload }) => (
              <TipBox
                active={active}
                label={String(label ?? "")}
                rows={(payload ?? []).map((p) => ({
                  name: "Inventory value",
                  value: pesoTick(Number(p.value ?? 0)),
                  color: CHART.brown,
                }))}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Inventory value"
            stroke={CHART.brown}
            strokeWidth={2.75}
            fill="url(#invAreaFill)"
            dot={{ r: 3.5, fill: CHART.brown, stroke: "var(--sa-card, var(--card-bg, #2a241c))", strokeWidth: 2 }}
            activeDot={{
              r: 7,
              fill: CHART.brown,
              stroke: "var(--sa-card, var(--card-bg, #2a241c))",
              strokeWidth: 2.5,
              style: { filter: "url(#invGlow)" },
            }}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StockMoveChart({
  data,
  height = 200,
}: {
  data: { period: string; in: number; out: number }[];
  height?: number;
}) {
  if (!data.length) return <ChartEmpty height={height} label="No movement data" />;

  const chartData = data;
  const maxVal = Math.max(
    1,
    ...chartData.map((d) => Math.max(Number(d.in) || 0, Number(d.out) || 0))
  );
  const yMax = Math.max(6, Math.ceil(maxVal * 1.25));

  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Stock movement in and out">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={chartData}
          barGap={4}
          barCategoryGap="28%"
          margin={{ top: 28, right: 8, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="barInGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8FD4A0" />
              <stop offset="100%" stopColor={CHART.sageDeep} />
            </linearGradient>
            <linearGradient id="barOutGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.brownSoft} />
              <stop offset="100%" stopColor={CHART.brownDeep} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeOpacity={0.1} vertical={false} strokeDasharray="4 6" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: CHART.tick, opacity: 0.5, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={6}
            interval={0}
          />
          <YAxis
            width={28}
            tick={{ fontSize: 10, fill: CHART.tick, opacity: 0.4 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickCount={5}
            domain={[0, yMax]}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, currentColor 6%, transparent)", radius: 8 }}
            wrapperStyle={{ outline: "none", background: "transparent", border: "none", boxShadow: "none" }}
            contentStyle={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
            content={({ active: tipOn, label, payload }) => (
              <TipBox
                active={tipOn}
                label={String(label ?? "")}
                rows={(payload ?? []).map((p) => ({
                  name: String(p.name ?? ""),
                  value: `${Number(p.value ?? 0).toLocaleString()} moves`,
                  color: String(p.color ?? CHART.brown),
                }))}
              />
            )}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 11.5,
              fontWeight: 500,
              paddingBottom: 4,
              opacity: 0.7,
            }}
          />
          <Bar
            dataKey="in"
            name="Stock In"
            fill="url(#barInGrad)"
            radius={[6, 6, 2, 2]}
            maxBarSize={18}
            isAnimationActive
            animationDuration={650}
          />
          <Bar
            dataKey="out"
            name="Stock Out"
            fill="url(#barOutGrad)"
            radius={[6, 6, 2, 2]}
            maxBarSize={18}
            isAnimationActive
            animationDuration={650}
          />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryDonutChart({
  segments,
  centerValue,
  centerLabel,
  height = 220,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  height?: number;
}) {
  const data = segments
    .filter((s) => s.value > 0)
    .map((s) => ({ name: s.label, value: s.value, fill: s.color }));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  if (!data.length) return <ChartEmpty height={height} label="No category data" />;

  return (
    <div
      style={{
        width: "100%",
        minHeight: height,
        display: "flex",
        alignItems: "center",
        gap: 12,
        overflow: "visible",
      }}
      role="img"
      aria-label={`Category mix. ${centerValue} ${centerLabel}`}
    >
      <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0, overflow: "visible", zIndex: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={66}
              paddingAngle={3}
              stroke="var(--sa-card, var(--card-bg, #2a241c))"
              strokeWidth={2}
              isAnimationActive
              animationDuration={700}
            >
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.fill}
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))" }}
                />
              ))}
            </Pie>
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              offset={14}
              wrapperStyle={{
                outline: "none",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                zIndex: 20,
              }}
              contentStyle={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
              content={({ active, payload }) => {
                const row = payload?.[0];
                if (!active || !row) return null;
                const val = Number(row.value ?? 0);
                const pct = Math.round((val / total) * 100);
                return (
                  <TipBox
                    active
                    rows={[
                      {
                        name: String(row.name ?? ""),
                        value: `${pct}% · ${val.toLocaleString()}`,
                        color: String((row.payload as { fill?: string })?.fill ?? CHART.brown),
                      },
                    ]}
                  />
                );
              }}
            />
          </RPieChart>
        </ResponsiveContainer>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "var(--sa-text, var(--text, currentColor))",
              letterSpacing: "-0.02em",
            }}
          >
            {centerValue}
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.5,
              marginTop: 2,
              fontWeight: 500,
              color: "var(--sa-text, var(--text, currentColor))",
            }}
          >
            {centerLabel}
          </div>
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "4px 0",
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {data.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <li
              key={s.name}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr auto",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                lineHeight: 1.3,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  background: s.fill,
                  boxShadow: `0 0 0 2px color-mix(in srgb, ${s.fill} 28%, transparent)`,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "currentColor",
                  opacity: 0.85,
                  fontWeight: 500,
                }}
                title={s.name}
              >
                {s.name}
              </span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 650,
                  opacity: 0.5,
                  fontSize: 12,
                }}
              >
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PipelineChart({
  stages,
  title = "Order pipeline",
}: {
  stages: { label: string; count: number; color: string }[];
  title?: string;
}) {
  const active = stages.filter((s) => s.count > 0);
  const rows = active.length > 0 ? active : stages;
  const max = Math.max(...rows.map((s) => s.count), 1);

  if (!stages.length) {
    return (
      <div className="chart-empty" style={{ minHeight: 160 }} role="img" aria-label={`${title}: no data available`}>
        <span>No pipeline data</span>
      </div>
    );
  }
  const summary = `${title}. ${rows.map((s) => `${s.label}: ${s.count}`).join("; ")}.`;
  const total = rows.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <div
      className="pipeline-list chart-a11y"
      role="list"
      aria-label={summary}
      style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 0" }}
    >
      <p className="sr-only">{summary}</p>
      {rows.map((s) => {
        const pct = Math.round((s.count / max) * 100);
        const share = Math.round((s.count / total) * 100);
        const empty = s.count <= 0;
        return (
          <div
            key={s.label}
            className="pipeline-row"
            role="listitem"
            aria-label={`${s.label}: ${s.count}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              opacity: empty ? 0.45 : 1,
            }}
          >
            <div
              className="pipeline-row-top"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                className="pipeline-label"
                style={{
                  fontSize: 13,
                  fontWeight: 550,
                  color: "currentColor",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: s.color,
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px color-mix(in srgb, ${s.color} 25%, transparent)`,
                  }}
                />
                {s.label}
              </span>
              <span
                className="pipeline-count"
                style={{
                  color: empty ? "currentColor" : s.color,
                  opacity: empty ? 0.45 : 1,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 13,
                }}
              >
                {s.count.toLocaleString()}
                {!empty && (
                  <span style={{ fontWeight: 500, opacity: 0.55, marginLeft: 6, fontSize: 11 }}>
                    {share}%
                  </span>
                )}
              </span>
            </div>
            <div
              className="pipeline-track"
              role="meter"
              aria-valuenow={s.count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${s.label} relative volume`}
              style={{
                height: 9,
                borderRadius: 99,
                background: "color-mix(in srgb, currentColor 10%, transparent)",
                overflow: "hidden",
              }}
            >
              <div
                className="pipeline-fill"
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: `linear-gradient(90deg, ${s.color}bb, ${s.color})`,
                  boxShadow: `0 0 10px color-mix(in srgb, ${s.color} 40%, transparent)`,
                  transition: "width 0.55s ease-out",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== ROLE PERMISSIONS ===================== */


const PATH_VIEW: Record<string, string[]> = {
  "/dashboard": [
    "dashboard.view",
    "dashboards.view",
    "home.view",
    "overview.view",
    "main.view",
  ],
  "/products": [
    "inventory.view",
    "inventories.view",
    "products.view",
    "items.view",
    "stock.view",
  ],
  "/inventory": [
    "inventory.view",
    "inventories.view",
    "products.view",
    "items.view",
    "stock.view",
  ],
  "/stock-movements": [
    "stock_movements.view",
    "stock-movements.view",
    "movements.view",
    "transfers.view",
    "adjustments.view",
    "inventory.view",
  ],
  "/purchase-orders": [
    "purchase_orders.view",
    "purchase-orders.view",
    "purchases.view",
    "po.view",
  ],
  "/sales-orders": [
    "sales_orders.view",
    "sales-orders.view",
    "sales.view",
    "orders.view",
    "so.view",
  ],
  "/goods-receiving": [
    "receiving.view",
    "goods_receipts.view",
    "goods-receipts.view",
    "receipts.view",
    "inbound.view",
  ],
  "/receiving": [
    "receiving.view",
    "goods_receipts.view",
    "goods-receipts.view",
    "receipts.view",
    "inbound.view",
  ],
  "/shipping": ["shipping.view", "shipments.view", "outbound.view", "dispatch.view"],
  "/returns": ["returns.view", "rma.view"],
  "/warehouses": ["warehouses.view", "locations.view", "bins.view", "zones.view"],
  "/capacity": [
    "capacity.view",
    "warehouses.view",
    "locations.view",
    "utilization.view",
  ],
  "/cycle-count": [
    "cycle_counts.view",
    "cycle-counts.view",
    "cycle_count.view",
    "counts.view",
    "stocktake.view",
  ],
  "/analytics": ["analytics.view", "insights.view", "metrics.view", "reports.view", "dashboard.view"],
  "/reports": ["reports.view", "report.view", "analytics.view"],
};

function canPath(perms: string[], path: string, isAdmin = false): boolean {
  const needed = PATH_VIEW[path];
  if (!needed) return true;
  return hasAnyPermission(perms, isAdmin, ...needed);
}

type Warehouse = {
  id: string;
  code?: string;
  name: string;
  utilized?: number | string;
  capacity?: number | string;
  location?: string;
};

type OrderRow = {
  id: string;
  kind: "SO" | "PO";
  party: string;
  total: number;
  status: string;
  date: string;
};

type AlertItem = {
  type: "warning" | "danger" | "success";
  title: string;
  msg: string;
  path: string;
  sku?: string;
};

//const CAT_COLORS = ["#9A6B45", "#C4A07A", "#6B9B7A", "#C49A5A", "#A89880", "#5A9A6E"];

type MovementRow = {
  id: string;
  type: string;
  qty: number;
  product: string;
  sku?: string;
  from: string;
  to: string;
  reference?: string;
  date: string;
  status: string;
};

type ActivityItem = {
  kind: string;
  color: string;
  text: string;
  time: string;
  path: string;
};

type OpsStats = {
  today?: number;
  this_week?: number;
  in?: number;
  out?: number;
  transfer?: number;
  adjust?: number;
  all?: number;
  pending?: number;
  avg_acc?: number | null;
  open_var?: number;
  open?: number;
  done?: number;
  closed?: number;
  lines?: number;
  items?: number;
};

/* ── Dashboard snapshot cache (instant paint while Query loads) ── */
const DASH_SOFT_TTL_MS = 60_000;
const DASH_HARD_TTL_MS = 10 * 60_000;
const SS_DASH_KEY = "dash:lastSnapshot";

type DashSnapshot = {
  at: number;
  invValue: number;
  lowStock: number;
  outStock: number;
  skuCount: number;
  soPending: number;
  soAll: number;
  soDone: number;
  poPending: number;
  poAll: number;
  soValue: number;
  poValue: number;
  warehouses: Warehouse[];
  recentOrders: OrderRow[];
  alerts: AlertItem[];
  categories: { label: string; value: number; color: string }[];
  moveStats: OpsStats;
  cycleStats: OpsStats;
  receiptStats: OpsStats;
  returnStats: OpsStats;
  recentMoves: MovementRow[];
  activityFeed: ActivityItem[];
  serverTrend: number[] | null;
  serverTrendLabels: string[] | null;
  serverStockIn: number[] | null;
  serverStockOut: number[] | null;
  trendRange: string;
};

type DashCacheStore = {
  entry: DashSnapshot | null;
  inflight: Promise<void> | null;
};

function dashStore(): DashCacheStore {
  const g = globalThis as unknown as { __saDashCache?: DashCacheStore };
  if (!g.__saDashCache) g.__saDashCache = { entry: null, inflight: null };
  return g.__saDashCache;
}

function isDashFresh(s: DashSnapshot | null | undefined, ttl = DASH_SOFT_TTL_MS): s is DashSnapshot {
  return !!s && Date.now() - s.at < ttl;
}

function readDashSS(): DashSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SS_DASH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DashSnapshot;
    if (!s || typeof s.at !== "number") return null;
    if (Date.now() - s.at > DASH_HARD_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

function writeDashSS(s: DashSnapshot) {
  try {
    sessionStorage.setItem(SS_DASH_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

function bootstrapDash(): DashSnapshot | null {
  const mem = dashStore().entry;
  if (isDashFresh(mem, DASH_HARD_TTL_MS)) return mem;
  return readDashSS();
}

function normMoveType(t: unknown): string {
  const s = String(t ?? "").trim().toLowerCase();
  if (s === "receipt" || s === "in") return "IN";
  if (s === "issue" || s === "out") return "OUT";
  if (s === "transfer") return "TRANSFER";
  if (s === "adjustment" || s === "adjust") return "ADJUSTMENT";
  return String(t ?? "").trim().toUpperCase();
}

function Dashboard() {
  const navigate = useNavigate();
  const [trendRange, setTrendRange] = useState("7m");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [usingUnified, setUsingUnified] = useState(false);

  /* ── TanStack Query (Phase 4) ─────────────────────────────── */
  const {
    data: dash,
    isLoading: dashLoading,
    isFetching: dashFetching,
    refetch: refetchDashboard,
    dataUpdatedAt,
  } = useDashboard({ range: trendRange, enabled: true });

  const boot = bootstrapDash();
  const [loading, setLoading] = useState(() => !boot);

  const [invValue, setInvValue] = useState(() => boot?.invValue ?? 0);
  const [lowStock, setLowStock] = useState(() => boot?.lowStock ?? 0);
  const [outStock, setOutStock] = useState(() => boot?.outStock ?? 0);
  const [skuCount, setSkuCount] = useState(() => boot?.skuCount ?? 0);

  const [soPending, setSoPending] = useState(() => boot?.soPending ?? 0);
  const [soAll, setSoAll] = useState(() => boot?.soAll ?? 0);
  const [soDone, setSoDone] = useState(() => boot?.soDone ?? 0);
  const [poPending, setPoPending] = useState(() => boot?.poPending ?? 0);
  const [poAll, setPoAll] = useState(() => boot?.poAll ?? 0);
  const [soValue, setSoValue] = useState(() => boot?.soValue ?? 0);
  const [poValue, setPoValue] = useState(() => boot?.poValue ?? 0);

  const [warehouses, setWarehouses] = useState<Warehouse[]>(
    () => (Array.isArray(boot?.warehouses) ? boot!.warehouses : [])
  );
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>(
    () => (Array.isArray(boot?.recentOrders) ? boot!.recentOrders : [])
  );
  const [alerts, setAlerts] = useState<AlertItem[]>(
    () => (Array.isArray(boot?.alerts) ? boot!.alerts : [])
  );
  const [categories, setCategories] = useState<
    { label: string; value: number; color: string }[]
  >(() => (Array.isArray(boot?.categories) ? boot!.categories : []));
  const [pipeline, setPipeline] = useState<
    { label: string; count: number; color: string }[]
  >([]);

  const [serverTrend, setServerTrend] = useState<number[] | null>(
    () => boot?.serverTrend ?? null
  );
  const [serverTrendLabels, setServerTrendLabels] = useState<string[] | null>(
    () => boot?.serverTrendLabels ?? null
  );
  const [serverStockIn, setServerStockIn] = useState<number[] | null>(
    () => boot?.serverStockIn ?? null
  );
  const [serverStockOut, setServerStockOut] = useState<number[] | null>(
    () => boot?.serverStockOut ?? null
  );

  const [moveStats, setMoveStats] = useState<OpsStats>(() => boot?.moveStats ?? {});
  const [cycleStats, setCycleStats] = useState<OpsStats>(() => boot?.cycleStats ?? {});
  const [receiptStats, setReceiptStats] = useState<OpsStats>(() => boot?.receiptStats ?? {});
  const [returnStats, setReturnStats] = useState<OpsStats>(() => boot?.returnStats ?? {});
  const [recentMoves, setRecentMoves] = useState<MovementRow[]>(
    () => (Array.isArray(boot?.recentMoves) ? boot!.recentMoves : [])
  );
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>(
    () => (Array.isArray(boot?.activityFeed) ? boot!.activityFeed : [])
  );

  const { permissions: userPermissions, isLoaded: permsLoaded, isAdmin} = usePermissions();


  const canViewPath = useCallback(
    (path: string) => !permsLoaded || canPath(userPermissions, path, isAdmin),
    [userPermissions, permsLoaded, isAdmin]
  );

  const canAccessDashboard = useMemo(
    () => !permsLoaded || canPath(userPermissions, "/dashboard", isAdmin),
    [userPermissions, permsLoaded, isAdmin]
  );

  const go = useCallback(
    (path: string) => {
      if (canViewPath(path)) navigate(path);
    },
    [canViewPath, navigate]
  );


  /* Phase 4: TanStack Query → local UI state */
  useEffect(() => {
    if (!dash) return;

    setInvValue(dash.invValue);
    setLowStock(dash.lowStock);
    setOutStock(dash.outStock);
    setSkuCount(dash.skuCount);
    setSoPending(dash.soPending);
    setSoAll(dash.soAll);
    setSoDone(dash.soDone);
    setPoPending(dash.poPending);
    setPoAll(dash.poAll);
    setSoValue(dash.soValue);
    setPoValue(dash.poValue);

    setWarehouses(
      (dash.warehouses ?? []).map((w) => ({
        id: String(w.id),
        code: w.code,
        name: String(w.name ?? w.code ?? ""),
        utilized: w.utilized,
        capacity: w.capacity,
        location: w.location,
      }))
    );

    setRecentOrders(
      (dash.recentOrders ?? []).map((o) => ({
        id: o.id,
        kind: o.kind,
        party: o.party,
        total: o.total,
        status: o.status,
        date: o.date,
      }))
    );

    setAlerts(
      (dash.alerts ?? []).map((a) => ({
        type:
          a.type === "danger"
            ? ("danger" as const)
            : a.type === "warning"
              ? ("warning" as const)
              : ("success" as const),
        title: a.title,
        msg: a.msg,
        path: a.path || "/products",
        sku: a.sku,
      }))
    );

    setCategories(dash.categories ?? []);
    setPipeline(dash.pipeline ?? []);
    setMoveStats((dash.moveStats ?? {}) as OpsStats);
    setCycleStats((dash.cycleStats ?? {}) as OpsStats);
    setReceiptStats((dash.receiptStats ?? {}) as OpsStats);
    setReturnStats((dash.returnStats ?? {}) as OpsStats);

    // recent movements from unified /dashboard only (no secondary stock-movements fetch)
    const rawMoves = Array.isArray(dash.recentMoves) ? dash.recentMoves : [];
    if (rawMoves.length) {
      setRecentMoves(
        rawMoves.slice(0, 8).map((m) => {
          const row = m as Record<string, unknown>;
          // DashboardController::recentMovements returns product/from/to as strings
          const productField = row.product;
          const productName =
            typeof productField === "string"
              ? productField
              : String(
                  (productField as { name?: string; sku?: string } | undefined)?.name ??
                    (productField as { sku?: string } | undefined)?.sku ??
                    row.product_name ??
                    "—"
                );
          const sku =
            typeof productField === "object" && productField && "sku" in productField
              ? String((productField as { sku?: string }).sku ?? "")
              : row.sku != null
                ? String(row.sku)
                : undefined;
          return {
            id: String(row.id ?? ""),
            type: normMoveType(row.type),
            qty: Number(row.qty ?? 0),
            product: productName,
            sku: sku || undefined,
            from: String(
              (row.from_warehouse as { code?: string } | undefined)?.code ??
                row.from ??
                "—"
            ),
            to: String(
              (row.to_warehouse as { code?: string } | undefined)?.code ??
                row.to ??
                "—"
            ),
            reference: row.reference != null ? String(row.reference) : undefined,
            date: String(row.movement_date ?? row.date ?? "").slice(0, 10),
            status: String(row.status ?? "posted"),
          };
        })
      );
    }

    if (dash.serverTrend?.length) setServerTrend(dash.serverTrend);
    if (dash.serverTrendLabels?.length) setServerTrendLabels(dash.serverTrendLabels);
    if (dash.serverStockIn?.length) setServerStockIn(dash.serverStockIn);
    if (dash.serverStockOut?.length) setServerStockOut(dash.serverStockOut);

    setUsingUnified(!!dash.usingUnified);

    const rawFeed = Array.isArray(dash.activityFeed) ? dash.activityFeed : [];
    if (rawFeed.length) {
      setActivityFeed(
        rawFeed.slice(0, 12).map((a) => {
          const row = a as Record<string, unknown>;
          return {
            kind: String(row.kind ?? "info"),
            color: String(row.color ?? "#9A6B45"),
            text: String(row.text ?? row.title ?? row.msg ?? "Activity"),
            time: String(row.time ?? row.at ?? row.created_at ?? ""),
            path: String(row.path ?? "/dashboard"),
          } satisfies ActivityItem;
        })
      );
    }

    setLastUpdated(dataUpdatedAt ? new Date(dataUpdatedAt) : new Date());
    setLoading(false);

  }, [dash, dataUpdatedAt]);

  useEffect(() => {
    if (dash) {
      setLoading(false);
      return;
    }
    if (dashLoading) setLoading(true);
  }, [dash, dashLoading]);

  /* Persist snapshot for instant re-entry paint */
  useEffect(() => {
    if (invValue === 0 && skuCount === 0 && soAll === 0 && !warehouses.length) return;
    const snap: DashSnapshot = {
      at: Date.now(),
      invValue,
      lowStock,
      outStock,
      skuCount,
      soPending,
      soAll,
      soDone,
      poPending,
      poAll,
      soValue,
      poValue,
      warehouses: Array.isArray(warehouses) ? warehouses : [],
      recentOrders: Array.isArray(recentOrders) ? recentOrders : [],
      alerts: Array.isArray(alerts) ? alerts : [],
      categories: Array.isArray(categories) ? categories : [],
      moveStats,
      cycleStats,
      receiptStats,
      returnStats,
      recentMoves: Array.isArray(recentMoves) ? recentMoves : [],
      activityFeed: Array.isArray(activityFeed) ? activityFeed : [],
      serverTrend,
      serverTrendLabels,
      serverStockIn,
      serverStockOut,
      trendRange,
    };
    dashStore().entry = snap;
    writeDashSS(snap);
  }, [
    invValue, lowStock, outStock, skuCount,
    soPending, soAll, soDone, poPending, poAll, soValue, poValue,
    warehouses, recentOrders, alerts, categories,
    moveStats, cycleStats, receiptStats, returnStats,
    recentMoves, activityFeed,
    serverTrend, serverTrendLabels, serverStockIn, serverStockOut,
    trendRange,
  ]);

  useEffect(() => {
    if (usingUnified && pipeline.length) return;
    setPipeline([
      { label: "Open SO", count: soPending, color: "#C49A5A" },
      { label: "Done SO", count: soDone, color: "#5A9A6E" },
      { label: "All SO", count: soAll, color: "#9A6B45" },
      { label: "Open PO", count: poPending, color: "#6B9B7A" },
      { label: "All PO", count: poAll, color: "#A89880" },
    ]);
  }, [soPending, soDone, soAll, poPending, poAll, usingUnified, pipeline.length]);

  const avgUtil = useMemo(() => {
    const list = Array.isArray(warehouses) ? warehouses : [];
    if (!list.length) return 0;
    return Math.round(
      list.reduce((s, w) => s + Number(w.utilized ?? 0), 0) / list.length
    );
  }, [warehouses]);

  const warehousesSorted = useMemo(() => {
    const list = Array.isArray(warehouses) ? warehouses : [];
    return [...list].sort(
      (a, b) => Number(b.utilized ?? 0) - Number(a.utilized ?? 0)
    );
  }, [warehouses]);

  const invTrend = useMemo(() => {
    if (serverTrend && serverTrend.length) return serverTrend;
    const base = invValue || 1000;
    const len = trendRange === "3m" ? 3 : trendRange === "1y" ? 12 : 7;
    return Array.from({ length: len }, (_, i) => {
      const t = (i + 1) / len;
      const wave = Math.sin(i * 0.9) * 0.03;
      return Math.round(base * (0.72 + 0.28 * t + wave));
    });
  }, [invValue, trendRange, serverTrend]);

  const trendLabels = useMemo(() => {
    if (serverTrendLabels && serverTrendLabels.length) return serverTrendLabels;
    const now = new Date();
    const n = trendRange === "3m" ? 3 : trendRange === "1y" ? 12 : 7;
    const labels: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
          d.getMonth()
        ]
      );
    }
    return labels;
  }, [trendRange, serverTrendLabels]);

  const stockIn = useMemo(() => {
    if (serverStockIn && serverStockIn.length) return serverStockIn;
    return invTrend.map((_, i) => 4 + (i % 3));
  }, [invTrend, serverStockIn]);

  const stockOut = useMemo(() => {
    if (serverStockOut && serverStockOut.length) return serverStockOut;
    return invTrend.map((_, i) => 3 + (i % 2));
  }, [invTrend, serverStockOut]);

  const invTrendSeries = useMemo(
    () =>
      trendLabels.map((period, i) => ({
        period,
        value: invTrend[i] ?? 0,
      })),
    [trendLabels, invTrend]
  );

  const stockMoveSeries = useMemo(
    () =>
      trendLabels.map((period, i) => ({
        period,
        in: stockIn[i] ?? 0,
        out: stockOut[i] ?? 0,
      })),
    [trendLabels, stockIn, stockOut]
  );

  const trendDelta = useMemo(() => {
    if (invTrend.length < 2) return null;
    const first = invTrend[0] || 0;
    const last = invTrend[invTrend.length - 1] || 0;
    if (first === 0) return { pct: 0, abs: last - first, up: last >= first };
    const pct = ((last - first) / first) * 100;
    return { pct, abs: last - first, up: pct >= 0 };
  }, [invTrend]);

  const moveTotals = useMemo(() => {
    const inSum = stockIn.reduce((s, n) => s + (n || 0), 0);
    const outSum = stockOut.reduce((s, n) => s + (n || 0), 0);
    return { inSum, outSum, net: inSum - outSum };
  }, [stockIn, stockOut]);

  const kpiPending = loading && invValue === 0 && skuCount === 0 && soPending === 0 && poPending === 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  const healthScore = useMemo(() => {
    let s = 100;
    if (skuCount > 0) {
      s -= Math.min(35, (outStock / skuCount) * 100);
      s -= Math.min(20, (lowStock / skuCount) * 40);
    }
    if (avgUtil > 90) s -= 10;
    return Math.max(0, Math.round(s));
  }, [skuCount, outStock, lowStock, avgUtil]);

  if (permsLoaded && !canAccessDashboard) {
    return (
      <div className="dashboard">
        <Sidebar />
        <div className="main-wrapper">
          <Topbar />
          <main className="content">
            <div
              className="card"
              style={{
                padding: "56px 32px",
                textAlign: "center",
                maxWidth: 520,
                margin: "64px auto",
                border: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "color-mix(in srgb, currentColor 8%, transparent)",
                  fontSize: 28,
                  opacity: 0.7,
                }}
                aria-hidden
              >
                🔒
              </div>
              <h1 className="page-title" style={{ marginBottom: 10, fontSize: 22 }}>
                Dashboard closed
              </h1>
              <p className="text-muted" style={{ marginBottom: 0, lineHeight: 1.55, fontSize: 14 }}>
                This page is not available for your role.
                <br />
                Enable <strong>MAIN → Dashboard → View</strong> under Roles &amp; Permissions to open it.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (loading && invValue === 0 && skuCount === 0 && !lastUpdated) {
    return (
      <div className="dashboard">
        <Sidebar />
        <div className="main-wrapper">
          <Topbar />
          <main className="content">
            <div
              style={{
                minHeight: "calc(100vh - 120px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 32,
              }}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div
                className="roles-spinner"
                style={{
                  width: 36,
                  height: 36,
                  borderWidth: 3,
                }}
              />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Loading dashboard
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Fetching inventory, orders, and movement metrics…
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="content dash-page">
          <div className="dash-hero">
            <div className="dash-hero-text">
              <div className="dash-hero-eyebrow">
                {greeting}
                {lastUpdated && (
                  <span style={{ opacity: 0.7 }}>
                    {" "}
                    · live {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <h1 className="dash-hero-title">Operations overview</h1>
              <p className="dash-hero-sub">
                {dateStr} · Naga region
                {kpiPending
                  ? " · loading metrics…"
                  : ` · ${warehouses.length} sites · health ${healthScore}`}
              </p>
            </div>
            <div className="dash-hero-actions">
              {canViewPath("/reports") && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => go("/reports")}
                >
                  <IconFileText /> Reports
                </button>
              )}
              <button
                className="btn btn-secondary"
                type="button"
                disabled={dashFetching}
                onClick={() => {
                  void refetchDashboard();
                }}
              >
                {dashFetching ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className={`dash-kpi-grid${kpiPending ? " dash-kpi-pending" : ""}`}>
            <div
              className="dash-kpi"
              onClick={() => go("/products")}
              style={{
                cursor: canViewPath("/products") ? "pointer" : "default",
                opacity: kpiPending ? 0.55 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#F5EDE4", ["--kpi-fg" as string]: "#9A6B45" }}
                >
                  <IconLayers />
                </div>
                <span className="stat-change up">
                  {kpiPending ? "…" : `${skuCount.toLocaleString()} SKUs`}
                </span>
              </div>
              <div className="dash-kpi-value">
                {kpiPending
                  ? "—"
                  : `₱${invValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`}
              </div>
              <div className="dash-kpi-label">Inventory value</div>
            </div>
            <div
              className="dash-kpi"
              onClick={() => go("/capacity")}
              style={{
                cursor: canViewPath("/capacity") ? "pointer" : "default",
                opacity: kpiPending ? 0.55 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#E8F5EC", ["--kpi-fg" as string]: "#5A9A6E" }}
                >
                  <IconBuilding />
                </div>
              </div>
              <div className="dash-kpi-value">{kpiPending ? "—" : `${avgUtil}%`}</div>
              <div className="dash-kpi-label">Avg. warehouse utilization</div>
            </div>
            <div
              className="dash-kpi"
              onClick={() => go("/products")}
              style={{
                cursor: canViewPath("/products") ? "pointer" : "default",
                opacity: kpiPending ? 0.55 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#FEF6E8", ["--kpi-fg" as string]: "#C49A5A" }}
                >
                  <IconAlert />
                </div>
                <span className="stat-change down">
                  {kpiPending ? "…" : lowStock + outStock}
                </span>
              </div>
              <div className="dash-kpi-value">
                {kpiPending ? (
                  "—"
                ) : (
                  <>
                    {lowStock}
                    <span className="dash-kpi-sub"> low</span>
                    {" · "}
                    {outStock}
                    <span className="dash-kpi-sub"> out</span>
                  </>
                )}
              </div>
              <div className="dash-kpi-label">Stock alerts</div>
            </div>
            <div
              className="dash-kpi"
              onClick={() => go("/sales-orders")}
              style={{
                cursor: canViewPath("/sales-orders") ? "pointer" : "default",
                opacity: kpiPending ? 0.55 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#EEF6F0", ["--kpi-fg" as string]: "#6B9B7A" }}
                >
                  <IconCart />
                </div>
              </div>
              <div className="dash-kpi-value">
                {kpiPending ? "—" : soPending + poPending}
              </div>
              <div className="dash-kpi-label">Open orders (SO + PO)</div>
            </div>
          </div>

          <div className="dash-ops-strip">
            {canViewPath("/stock-movements") && (
              <div className="dash-ops-card" onClick={() => go("/stock-movements")}>
                <div
                  className="dash-ops-icon"
                  style={{ background: "rgba(90,154,110,0.12)", color: "#5A9A6E" }}
                >
                  <IconPackage />
                </div>
                <div>
                  <div className="dash-ops-value">
                    {moveStats.this_week ?? moveStats.today ?? "—"}
                  </div>
                  <div className="dash-ops-label">Moves this week</div>
                  <div className="dash-ops-meta">
                    In {moveStats.in ?? 0} · Out {moveStats.out ?? 0}
                  </div>
                </div>
              </div>
            )}
            {canViewPath("/cycle-count") && (
              <div className="dash-ops-card" onClick={() => go("/cycle-count")}>
                <div
                  className="dash-ops-icon"
                  style={{ background: "rgba(196,154,90,0.12)", color: "#C49A5A" }}
                >
                  <IconClipboard />
                </div>
                <div>
                  <div className="dash-ops-value">{cycleStats.pending ?? "—"}</div>
                  <div className="dash-ops-label">Open cycle counts</div>
                  <div className="dash-ops-meta">
                    Acc {cycleStats.avg_acc != null ? `${cycleStats.avg_acc}%` : "—"}
                    {cycleStats.open_var != null ? ` · ${cycleStats.open_var} var` : ""}
                  </div>
                </div>
              </div>
            )}
            {canViewPath("/receiving") && (
              <div className="dash-ops-card" onClick={() => go("/receiving")}>
                <div
                  className="dash-ops-icon"
                  style={{ background: "rgba(154,107,69,0.12)", color: "#9A6B45" }}
                >
                  <IconInbox />
                </div>
                <div>
                  <div className="dash-ops-value">{receiptStats.open ?? "—"}</div>
                  <div className="dash-ops-label">Open receipts</div>
                  <div className="dash-ops-meta">
                    {receiptStats.done ?? 0} done · {receiptStats.lines ?? 0} lines
                  </div>
                </div>
              </div>
            )}
            {canViewPath("/returns") && (
              <div className="dash-ops-card" onClick={() => go("/returns")}>
                <div
                  className="dash-ops-icon"
                  style={{ background: "rgba(184,92,74,0.12)", color: "#B85C4A" }}
                >
                  <IconReturn />
                </div>
                <div>
                  <div className="dash-ops-value">{returnStats.open ?? "—"}</div>
                  <div className="dash-ops-label">Open returns (RMA)</div>
                  <div className="dash-ops-meta">
                    {returnStats.closed ?? 0} closed · {returnStats.items ?? 0} items
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="dash-section-label">Performance</div>

          <div className="dash-charts-2">
            <div className="card dash-chart-card wide">
              <div className="card-header">
                <div>
                  <span className="card-title">Inventory value trend</span>
                  {trendDelta && (
                    <span
                      className="dash-chart-meta"
                      style={{
                        marginLeft: 10,
                        color: trendDelta.up ? "var(--sa-sage-deep, #558F66)" : "var(--sa-clay, #B85C4A)",
                        fontWeight: 600,
                      }}
                    >
                      {trendDelta.up ? "↑" : "↓"}{" "}
                      {Math.abs(trendDelta.pct).toFixed(1)}% over period
                    </span>
                  )}
                </div>
                <div className="chart-tabs" role="tablist" aria-label="Trend range">
                  {(
                    [
                      { id: "3m", label: "3M" },
                      { id: "7m", label: "7M" },
                      { id: "1y", label: "1Y" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="tab"
                      aria-selected={trendRange === r.id}
                      className={`chart-tab ${trendRange === r.id ? "active" : ""}`}
                      onClick={() => setTrendRange(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body" style={{ padding: "4px 14px 12px" }}>
                {loading && !invTrendSeries.length ? (
                  <div className="chart-empty" style={{ height: 200 }}>
                    <span>Loading trend…</span>
                  </div>
                ) : (
                  <InvTrendChart data={invTrendSeries} height={200} />
                )}
              </div>
            </div>

            <div className="card dash-chart-card">
              <div className="card-header">
                <div>
                  <span className="card-title">Stock movement</span>
                  <span className="dash-chart-meta" style={{ marginLeft: 10 }}>
                    In {moveTotals.inSum.toLocaleString()} · Out {moveTotals.outSum.toLocaleString()}
                    {moveTotals.net !== 0 && (
                      <>
                        {" "}
                        · Net{" "}
                        <span
                          style={{
                            color:
                              moveTotals.net > 0
                                ? "var(--sa-sage-deep, #558F66)"
                                : "var(--sa-clay, #B85C4A)",
                            fontWeight: 600,
                          }}
                        >
                          {moveTotals.net > 0 ? "+" : ""}
                          {moveTotals.net.toLocaleString()}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="card-body" style={{ padding: "4px 14px 12px" }}>
                {loading && !stockMoveSeries.length ? (
                  <div className="chart-empty" style={{ minHeight: 200 }}>
                    <span>Loading movements…</span>
                  </div>
                ) : (
                  <StockMoveChart data={stockMoveSeries} height={200} />
                )}
              </div>
            </div>
          </div>

          <div className="dash-charts-3">
            {canViewPath("/capacity") && (
              <div className="card dash-chart-card dash-chart-card-flex">
                <div className="card-header">
                  <span className="card-title">Warehouse utilization</span>
                  <span className="dash-chart-meta">
                    Avg {avgUtil}% · {warehousesSorted.length} site
                    {warehousesSorted.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="card-body" style={{ padding: "12px 18px 16px", flex: 1 }}>
                  {warehousesSorted.length === 0 ? (
                    <div className="text-muted" style={{ padding: 12 }}>
                      {loading ? "Loading…" : "No warehouses loaded"}
                    </div>
                  ) : (
                    <div className="util-list util-list-scroll">
                      {warehousesSorted.slice(0, 8).map((w) => {
                        const u = Math.min(100, Number(w.utilized ?? 0));
                        const level = u >= 85 ? "high" : u >= 70 ? "mid" : "ok";
                        return (
                          <div
                            key={w.id}
                            className="util-row"
                            onClick={() => go("/capacity")}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="util-row-top">
                              <div>
                                <div className="util-code">{w.code || w.name}</div>
                                <div className="util-meta">{w.name}</div>
                              </div>
                              <span className="util-pct">{u}%</span>
                            </div>
                            <div className="util-bar">
                              <div className={`util-fill ${level}`} style={{ width: `${u}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {warehousesSorted.length > 8 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ marginTop: 4, width: "100%" }}
                          onClick={() => go("/capacity")}
                        >
                          View all {warehousesSorted.length} sites
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {canViewPath("/products") && (
              <div className="card dash-chart-card dash-chart-card-flex">
                <div className="card-header">
                  <span className="card-title">Category mix</span>
                  <span className="dash-chart-meta">{skuCount.toLocaleString()} SKUs</span>
                </div>
                <div className="card-body" style={{ padding: "12px 16px 16px", flex: 1 }}>
                  <CategoryDonutChart
                    segments={
                      categories.length
                        ? categories
                        : [{ label: "—", value: 1, color: "#A89880" }]
                    }
                    centerValue={`${skuCount}`}
                    centerLabel="SKUs"
                    height={220}
                  />
                </div>
              </div>
            )}

            {(canViewPath("/sales-orders") || canViewPath("/purchase-orders")) && (
              <div className="card dash-chart-card dash-chart-card-flex">
                <div className="card-header">
                  <span className="card-title">Order pipeline</span>
                  <span className="dash-chart-meta">
                    Open {soPending + poPending}
                  </span>
                </div>
                <div className="card-body" style={{ padding: "12px 18px 16px", flex: 1 }}>
                  <PipelineChart stages={pipeline} title="Order pipeline" />
                </div>
              </div>
            )}
          </div>

          <div
            className="dash-bottom"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <div
              className="card dash-orders-card"
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                height: "100%",
              }}
            >
              <div className="card-header">
                <span className="card-title">Recent orders</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => go("/sales-orders")}
                >
                  View all
                </button>
              </div>
              <div
                className="card-body table-wrap"
                style={{ flex: 1, overflow: "auto", minHeight: 0 }}
              >
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Party</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          {loading ? "Loading…" : "No recent orders"}
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((o) => (
                        <tr
                          key={o.id + o.kind}
                          className="dash-order-row"
                          onClick={() =>
                            go(o.kind === "SO" ? "/sales-orders" : "/purchase-orders")
                          }
                        >
                          <td>
                            <span className="dash-order-id">{o.id}</span>
                            <span className="dash-order-kind">{o.kind}</span>
                          </td>
                          <td>{o.party}</td>
                          <td className="fw-600">₱{o.total.toLocaleString("en-PH")}</td>
                          <td>
                            <span className={`status-badge status-${o.status}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="text-muted">{o.date || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                height: "100%",
              }}
            >
              <div className="card-header">
                <span className="card-title">Stock alerts</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => go("/products")}
                >
                  View
                </button>
              </div>
              <div
                className="card-body dash-alerts"
                style={{ flex: 1, overflow: "auto", minHeight: 0 }}
              >
                {alerts.length === 0 ? (
                  <div className="dash-alert success" onClick={() => go("/products")}>
                    <div className="dash-alert-dot" />
                    <div>
                      <div className="dash-alert-title">All clear</div>
                      <div className="dash-alert-msg">No low / out-of-stock SKUs flagged</div>
                    </div>
                  </div>
                ) : (
                  alerts.map((a, i) => (
                    <div
                      key={i}
                      className={`dash-alert ${a.type}`}
                      onClick={() => go(a.path)}
                    >
                      <div className="dash-alert-dot" />
                      <div>
                        <div className="dash-alert-title">{a.title}</div>
                        <div className="dash-alert-msg">{a.msg}</div>
                      </div>
                    </div>
                  ))
                )}
                {avgUtil < 50 && warehouses.length > 0 && (
                  <div className="dash-alert success" onClick={() => go("/capacity")}>
                    <div className="dash-alert-dot" />
                    <div>
                      <div className="dash-alert-title">Capacity available</div>
                      <div className="dash-alert-msg">
                        Network avg {avgUtil}% · room for inbound
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                height: "100%",
              }}
            >
              <div className="card-header">
                <span className="card-title">Live activity</span>
                <span className="dash-chart-meta">
                  "Live"
                </span>
              </div>
              <div
                className="card-body dash-activity"
                style={{ flex: 1, overflow: "auto", minHeight: 0 }}
              >
                <div className="dash-activity-item" onClick={() => go("/analytics")}>
                  <div className="dash-activity-dot" style={{ background: "#5A9A6E" }} />
                  <div className="dash-activity-body">
                    <div className="dash-activity-text">
                      Health {healthScore} · SO open {soPending} · PO {poPending}
                      {soValue > 0
                        ? ` · SO ₱${soValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`
                        : ""}
                      {poValue > 0
                        ? ` · PO ₱${poValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`
                        : ""}
                    </div>
                    <div className="dash-activity-time">Live metrics</div>
                  </div>
                </div>
                {activityFeed.length > 0
                  ? activityFeed.slice(0, 6).map((a, i) => (
                      <div
                        key={i}
                        className="dash-activity-item"
                        onClick={() => go(a.path)}
                      >
                        <div
                          className="dash-activity-dot"
                          style={{ background: a.color }}
                        />
                        <div className="dash-activity-body">
                          <div className="dash-activity-text">{a.text}</div>
                          <div className="dash-activity-time">{a.time}</div>
                        </div>
                      </div>
                    ))
                  : (
                    <>
                      <div className="dash-activity-item" onClick={() => go("/reports")}>
                        <div className="dash-activity-dot" style={{ background: "#9A6B45" }} />
                        <div className="dash-activity-body">
                          <div className="dash-activity-text">Export inventory & order reports</div>
                          <div className="dash-activity-time">Reports hub</div>
                        </div>
                      </div>
                      <div className="dash-activity-item" onClick={() => go("/cycle-count")}>
                        <div className="dash-activity-dot" style={{ background: "#6B9B7A" }} />
                        <div className="dash-activity-body">
                          <div className="dash-activity-text">Schedule cycle counts by zone</div>
                          <div className="dash-activity-time">Accuracy</div>
                        </div>
                      </div>
                    </>
                  )}
              </div>
            </div>
          </div>

          {canViewPath("/stock-movements") && recentMoves.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">Recent stock movements</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => go("/stock-movements")}
                >
                  View all
                </button>
              </div>
              <div className="card-body table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>From → To</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMoves.map((m) => (
                      <tr
                        key={m.id}
                        className="dash-order-row"
                        onClick={() => go("/stock-movements")}
                      >
                        <td>
                          <span className={`type-badge type-${String(m.type).toLowerCase()}`}>
                            {m.type}
                          </span>
                        </td>
                        <td>
                          <span className="dash-order-id">{m.product}</span>
                          {m.sku && <span className="dash-order-kind">{m.sku}</span>}
                        </td>
                        <td className="fw-600">{m.qty}</td>
                        <td className="text-muted">
                          {m.from} → {m.to}
                        </td>
                        <td className="text-muted">{m.date || "—"}</td>
                        <td>
                          <span className={`status-badge status-${m.status}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;