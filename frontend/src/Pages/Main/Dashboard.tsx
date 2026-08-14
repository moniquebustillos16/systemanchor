import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import api from "../../api/axios";
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
const IconFile = () => (
  <svg {...svg} width="18" height="18">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
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
const IconPlus = () => (
  <svg {...svg} width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
const IconBox = () => (
  <svg {...svg} width="18" height="18">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconTruck = () => (
  <svg {...svg} width="18" height="18">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconPackage = () => (
  <svg {...svg} width="18" height="18">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);
const IconRepeat = () => (
  <svg {...svg} width="18" height="18">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const IconCheck = () => (
  <svg {...svg} width="18" height="18">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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

/* ===================== CHARTS ===================== */

function chartSummary(label: string, data: number[], labels: string[], format = (n: number) => String(n)): string {
  if (!data.length) return `${label}: no data available.`;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const maxI = data.indexOf(max);
  const minI = data.indexOf(min);
  return `${label}. ${data.length} periods from ${labels[0] ?? "start"} to ${labels[labels.length - 1] ?? "end"}. Peak ${format(max)} in ${labels[maxI] ?? "—"}; low ${format(min)} in ${labels[minI] ?? "—"}.`;
}

function AreaChart({
  data,
  labels,
  color = "#8B6B45",
  height = 168,
  title = "Inventory value trend",
  formatValue = (v: number) => `₱${v.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`,
}: {
  data: number[];
  labels: string[];
  color?: string;
  height?: number;
  title?: string;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const w = 560;
  const h = height;
  const pad = { t: 14, r: 12, b: 28, l: 44 };
  const active = focusIdx ?? hover;

  if (!data.length) {
    return (
      <div
        className="chart-empty"
        style={{ height }}
        role="img"
        aria-label={`${title}: no data available`}
      >
        <span>No trend data available</span>
      </div>
    );
  }

  const max = Math.max(...data) * 1.08;
  const min = Math.min(...data) * 0.92;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad.l + (i / Math.max(data.length - 1, 1)) * (w - pad.l - pad.r);
    const y = pad.t + (1 - (v - min) / range) * (h - pad.t - pad.b);
    return { x, y, v };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    `M${pts[0].x},${h - pad.b} ` +
    pts.map((p) => `L${p.x},${p.y}`).join(" ") +
    ` L${pts[pts.length - 1].x},${h - pad.b} Z`;

  const yTicks = [0, 0.5, 1].map((t) => {
    const val = min + (1 - t) * range;
    const y = pad.t + t * (h - pad.t - pad.b);
    return { y, label: formatValue(val) };
  });

  const summary = chartSummary(title, data, labels, formatValue);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? 0 : Math.min(data.length - 1, i + 1)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? data.length - 1 : Math.max(0, i - 1)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(data.length - 1);
    } else if (e.key === "Escape") {
      setFocusIdx(null);
    }
  };

  return (
    <div className="chart-wrap chart-a11y">
      <p className="sr-only">{summary}</p>
      {active != null && pts[active] && (
        <div className="chart-tooltip" role="status" aria-live="polite">
          <strong>{formatValue(pts[active].v)}</strong>
          <span>{labels[active] ?? ""}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="chart-svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height, display: "block" }}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setFocusIdx(null)}
      >
        <title>{title}</title>
        <desc>{summary}</desc>
        <defs>
          <linearGradient id="areaFillA11y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => (
          <g key={i} aria-hidden="true">
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={tick.y}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            <text
              x={pad.l - 6}
              y={tick.y + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.45"
            >
              {tick.label}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#areaFillA11y)" aria-hidden="true" />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        />
        {pts.map((pt, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setFocusIdx(i)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={pt.x}
              cy={pt.y}
              r={active === i ? 5.5 : 3}
              fill={color}
              stroke="#fff"
              strokeWidth="1.5"
              tabIndex={-1}
            >
              <title>{`${labels[i]}: ${formatValue(pt.v)}`}</title>
            </circle>
            <circle cx={pt.x} cy={pt.y} r="12" fill="transparent">
              <title>{`${labels[i]}: ${formatValue(pt.v)}`}</title>
            </circle>
          </g>
        ))}
        {labels.map((lb, i) =>
          pts[i] ? (
            <text
              key={lb + i}
              x={pts[i].x}
              y={h - 10}
              textAnchor="middle"
              fontSize="10.5"
              fill="currentColor"
              opacity={active === i ? 0.9 : 0.4}
              fontWeight={active === i ? 600 : 400}
              aria-hidden="true"
            >
              {lb}
            </text>
          ) : null
        )}
      </svg>
      <div className="chart-data-table-wrap">
        <table className="chart-data-table sr-only">
          <caption>{title} data table</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v, i) => (
              <tr key={i}>
                <td>{labels[i] ?? i + 1}</td>
                <td>{formatValue(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-kbd-hint sr-only">
        Chart is focusable. Use arrow keys to move between points, Home and End for first and last.
      </p>
    </div>
  );
}

function DualBarChart({
  inData,
  outData,
  labels,
  title = "Stock movement",
}: {
  inData: number[];
  outData: number[];
  labels: string[];
  title?: string;
}) {
  const [hover, setHover] = useState<{ i: number; kind: "in" | "out" } | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  const all = [...inData, ...outData].filter((n) => n > 0);
  const rawMax = Math.max(...inData, ...outData, 1);
  const sorted = [...all].sort((a, b) => a - b);
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : rawMax;
  const max = Math.max(p90 * 1.25, rawMax * 0.35, 1);

  if (!labels.length) {
    return (
      <div
        className="chart-empty"
        style={{ minHeight: 160 }}
        role="img"
        aria-label={`${title}: no data available`}
      >
        <span>No movement data</span>
      </div>
    );
  }

  const summary = `${title}. ${labels.length} periods. Stock in and stock out by period. Peak in ${Math.max(...inData, 0)}, peak out ${Math.max(...outData, 0)}. Bars may be scaled for readability.`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? 0 : Math.min(labels.length - 1, i + 1)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? labels.length - 1 : Math.max(0, i - 1)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(labels.length - 1);
    } else if (e.key === "Escape") {
      setFocusIdx(null);
    }
  };

  return (
    <div
      className="dual-bar-chart chart-a11y"
      role="group"
      aria-label={summary}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setFocusIdx(null)}
    >
      <p className="sr-only">{summary}</p>
      <div className="dual-bar-legend" aria-hidden="true">
        <span>
          <span className="lg-dot in" />
          Stock In
        </span>
        <span>
          <span className="lg-dot out" />
          Stock Out
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          height: 128,
          padding: "0 2px",
        }}
      >
        {labels.map((lb, i) => {
          const inV = inData[i] || 0;
          const outV = outData[i] || 0;
          const inH = Math.min(100, (inV / max) * 100);
          const outH = Math.min(100, (outV / max) * 100);
          const isFocus = focusIdx === i;
          const showIn = (hover?.i === i && hover.kind === "in") || isFocus;
          const showOut = (hover?.i === i && hover.kind === "out") || isFocus;
          return (
            <div
              key={lb}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 3,
                  height: 110,
                  width: "100%",
                  justifyContent: "center",
                  position: "relative",
                  outline: isFocus ? "2px solid var(--sa-brown)" : undefined,
                  outlineOffset: 2,
                  borderRadius: 4,
                }}
                aria-label={`${lb}: in ${inV}, out ${outV}`}
              >
                {(showIn || showOut) && (
                  <div className="chart-tooltip chart-tooltip-bar" role="status">
                    {isFocus
                      ? `${lb}: In ${inV} · Out ${outV}`
                      : showIn
                        ? `In: ${inV}`
                        : `Out: ${outV}`}
                  </div>
                )}
                <div
                  role="img"
                  aria-label={`Stock in ${lb}: ${inV}`}
                  title={`In: ${inV}`}
                  onMouseEnter={() => setHover({ i, kind: "in" })}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    width: "40%",
                    maxWidth: 14,
                    height: `${Math.max(inH, inV > 0 ? 6 : 3)}%`,
                    minHeight: 3,
                    borderRadius: "4px 4px 1px 1px",
                    background: "var(--sa-sage-deep, #558F66)",
                    opacity: hover && hover.i !== i ? 0.4 : 0.92,
                  }}
                />
                <div
                  role="img"
                  aria-label={`Stock out ${lb}: ${outV}`}
                  title={`Out: ${outV}`}
                  onMouseEnter={() => setHover({ i, kind: "out" })}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    width: "40%",
                    maxWidth: 14,
                    height: `${Math.max(outH, outV > 0 ? 6 : 3)}%`,
                    minHeight: 3,
                    borderRadius: "4px 4px 1px 1px",
                    background: "var(--sa-brown, #8B6B45)",
                    opacity: hover && hover.i !== i ? 0.4 : 0.88,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  opacity: isFocus ? 0.9 : 0.45,
                  fontWeight: isFocus ? 600 : 400,
                  letterSpacing: "0.01em",
                }}
                aria-hidden="true"
              >
                {lb}
              </span>
            </div>
          );
        })}
      </div>
      <table className="chart-data-table sr-only">
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Stock in</th>
            <th scope="col">Stock out</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((lb, i) => (
            <tr key={lb}>
              <td>{lb}</td>
              <td>{inData[i] ?? 0}</td>
              <td>{outData[i] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="chart-kbd-hint sr-only">
        Use arrow keys to move between periods when this chart is focused.
      </p>
    </div>
  );
}

function DonutChart({
  segments,
  centerValue,
  centerLabel,
  title = "Category mix",
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  title?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const rings = segments.map((seg) => {
    const len = (seg.value / total) * c;
    const offset = c - acc;
    acc += len;
    return { ...seg, len, offset, pct: Math.round((seg.value / total) * 100) };
  });

  const active = focusIdx ?? hover;
  const activeSeg = active != null ? rings[active] : null;
  const summary = `${title}. ${centerValue} ${centerLabel}. ${rings
    .map((s) => `${s.label} ${s.pct}%`)
    .join(", ")}.`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rings.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? 0 : (i + 1) % rings.length));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i == null ? rings.length - 1 : (i - 1 + rings.length) % rings.length));
    } else if (e.key === "Escape") {
      setFocusIdx(null);
    }
  };

  return (
    <div
      className="donut-chart chart-a11y"
      style={{ minHeight: 200 }}
      role="group"
      aria-label={summary}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setFocusIdx(null)}
    >
      <p className="sr-only">{summary}</p>
      <svg
        viewBox="0 0 140 140"
        width={140}
        height={140}
        style={{ flexShrink: 0 }}
        role="img"
        aria-hidden="true"
      >
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.06"
          strokeWidth="14"
        />
        {rings.map((seg, i) => (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={active === i ? 16 : 14}
            strokeDasharray={`${seg.len} ${c - seg.len}`}
            strokeDashoffset={seg.offset}
            transform="rotate(-90 70 70)"
            opacity={active != null && active !== i ? 0.35 : 1}
            style={{ transition: "stroke-width 0.15s, opacity 0.15s", cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${seg.label}: ${seg.pct}%`}</title>
          </circle>
        ))}
        <text x="70" y="64" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">
          {activeSeg ? `${activeSeg.pct}%` : centerValue}
        </text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.5">
          {activeSeg ? activeSeg.label : centerLabel}
        </text>
      </svg>
      <ul className="donut-legend" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {segments.map((s, i) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <li
              key={s.label}
              className="donut-leg-row"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setFocusIdx(i)}
              tabIndex={0}
              aria-label={`${s.label}: ${pct}%`}
              style={{
                opacity: active != null && active !== i ? 0.45 : 1,
                cursor: "pointer",
                outline: focusIdx === i ? "2px solid var(--sa-brown)" : undefined,
                outlineOffset: 2,
                borderRadius: 6,
                padding: "2px 4px",
              }}
            >
              <span className="donut-leg-dot" style={{ background: s.color }} aria-hidden="true" />
              <span className="donut-leg-name">{s.label}</span>
              <span className="donut-leg-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
      <table className="chart-data-table sr-only">
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{Math.round((s.value / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const max = Math.max(...stages.map((s) => s.count), 1);
  if (!stages.length) {
    return (
      <div
        className="chart-empty"
        style={{ minHeight: 160 }}
        role="img"
        aria-label={`${title}: no data available`}
      >
        <span>No pipeline data</span>
      </div>
    );
  }
  const summary = `${title}. ${stages.map((s) => `${s.label}: ${s.count}`).join("; ")}.`;
  return (
    <div className="pipeline-list chart-a11y" role="list" aria-label={summary}>
      <p className="sr-only">{summary}</p>
      {stages.map((s) => (
        <div
          key={s.label}
          className="pipeline-row"
          role="listitem"
          aria-label={`${s.label}: ${s.count}`}
        >
          <div className="pipeline-row-top">
            <span className="pipeline-label">{s.label}</span>
            <span className="pipeline-count" style={{ color: s.color }}>
              {s.count.toLocaleString()}
            </span>
          </div>
          <div
            className="pipeline-track"
            role="meter"
            aria-valuenow={s.count}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={`${s.label} relative volume`}
          >
            <div
              className="pipeline-fill"
              style={{
                width: `${(s.count / max) * 100}%`,
                background: s.color,
              }}
            />
          </div>
        </div>
      ))}
      <table className="chart-data-table sr-only">
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== HELPERS ===================== */



/* ===================== ROLE PERMISSIONS ===================== */

type AuthPayload = {
  permissions?: string[];
  data?: { permissions?: string[]; user?: { permissions?: string[] } };
  user?: {
    permissions?: string[];
    role_id?: string;
    role?: { id?: string; permissions?: { name: string }[] };
  };
};

function extractPermissions(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const j = json as AuthPayload;
  if (Array.isArray(j.permissions)) return j.permissions.map(String);
  if (Array.isArray(j.data?.permissions)) return j.data!.permissions!.map(String);
  if (Array.isArray(j.user?.permissions)) return j.user!.permissions!.map(String);
  const rolePerms = j.user?.role?.permissions;
  if (Array.isArray(rolePerms)) {
    return rolePerms.map((p) => (typeof p === "string" ? p : p?.name)).filter(Boolean) as string[];
  }
  const du = (j as { data?: { user?: { permissions?: string[] } } }).data?.user;
  if (Array.isArray(du?.permissions)) return du!.permissions!.map(String);
  return [];
}

function can(perms: string[], ...needed: string[]): boolean {
  if (perms.includes("*") || perms.includes("admin") || perms.includes("Admin")) return true;
  return needed.some((n) => perms.includes(n));
}

/** Path / feature → view permissions */
const PATH_VIEW: Record<string, string[]> = {
  "/products": ["inventory.view", "inventories.view", "products.view"],
  "/inventory": ["inventory.view", "inventories.view", "products.view"],
  "/stock-movements": ["stock_movements.view", "stock-movements.view", "movements.view"],
  "/purchase-orders": ["purchase_orders.view", "purchase-orders.view"],
  "/sales-orders": ["sales_orders.view", "sales-orders.view"],
  "/goods-receiving": ["receiving.view", "goods_receipts.view", "goods-receipts.view"],
  "/receiving": ["receiving.view", "goods_receipts.view", "goods-receipts.view"],
  "/shipping": ["shipping.view", "shipments.view"],
  "/returns": ["returns.view"],
  "/warehouses": ["warehouses.view", "locations.view"],
  "/capacity": ["capacity.view", "warehouses.view"],
  "/cycle-count": ["cycle_counts.view", "cycle-counts.view"],
  "/analytics": ["analytics.view", "reports.view", "dashboard.view"],
  "/reports": ["reports.view", "analytics.view"],
  "/dashboard": ["dashboard.view"],
};

function canPath(perms: string[], path: string): boolean {
  const needed = PATH_VIEW[path];
  if (!needed) return true;
  return can(perms, ...needed);
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
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const CAT_COLORS = ["#9A6B45", "#C4A07A", "#6B9B7A", "#C49A5A", "#A89880", "#5A9A6E"];

/* ===================== COMPONENT ===================== */

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

function Dashboard() {
  const navigate = useNavigate();
  const [trendRange, setTrendRange] = useState("7m");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [usingUnified, setUsingUnified] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permsLoaded, setPermsLoaded] = useState(false);

  const [invValue, setInvValue] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [outStock, setOutStock] = useState(0);
  const [skuCount, setSkuCount] = useState(0);

  const [soPending, setSoPending] = useState(0);
  const [soAll, setSoAll] = useState(0);
  const [soDone, setSoDone] = useState(0);
  const [poPending, setPoPending] = useState(0);
  const [poAll, setPoAll] = useState(0);
  const [soValue, setSoValue] = useState(0);
  const [poValue, setPoValue] = useState(0);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [categories, setCategories] = useState<
    { label: string; value: number; color: string }[]
  >([]);
  const [pipeline, setPipeline] = useState<
    { label: string; count: number; color: string }[]
  >([]);

  const [serverTrend, setServerTrend] = useState<number[] | null>(null);
  const [serverTrendLabels, setServerTrendLabels] = useState<string[] | null>(null);
  const [serverStockIn, setServerStockIn] = useState<number[] | null>(null);
  const [serverStockOut, setServerStockOut] = useState<number[] | null>(null);
  const [serverHealth, setServerHealth] = useState<number | null>(null);
  const [avgUtilServer, setAvgUtilServer] = useState<number | null>(null);

  const [moveStats, setMoveStats] = useState<OpsStats>({});
  const [cycleStats, setCycleStats] = useState<OpsStats>({});
  const [receiptStats, setReceiptStats] = useState<OpsStats>({});
  const [returnStats, setReturnStats] = useState<OpsStats>({});
  const [recentMoves, setRecentMoves] = useState<MovementRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);


  const fetchUserPermissions = useCallback(async () => {
    const finish = (list: string[]) => {
      setUserPermissions(list);
      setPermsLoaded(true);
    };
    try {
      for (const key of ["permissions", "user", "auth_user", "sa-user"]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string")) {
            finish(parsed as string[]);
            return;
          }
          const list = extractPermissions(parsed);
          if (list.length > 0) {
            finish(list);
            return;
          }
          const u = parsed?.data ?? parsed?.user ?? parsed;
          const rid = u?.role_id || u?.role?.id;
          if (rid) {
            try {
              const { data: json } = await api.get(`/roles/${rid}/permissions`);
              const perms =
                json?.data?.permissions ?? json?.permissions ?? json?.data ?? [];
              if (Array.isArray(perms)) {
                finish(
                  perms
                    .map((p: { name?: string } | string) =>
                      typeof p === "string" ? p : p?.name
                    )
                    .filter(Boolean) as string[]
                );
                return;
              }
            } catch { /* */ }
          }
        } catch {
          /* next */
        }
      }
    } catch {
      /* */
    }
    try {
      const { data: json } = await api.get("/me");
      const list = extractPermissions(json);
      if (list.length > 0) {
        finish(list);
        return;
      }
    } catch {
      /* */
    }
    finish(["*"]);
  }, []);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const canViewPath = useCallback(
    (path: string) => !permsLoaded || canPath(userPermissions, path),
    [userPermissions, permsLoaded]
  );

  const applyUnified = useCallback((d: Record<string, unknown>) => {
    setInvValue(Number(d.inventory_value ?? 0));
    setLowStock(Number(d.low_stock ?? 0));
    setOutStock(Number(d.out_of_stock ?? 0));
    setSkuCount(Number(d.total_products ?? 0));

    const so = (d.sales_orders ?? {}) as Record<string, number>;
    setSoAll(Number(so.all ?? 0));
    setSoPending(Number(so.pending ?? 0));
    setSoDone(Number(so.done ?? 0));
    setSoValue(Number(so.total_value ?? 0));

    const po = (d.purchase_orders ?? {}) as Record<string, number>;
    setPoAll(Number(po.all ?? 0));
    setPoPending(Number(po.pending ?? 0));
    setPoValue(Number(po.total_value ?? 0));

    setWarehouses((d.warehouses as Warehouse[]) ?? []);
    setAvgUtilServer(typeof d.avg_utilization === "number" ? d.avg_utilization : null);
    setRecentOrders((d.recent_orders as OrderRow[]) ?? []);
    setAlerts((d.stock_alerts as AlertItem[]) ?? []);
    setCategories(
      (d.category_mix as { label: string; value: number; color: string }[])?.length
        ? (d.category_mix as { label: string; value: number; color: string }[])
        : [{ label: "Catalog", value: 1, color: CAT_COLORS[0] }]
    );
    setPipeline(
      (d.pipeline as { label: string; count: number; color: string }[]) ?? []
    );

    setServerTrend(Array.isArray(d.inventory_trend) ? (d.inventory_trend as number[]) : null);
    setServerTrendLabels(Array.isArray(d.trend_labels) ? (d.trend_labels as string[]) : null);
    setServerStockIn(Array.isArray(d.stock_in_series) ? (d.stock_in_series as number[]) : null);
    setServerStockOut(Array.isArray(d.stock_out_series) ? (d.stock_out_series as number[]) : null);
    setServerHealth(typeof d.health_score === "number" ? d.health_score : null);

    setMoveStats((d.stock_movements as OpsStats) ?? {});
    setCycleStats((d.cycle_counts as OpsStats) ?? {});
    setReceiptStats((d.goods_receipts as OpsStats) ?? {});
    setReturnStats((d.returns as OpsStats) ?? {});
    setRecentMoves((d.recent_movements as MovementRow[]) ?? []);
    setActivityFeed((d.activity_feed as ActivityItem[]) ?? []);
    setUsingUnified(true);
  }, []);

  const loadLegacy = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get("/inventories/stats").then((r) => r.data),
      api.get("/sales-orders/stats").then((r) => r.data),
      api.get("/purchase-orders/stats").then((r) => r.data),
      api.get("/warehouses", { params: { per_page: 50 } }).then((r) => r.data),
      api.get("/sales-orders", { params: { per_page: 8, sort: 'order_date', dir: 'desc' } }).then((r) => r.data),
      api.get("/purchase-orders", { params: { per_page: 6, sort: 'order_date', dir: 'desc' } }).then((r) => r.data),
      api.get("/inventories", { params: { per_page: 50, status: 'low-stock' } }).then((r) => r.data),
      api.get("/inventories", { params: { per_page: 30, status: 'out-of-stock' } }).then((r) => r.data),
      api.get("/categories", { params: { per_page: 20 } }).then((r) => r.data),
      api.get("/stock-movements", { params: { per_page: 8 } }).then((r) => r.data),
      api.get("/cycle-counts/stats").then((r) => r.data).catch(() => null),
      api.get("/goods-receipts/stats").then((r) => r.data).catch(() => null),
      api.get("/returns/stats").then((r) => r.data).catch(() => null),
    ]);

    if (results[0].status === "fulfilled") {
      const j = results[0].value as Record<string, number>;
      setInvValue(Number(j.inventory_value ?? 0));
      setLowStock(Number(j.low_stock ?? 0));
      setOutStock(Number(j.out_of_stock ?? 0));
      setSkuCount(Number(j.total_products ?? 0));
    }
    if (results[1].status === "fulfilled") {
      const j = results[1].value as Record<string, number>;
      setSoAll(Number(j.all ?? 0));
      setSoPending(Number(j.pending ?? 0));
      setSoDone(Number(j.done ?? 0));
      setSoValue(Number(j.total_value ?? 0));
    }
    if (results[2].status === "fulfilled") {
      const j = results[2].value as Record<string, number>;
      setPoAll(Number(j.all ?? j.total ?? 0));
      setPoPending(Number(j.pending ?? 0));
      setPoValue(Number(j.total_value ?? 0));
    }
    if (results[3].status === "fulfilled") {
      const j = results[3].value as { data?: Warehouse[] } | Warehouse[];
      setWarehouses(Array.isArray(j) ? j : j.data ?? []);
    }

    const soList =
      results[4].status === "fulfilled"
        ? Array.isArray(results[4].value)
          ? results[4].value
          : (results[4].value as { data?: unknown[] }).data ?? []
        : [];
    const poList =
      results[5].status === "fulfilled"
        ? Array.isArray(results[5].value)
          ? results[5].value
          : (results[5].value as { data?: unknown[] }).data ?? []
        : [];

    const merged: OrderRow[] = [
      ...(soList as Record<string, unknown>[]).slice(0, 4).map((o) => ({
        id: String(o.so_number ?? o.id ?? "SO"),
        kind: "SO" as const,
        party: String((o.customer as { name?: string })?.name ?? "—"),
        total: Number(o.total ?? 0),
        status: String(o.status ?? "pending"),
        date: String(o.order_date ?? "").slice(0, 10),
      })),
      ...(poList as Record<string, unknown>[]).slice(0, 2).map((o) => ({
        id: String(o.po_number ?? o.id ?? "PO"),
        kind: "PO" as const,
        party: String((o.supplier as { name?: string })?.name ?? "—"),
        total: Number(o.total ?? 0),
        status: String(o.status ?? "pending"),
        date: String(o.order_date ?? "").slice(0, 10),
      })),
    ];
    setRecentOrders(merged);

    const lowList =
      results[6].status === "fulfilled"
        ? Array.isArray(results[6].value)
          ? results[6].value
          : (results[6].value as { data?: unknown[] }).data ?? []
        : [];
    const oosList =
      results[7].status === "fulfilled"
        ? Array.isArray(results[7].value)
          ? results[7].value
          : (results[7].value as { data?: unknown[] }).data ?? []
        : [];

    const nextAlerts: AlertItem[] = [];
    (oosList as Record<string, unknown>[]).slice(0, 2).forEach((p) => {
      nextAlerts.push({
        type: "danger",
        title: "Out of stock",
        msg: `${p.name ?? p.sku} · 0 units`,
        path: "/products",
      });
    });
    (lowList as Record<string, unknown>[]).slice(0, 2).forEach((p) => {
      nextAlerts.push({
        type: "warning",
        title: "Low stock",
        msg: `${p.name ?? p.sku} · ${p.qty} remaining`,
        path: "/products",
      });
    });
    setAlerts(nextAlerts);

    if (results[8].status === "fulfilled") {
      const raw = results[8].value;
      const list = Array.isArray(raw) ? raw : (raw as { data?: unknown[] }).data ?? [];
      const segs = (list as { name?: string }[]).slice(0, 5).map((c, i) => ({
        label: c.name || `Cat ${i + 1}`,
        value: Math.max(1, 5 - i),
        color: CAT_COLORS[i % CAT_COLORS.length],
      }));
      setCategories(
        segs.length ? segs : [{ label: "Catalog", value: 1, color: CAT_COLORS[0] }]
      );
    }

    if (results[9].status === "fulfilled") {
      const raw = results[9].value;
      const list = Array.isArray(raw)
        ? raw
        : (raw as { data?: unknown[] }).data ?? [];
      setRecentMoves(
        (list as Record<string, unknown>[]).slice(0, 8).map((m) => ({
          id: String(m.id ?? ""),
          type: String(m.type ?? ""),
          qty: Number(m.qty ?? 0),
          product: String(
            (m.product as { name?: string; sku?: string })?.name ??
              (m.product as { sku?: string })?.sku ??
              "—"
          ),
          sku: (m.product as { sku?: string })?.sku,
          from: String((m.from_warehouse as { code?: string })?.code ?? m.from ?? "—"),
          to: String((m.to_warehouse as { code?: string })?.code ?? m.to ?? "—"),
          reference: m.reference ? String(m.reference) : undefined,
          date: String(m.movement_date ?? m.date ?? "").slice(0, 10),
          status: String(m.status ?? "posted"),
        }))
      );
    }

    if (results[10].status === "fulfilled" && results[10].value) {
      setCycleStats(results[10].value as OpsStats);
    }
    if (results[11].status === "fulfilled" && results[11].value) {
      setReceiptStats(results[11].value as OpsStats);
    }
    if (results[12].status === "fulfilled" && results[12].value) {
      setReturnStats(results[12].value as OpsStats);
    }

    setUsingUnified(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer unified dashboard endpoint (advanced aggregator)
      try {
        const dash = await api.get("/dashboard", { params: { range: trendRange } }).then((r) => r.data);
        applyUnified(dash as Record<string, unknown>);
        setLastUpdated(new Date());
        return;
      } catch {
        // Fall back to multi-endpoint legacy path
      }
      await loadLegacy();
      setLastUpdated(new Date());
    } catch {
      /* partial data ok */
    } finally {
      setLoading(false);
    }
  }, [applyUnified, loadLegacy, trendRange]);

  useEffect(() => {
    load();
  }, [load]);

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
    if (avgUtilServer != null) return avgUtilServer;
    if (!warehouses.length) return 0;
    return Math.round(
      warehouses.reduce((s, w) => s + Number(w.utilized ?? 0), 0) / warehouses.length
    );
  }, [warehouses, avgUtilServer]);

  const warehousesSorted = useMemo(
    () =>
      [...warehouses].sort(
        (a, b) => Number(b.utilized ?? 0) - Number(a.utilized ?? 0)
      ),
    [warehouses]
  );

  const invTrend = useMemo(() => {
    if (serverTrend && serverTrend.length) return serverTrend;
    const base = invValue || 1000;
    const factors =
      trendRange === "3m"
        ? [0.88, 0.94, 1]
        : trendRange === "1y"
          ? [0.7, 0.75, 0.78, 0.85, 0.9, 0.88, 0.95, 0.92, 0.96, 0.98, 0.97, 1]
          : [0.75, 0.82, 0.78, 0.9, 0.95, 0.92, 1];
    return factors.map((f) => Math.round(base * f));
  }, [invValue, trendRange, serverTrend]);

  const trendLabels = useMemo(() => {
    if (serverTrendLabels && serverTrendLabels.length) return serverTrendLabels;
    if (trendRange === "3m") return MONTHS.slice(-3);
    if (trendRange === "1y")
      return ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    return MONTHS;
  }, [trendRange, serverTrendLabels]);

  const stockIn = useMemo(() => {
    if (serverStockIn && serverStockIn.length) return serverStockIn;
    return invTrend.map((v, i) => Math.max(5, Math.round((v / 10000) * (0.8 + (i % 3) * 0.1))));
  }, [invTrend, serverStockIn]);

  const stockOut = useMemo(() => {
    if (serverStockOut && serverStockOut.length) return serverStockOut;
    return invTrend.map((v, i) => Math.max(4, Math.round((v / 12000) * (0.7 + (i % 4) * 0.08))));
  }, [invTrend, serverStockOut]);

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
    if (serverHealth != null) return serverHealth;
    let s = 100;
    if (skuCount > 0) {
      s -= Math.min(35, (outStock / skuCount) * 100);
      s -= Math.min(20, (lowStock / skuCount) * 40);
    }
    if (avgUtil > 90) s -= 10;
    return Math.max(0, Math.round(s));
  }, [skuCount, outStock, lowStock, avgUtil, serverHealth]);

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
                {dateStr} · Naga region · {warehouses.length} sites · health {healthScore}
                {loading ? " · loading…" : ""}
              </p>
            </div>
            <div className="dash-hero-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => navigate("/reports")}
              >
                <IconFileText /> Reports
              </button>
              <button className="btn btn-secondary" type="button" onClick={load} disabled={loading}>
                Refresh
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate("/stock-movements")}
              >
                <IconPlus /> Quick Actions
              </button>
            </div>
          </div>

          <div className="dash-kpi-grid">
            <div className="dash-kpi" onClick={() => navigate("/products")}>
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#F5EDE4", ["--kpi-fg" as string]: "#9A6B45" }}
                >
                  <IconLayers />
                </div>
                <span className="stat-change up">{skuCount} SKUs</span>
              </div>
              <div className="dash-kpi-value">
                ₱{invValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
              </div>
              <div className="dash-kpi-label">Inventory value</div>
            </div>
            <div className="dash-kpi" onClick={() => navigate("/capacity")}>
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#E8F5EC", ["--kpi-fg" as string]: "#5A9A6E" }}
                >
                  <IconBuilding />
                </div>
              </div>
              <div className="dash-kpi-value">{avgUtil}%</div>
              <div className="dash-kpi-label">Avg. warehouse utilization</div>
            </div>
            <div className="dash-kpi" onClick={() => navigate("/products")}>
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#FEF6E8", ["--kpi-fg" as string]: "#C49A5A" }}
                >
                  <IconAlert />
                </div>
                <span className="stat-change down">{lowStock + outStock}</span>
              </div>
              <div className="dash-kpi-value">
                {lowStock}
                <span className="dash-kpi-sub"> low</span>
                {" · "}
                {outStock}
                <span className="dash-kpi-sub"> out</span>
              </div>
              <div className="dash-kpi-label">Stock alerts</div>
            </div>
            <div className="dash-kpi" onClick={() => navigate("/sales-orders")}>
              <div className="dash-kpi-top">
                <div
                  className="dash-kpi-icon"
                  style={{ ["--kpi-bg" as string]: "#EEF6F0", ["--kpi-fg" as string]: "#6B9B7A" }}
                >
                  <IconCart />
                </div>
              </div>
              <div className="dash-kpi-value">{soPending + poPending}</div>
              <div className="dash-kpi-label">Open orders (SO + PO)</div>
            </div>
          </div>

          <div className="dash-insights">
            <div className="dash-insight" onClick={() => navigate("/products")}>
              <div
                className="dash-insight-icon"
                style={{ background: "rgba(196,154,90,0.12)", color: "#C49A5A" }}
              >
                <IconBox />
              </div>
              <div className="dash-insight-body">
                <div className="dash-insight-title">
                  {lowStock + outStock} SKUs need attention
                </div>
                <div className="dash-insight-msg">Low or out of stock — review reorder rules</div>
              </div>
              <span className="dash-insight-arrow">→</span>
            </div>
            <div className="dash-insight" onClick={() => navigate("/purchase-orders")}>
              <div
                className="dash-insight-icon"
                style={{ background: "rgba(154,107,69,0.12)", color: "#9A6B45" }}
              >
                <IconFile />
              </div>
              <div className="dash-insight-body">
                <div className="dash-insight-title">{poPending} open purchase orders</div>
                <div className="dash-insight-msg">Keep inbound moving</div>
              </div>
              <span className="dash-insight-arrow">→</span>
            </div>
            <div className="dash-insight" onClick={() => navigate("/sales-orders")}>
              <div
                className="dash-insight-icon"
                style={{ background: "rgba(90,154,110,0.12)", color: "#3d7a4e" }}
              >
                <IconCart />
              </div>
              <div className="dash-insight-body">
                <div className="dash-insight-title">{soPending} open sales orders</div>
                <div className="dash-insight-msg">Ready for pick, pack, and ship</div>
              </div>
              <span className="dash-insight-arrow">→</span>
            </div>
          </div>

          <div className="dash-quick">
            {[
              { label: "Stock In", icon: <IconPackage />, path: "/stock-movements" },
              { label: "Stock Out", icon: <IconTruck />, path: "/shipping" },
              { label: "Transfer", icon: <IconRepeat />, path: "/stock-movements" },
              { label: "Cycle Count", icon: <IconCheck />, path: "/cycle-count" },
              { label: "New PO", icon: <IconFile />, path: "/purchase-orders" },
              { label: "New SO", icon: <IconCart />, path: "/sales-orders" },
            ]
              .filter((a) => canViewPath(a.path))
              .map((a) => (
              <button
                key={a.label}
                type="button"
                className="dash-quick-btn"
                onClick={() => navigate(a.path)}
              >
                {a.icon}
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <div className="dash-ops-strip">
            {canViewPath("/stock-movements") && (
            <div className="dash-ops-card" onClick={() => navigate("/stock-movements")}>
              <div className="dash-ops-icon" style={{ background: "rgba(90,154,110,0.12)", color: "#5A9A6E" }}>
                <IconPackage />
              </div>
              <div>
                <div className="dash-ops-value">{moveStats.this_week ?? moveStats.today ?? "—"}</div>
                <div className="dash-ops-label">Moves this week</div>
                <div className="dash-ops-meta">
                  In {moveStats.in ?? 0} · Out {moveStats.out ?? 0}
                </div>
              </div>
            </div>
            )}
            {canViewPath("/cycle-count") && (
            <div className="dash-ops-card" onClick={() => navigate("/cycle-count")}>
              <div className="dash-ops-icon" style={{ background: "rgba(196,154,90,0.12)", color: "#C49A5A" }}>
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
            <div className="dash-ops-card" onClick={() => navigate("/receiving")}>
              <div className="dash-ops-icon" style={{ background: "rgba(154,107,69,0.12)", color: "#9A6B45" }}>
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
            <div className="dash-ops-card" onClick={() => navigate("/returns")}>
              <div className="dash-ops-icon" style={{ background: "rgba(184,92,74,0.12)", color: "#B85C4A" }}>
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
                <span className="card-title">Inventory value trend</span>
                <div className="chart-tabs">
                  {["3m", "7m", "1y"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`chart-tab ${trendRange === r ? "active" : ""}`}
                      onClick={() => setTrendRange(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body" style={{ padding: "4px 14px 12px" }}>
                <AreaChart data={invTrend} labels={trendLabels} color="#8B6B45" height={168} />
              </div>
            </div>

            <div className="card dash-chart-card">
              <div className="card-header">
                <span className="card-title">Stock movement</span>
                <span className="dash-chart-meta">Indexed</span>
              </div>
              <div className="card-body" style={{ padding: "4px 14px 12px" }}>
                <DualBarChart inData={stockIn} outData={stockOut} labels={trendLabels} />
              </div>
            </div>
          </div>

          <div className="dash-charts-3">
            <div className="card dash-chart-card dash-chart-card-flex">
              <div className="card-header">
                <span className="card-title">Warehouse utilization</span>
                <span className="dash-chart-meta">By site</span>
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
                          onClick={() => navigate("/capacity")}
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
                        onClick={() => navigate("/capacity")}
                      >
                        View all {warehousesSorted.length} sites
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="card dash-chart-card dash-chart-card-flex">
              <div className="card-header">
                <span className="card-title">Category mix</span>
                <span className="dash-chart-meta">Catalog</span>
              </div>
              <div className="card-body" style={{ padding: "12px 16px 16px", flex: 1 }}>
                <DonutChart
                  segments={
                    categories.length
                      ? categories
                      : [{ label: "—", value: 1, color: "#A89880" }]
                  }
                  centerValue={`${skuCount}`}
                  centerLabel="SKUs"
                />
              </div>
            </div>

            <div className="card dash-chart-card dash-chart-card-flex">
              <div className="card-header">
                <span className="card-title">Order pipeline</span>
                <span className="dash-chart-meta">SO / PO</span>
              </div>
              <div className="card-body" style={{ padding: "12px 18px 16px", flex: 1 }}>
                <PipelineChart stages={pipeline} />
              </div>
            </div>
          </div>

          <div className="dash-bottom">
            <div className="card dash-orders-card">
              <div className="card-header">
                <span className="card-title">Recent orders</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => navigate("/sales-orders")}
                >
                  View all
                </button>
              </div>
              <div className="card-body table-wrap">
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
                            navigate(o.kind === "SO" ? "/sales-orders" : "/purchase-orders")
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

            <div className="dash-side">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Stock alerts</span>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    onClick={() => navigate("/products")}
                  >
                    View
                  </button>
                </div>
                <div className="card-body dash-alerts">
                  {alerts.length === 0 ? (
                    <div className="dash-alert success" onClick={() => navigate("/products")}>
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
                        onClick={() => navigate(a.path)}
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
                    <div className="dash-alert success" onClick={() => navigate("/capacity")}>
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

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Live activity</span>
                  <span className="dash-chart-meta">
                    {usingUnified ? "Unified API" : "Legacy"}
                  </span>
                </div>
                <div className="card-body dash-activity">
                  <div className="dash-activity-item" onClick={() => navigate("/analytics")}>
                    <div className="dash-activity-dot" style={{ background: "#5A9A6E" }} />
                    <div className="dash-activity-body">
                      <div className="dash-activity-text">
                        Health {healthScore} · SO open {soPending} · PO {poPending}
                        {soValue > 0 ? ` · SO ₱${soValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}` : ""}
                      </div>
                      <div className="dash-activity-time">Live metrics</div>
                    </div>
                  </div>
                  {activityFeed.length > 0
                    ? activityFeed.slice(0, 5).map((a, i) => (
                        <div
                          key={i}
                          className="dash-activity-item"
                          onClick={() => navigate(a.path)}
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
                        <div className="dash-activity-item" onClick={() => navigate("/reports")}>
                          <div className="dash-activity-dot" style={{ background: "#9A6B45" }} />
                          <div className="dash-activity-body">
                            <div className="dash-activity-text">Export inventory & order reports</div>
                            <div className="dash-activity-time">Reports hub</div>
                          </div>
                        </div>
                        <div className="dash-activity-item" onClick={() => navigate("/cycle-count")}>
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
          </div>

          {recentMoves.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">Recent stock movements</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => navigate("/stock-movements")}
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
                        onClick={() => navigate("/stock-movements")}
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