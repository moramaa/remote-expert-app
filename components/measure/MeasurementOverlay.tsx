'use client';

import { format, type MeasurementUnit } from '@/lib/measurement-units';
import type { MeasurementKind } from '@/lib/measurement-shapes';

// ── MEAS-1: central style theme ───────────────────────────────────────────────
// The line is drawn as SVG (not WebGL), so the 1px gl.lineWidth browser cap does
// not apply — any thickness/colour renders crisply and is user-configurable.

export interface MeasurementTheme {
  lineWidth:      number;   // px
  lineColor:      string;
  lineOpacity:    number;
  endpointRadius: number;   // px
  endpointColor:  string;
  highlightColor: string;
  highlightWidth: number;
  labelBg:        string;
  labelColor:     string;
  labelFontSize:  number;
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

/** Preset colours for the line-colour picker. */
export const COLOR_PRESETS = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#FFFFFF'];

// ── Data model ─────────────────────────────────────────────────────────────────

export type ScreenPoint = { x: number; y: number } | null;

export interface ProjectedShape {
  id:           string;
  kind:         MeasurementKind;
  /** Connected line points (path vertices, or circle ring). */
  line:         ScreenPoint[];
  /** Vertex dots to draw (path vertices, or circle [center, radiusPoint]). */
  markers:      ScreenPoint[];
  closed:       boolean;
  primary:      string;        // formatted label text
  labelAt:      ScreenPoint;
}

export interface DraftShape {
  kind:    MeasurementKind;
  line:    ScreenPoint[];      // committed connected points
  markers: ScreenPoint[];
  cursor:  ScreenPoint;        // live cursor point
  ring?:   ScreenPoint[];      // circle preview ring
  closed:  boolean;
  primary: string;
  labelAt: ScreenPoint;
}

export interface ProjectedSuggestion {
  id:      string;
  a:       ScreenPoint;
  b:       ScreenPoint;
  meters:  number;
  focused?: boolean;
}

interface Props {
  width:  number;
  height: number;
  unit:   MeasurementUnit;
  theme?: MeasurementTheme;
  shapes: ProjectedShape[];
  draft?: DraftShape | null;
  suggestions?: ProjectedSuggestion[];
  anchor?: ScreenPoint;
  selectedId?: string | null;
  hoveredId?:  string | null;
  onSelect?: (id: string) => void;
}

const SUGGESTION_COLOR = '#22D3EE';

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Consecutive non-null point pairs, plus the closing pair when `closed`. */
function segments(points: ScreenPoint[], closed: boolean): Array<[{ x: number; y: number }, { x: number; y: number }]> {
  const out: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i];
    if (p && q) out.push([p, q]);
  }
  if (closed && points.length >= 3) {
    const first = points[0], last = points[points.length - 1];
    if (first && last) out.push([last, first]);
  }
  return out;
}

