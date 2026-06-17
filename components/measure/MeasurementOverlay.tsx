'use client';

import type { Vec3, MeasurementUnit } from '@/lib/measurement-units';
import { distance, format } from '@/lib/measurement-units';

// ── MEAS-1: central style theme ───────────────────────────────────────────────
// All visual properties of the line live here so they can be tuned in one place
// without touching the renderer. The line is drawn as SVG (not WebGL), so the
// 1px gl.lineWidth browser cap does not apply — any thickness renders crisply.

export interface MeasurementTheme {
  lineWidth:        number;   // px
  lineColor:        string;
  lineOpacity:      number;
  endpointRadius:   number;   // px
  endpointColor:    string;
  // Highlighted (hover / selected) variant
  highlightColor:   string;
  highlightWidth:   number;
  // Label
  labelBg:          string;
  labelColor:       string;
  labelFontSize:    number;
}

export const DEFAULT_THEME: MeasurementTheme = {
  lineWidth:      4,
  lineColor:      '#F59E0B',
  lineOpacity:    0.95,
  endpointRadius: 6,
  endpointColor:  '#FFFFFF',
  highlightColor: '#22D3EE',
  highlightWidth: 6,
  labelBg:        '#0F172A',
  labelColor:     '#FFFFFF',
  labelFontSize:  13,
};

// ── Data model ─────────────────────────────────────────────────────────────────

export interface Measurement {
  id: string;
  a:  Vec3;          // first 3D point (meters)
  b:  Vec3;          // second 3D point (meters)
  normalA?: Vec3;    // surface normal at A (stored for downstream use)
}

/** A 3D point projected to 2D screen space, or null if behind the camera. */
export type ScreenPoint = { x: number; y: number } | null;

export interface ProjectedMeasurement {
  id: string;
  a:  ScreenPoint;
  b:  ScreenPoint;
  meters: number;
}

interface Props {
  width:  number;
  height: number;
  unit:   MeasurementUnit;
  theme?: MeasurementTheme;
  /** Completed measurements, already projected to screen space. */
  projected: ProjectedMeasurement[];
  /** In-progress line: first point + live cursor point (both projected). */
  preview?: { a: ScreenPoint; b: ScreenPoint; meters: number } | null;
  selectedId?: string | null;
  hoveredId?:  string | null;
  onSelect?: (id: string) => void;
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function MeasurementOverlay({
  width, height, unit, theme = DEFAULT_THEME,
  projected, preview, selectedId, hoveredId, onSelect,
}: Props) {
  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', overflow: 'visible' }}
    >
      {/* ── Completed measurements ─────────────────────────────────────── */}
      {projected.map((m) => {
        if (!m.a || !m.b) return null;
        const active = m.id === selectedId || m.id === hoveredId;
        const stroke = active ? theme.highlightColor : theme.lineColor;
        const sw     = active ? theme.highlightWidth : theme.lineWidth;
        const mid    = midpoint(m.a, m.b);
        const label  = format(m.meters, unit);

        return (
          <g key={m.id}>
            {/* Invisible fat hit-line for easy selection */}
            <line
              x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y}
              stroke="transparent" strokeWidth={Math.max(sw + 14, 18)}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={() => onSelect?.(m.id)}
            />
            <line
              x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y}
              stroke={stroke} strokeWidth={sw} strokeOpacity={theme.lineOpacity}
              strokeLinecap="round"
            />
            <circle cx={m.a.x} cy={m.a.y} r={theme.endpointRadius} fill={theme.endpointColor} stroke={stroke} strokeWidth={2} />
            <circle cx={m.b.x} cy={m.b.y} r={theme.endpointRadius} fill={theme.endpointColor} stroke={stroke} strokeWidth={2} />
            <DistanceLabel x={mid.x} y={mid.y} text={label} theme={theme} highlighted={active} />
          </g>
        );
      })}

      {/* ── In-progress preview line ──────────────────────────────────── */}
      {preview && preview.a && preview.b && (
        <g>
          <line
            x1={preview.a.x} y1={preview.a.y} x2={preview.b.x} y2={preview.b.y}
            stroke={theme.lineColor} strokeWidth={theme.lineWidth} strokeOpacity={0.7}
            strokeLinecap="round" strokeDasharray="8 6"
          />
          <circle cx={preview.a.x} cy={preview.a.y} r={theme.endpointRadius} fill={theme.endpointColor} stroke={theme.lineColor} strokeWidth={2} />
          <circle cx={preview.b.x} cy={preview.b.y} r={theme.endpointRadius - 1} fill={theme.lineColor} stroke="#FFFFFF" strokeWidth={2} />
          <DistanceLabel
            x={(preview.a.x + preview.b.x) / 2}
            y={(preview.a.y + preview.b.y) / 2}
            text={format(preview.meters, unit)}
            theme={theme}
            highlighted
          />
        </g>
      )}
    </svg>
  );
}

function DistanceLabel({
  x, y, text, theme, highlighted,
}: { x: number; y: number; text: string; theme: MeasurementTheme; highlighted?: boolean }) {
  // Estimate width from char count for the rounded-rect background
  const padX = 8;
  const w = text.length * (theme.labelFontSize * 0.62) + padX * 2;
  const h = theme.labelFontSize + 10;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h - 8})`}>
      <rect
        width={w} height={h} rx={6}
        fill={highlighted ? theme.highlightColor : theme.labelBg}
        opacity={0.95}
      />
      <text
        x={w / 2} y={h / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={theme.labelFontSize}
        fontWeight={700}
        fill={highlighted ? '#0F172A' : theme.labelColor}
        fontFamily="ui-monospace, monospace"
      >
        {text}
      </text>
    </g>
  );
}

// Re-export so callers get the geometry helper from one place
export { distance };