export default function MeasurementOverlay({
  width, height, unit, theme = DEFAULT_THEME,
  shapes, draft, suggestions, anchor, selectedId, hoveredId, onSelect,
}: Props) {
  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', overflow: 'visible' }}
    >
      {/* ── Completed shapes ───────────────────────────────────────────── */}
      {shapes.map((m) => {
        const active = m.id === selectedId || m.id === hoveredId;
        const stroke = active ? theme.highlightColor : theme.lineColor;
        const sw     = active ? theme.highlightWidth : theme.lineWidth;
        const segs   = segments(m.line, m.kind === 'circle' ? false : m.closed);
        return (
          <g key={m.id}>
            {segs.map(([p, q], idx) => (
              <g key={idx}>
                <line
                  x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke="transparent" strokeWidth={Math.max(sw + 14, 18)}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={() => onSelect?.(m.id)}
                />
                <line
                  x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke={stroke} strokeWidth={sw} strokeOpacity={theme.lineOpacity}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </g>
            ))}
            {m.markers.map((pt, idx) => pt && (
              <circle key={idx} cx={pt.x} cy={pt.y} r={theme.endpointRadius} fill={theme.endpointColor} stroke={stroke} strokeWidth={2} />
            ))}
            {m.labelAt && <DistanceLabel x={m.labelAt.x} y={m.labelAt.y} text={m.primary} theme={theme} highlighted={active} />}
          </g>
        );
      })}

      {/* ── In-progress draft ──────────────────────────────────────────── */}
      {draft && (() => {
        const segs = segments(draft.line, false);
        const last = draft.line.length ? draft.line[draft.line.length - 1] : null;
        return (
          <g>
            {/* circle preview ring */}
            {draft.ring && segments(draft.ring, true).map(([p, q], idx) => (
              <line key={`r${idx}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke={theme.lineColor} strokeWidth={theme.lineWidth} strokeOpacity={0.85} strokeLinecap="round" />
            ))}
            {/* committed path segments */}
            {segs.map(([p, q], idx) => (
              <line key={`s${idx}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke={theme.lineColor} strokeWidth={theme.lineWidth} strokeOpacity={theme.lineOpacity}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {/* dashed tail to cursor */}
            {last && draft.cursor && (
              <line x1={last.x} y1={last.y} x2={draft.cursor.x} y2={draft.cursor.y}
                stroke={theme.lineColor} strokeWidth={theme.lineWidth} strokeOpacity={0.6}
                strokeLinecap="round" strokeDasharray="8 6" />
            )}
            {/* closing hint for polygons */}
            {draft.closed && draft.line.length >= 2 && draft.line[0] && draft.cursor && (
              <line x1={draft.cursor.x} y1={draft.cursor.y} x2={draft.line[0]!.x} y2={draft.line[0]!.y}
                stroke={theme.lineColor} strokeWidth={theme.lineWidth} strokeOpacity={0.35}
                strokeLinecap="round" strokeDasharray="2 8" />
            )}
            {draft.markers.map((pt, idx) => pt && (
              <circle key={`m${idx}`} cx={pt.x} cy={pt.y} r={theme.endpointRadius} fill={theme.endpointColor} stroke={theme.lineColor} strokeWidth={2} />
            ))}
            {draft.cursor && (
              <circle cx={draft.cursor.x} cy={draft.cursor.y} r={theme.endpointRadius - 1} fill={theme.lineColor} stroke="#FFFFFF" strokeWidth={2} />
            )}
            {draft.labelAt && <DistanceLabel x={draft.labelAt.x} y={draft.labelAt.y} text={draft.primary} theme={theme} highlighted />}
          </g>
        );
      })()}

      {/* ── MEAS-4: gaze suggestions ───────────────────────────────────── */}
      {suggestions?.map((s) => {
        if (!s.a || !s.b) return null;
        const mid = midpoint(s.a, s.b);
        return (
          <g key={s.id} style={{ opacity: s.focused ? 1 : 0.66, transition: 'opacity 0.2s' }}>
            <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
              stroke={SUGGESTION_COLOR} strokeWidth={s.focused ? 4 : 3}
              strokeOpacity={0.85} strokeLinecap="round" strokeDasharray="6 7" />
            <circle cx={s.b.x} cy={s.b.y} r={5} fill={SUGGESTION_COLOR} stroke="#FFFFFF" strokeWidth={1.5} />
            <DistanceLabel x={mid.x} y={mid.y} text={format(s.meters, unit)} theme={{ ...theme, labelBg: SUGGESTION_COLOR, labelColor: '#0F172A' }} />
          </g>
        );
      })}

      {/* MEAS-4: pulsing gaze anchor */}
      {anchor && (
        <g>
          <circle cx={anchor.x} cy={anchor.y} r={9} fill="none" stroke={SUGGESTION_COLOR} strokeWidth={2}>
            <animate attributeName="r" values="7;13;7" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={anchor.x} cy={anchor.y} r={4} fill={SUGGESTION_COLOR} />
        </g>
      )}
    </svg>
  );
}

function DistanceLabel({
  x, y, text, theme, highlighted,
}: { x: number; y: number; text: string; theme: MeasurementTheme; highlighted?: boolean }) {
  const padX = 8;
  const w = text.length * (theme.labelFontSize * 0.62) + padX * 2;
  const h = theme.labelFontSize + 10;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h - 8})`}>
      <rect width={w} height={h} rx={6} fill={highlighted ? theme.highlightColor : theme.labelBg} opacity={0.95} />
      <text
        x={w / 2} y={h / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={theme.labelFontSize} fontWeight={700}
        fill={highlighted ? '#0F172A' : theme.labelColor}
        fontFamily="ui-monospace, monospace"
      >
        {text}
      </text>
    </g>
  );
}
