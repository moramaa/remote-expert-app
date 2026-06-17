'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Ruler, Trash2, X, MousePointerClick, Eye, Sparkles,
  MoveHorizontal, MoveVertical, Slash, RotateCcw, Spline, Circle as CircleIcon,
  Palette, Square,
} from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import MeasurementOverlay, {
  DEFAULT_THEME, COLOR_PRESETS,
  type MeasurementTheme,
  type ProjectedShape,
  type DraftShape,
  type ProjectedSuggestion,
  type ScreenPoint,
} from '@/components/measure/MeasurementOverlay';
import {
  UNIT_OPTIONS, getPreferredUnit, storePreferredUnit,
  format, type MeasurementUnit, type Vec3,
} from '@/lib/measurement-units';
import {
  type Measurement, type MeasurementKind,
  pathLength, polygonArea, circleMetrics, ringPoints3D, centroid,
} from '@/lib/measurement-shapes';
import {
  classifySurface, buildSuggestions,
  type GazeSuggestion, type SurfaceClass,
} from '@/lib/gaze-suggestions';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const THEME_KEY = 'fieldsync:measureTheme';

function loadTheme(): MeasurementTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MeasurementTheme>;
      return { ...DEFAULT_THEME, ...p };
    }
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

/** Short label drawn on the model for a finished shape. */
function primaryLabel(m: Measurement, unit: MeasurementUnit): string {
  if (m.kind === 'circle') {
    const { diameter } = circleMetrics(m.points[0], m.points[1]);
    return `⌀ ${format(diameter, unit)}`;
  }
  return format(pathLength(m.points, m.closed), unit);
}

export default function MeasurePage() {
  const router = useRouter();

  const [viewerReady, setViewerReady] = useState(false);
  const [unit, setUnit] = useState<MeasurementUnit>('m');
  const [theme, setTheme] = useState<MeasurementTheme>(DEFAULT_THEME);
  const [showStyle, setShowStyle] = useState(false);

  const [tool, setTool] = useState<MeasurementKind>('path');
  const [closedShape, setClosedShape] = useState(false);

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [draftPoints, setDraftPoints]   = useState<Vec3[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState(0);

  // ── MEAS-4: gaze auto-suggestions ────────────────────────────────────────
  const [autoSuggest, setAutoSuggest] = useState(false);
  const [anchor, setAnchor]           = useState<Vec3 | null>(null);
  const [gazeClass, setGazeClass]     = useState<SurfaceClass | null>(null);
  const [suggestions, setSuggestions] = useState<GazeSuggestion[]>([]);
  const [focusedKind, setFocusedKind] = useState<string | null>(null);

  const wrapperRef          = useRef<HTMLDivElement>(null);
  const mpSdkRef            = useRef<MatterportSdk | null>(null);
  const poseRef             = useRef<MatterportPose | null>(null);
  const sizeRef             = useRef({ w: 0, h: 0 });
  const lastIntersectionRef = useRef<MatterportIntersection | null>(null);
  const lastHashRef         = useRef('');
  const downRef             = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTapRef          = useRef<{ t: number; x: number; y: number } | null>(null);
  const draftRef            = useRef<Vec3[]>([]);
  const toolRef             = useRef<MeasurementKind>('path');
  const closedRef           = useRef(false);
  const circleNormalRef     = useRef<Vec3>({ x: 0, y: 1, z: 0 });
  // gaze refs
  const autoSuggestRef = useRef(false);
  const anchorRef      = useRef<Vec3 | null>(null);
  const prevPoseRef    = useRef<MatterportPose | null>(null);
  const dwellRef       = useRef<{ pos: Vec3; t: number } | null>(null);
  const movingUntilRef = useRef(0);

  useEffect(() => { draftRef.current = draftPoints; }, [draftPoints]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { closedRef.current = closedShape; }, [closedShape]);
  useEffect(() => { autoSuggestRef.current = autoSuggest; }, [autoSuggest]);
  useEffect(() => { anchorRef.current = anchor; }, [anchor]);

  useEffect(() => { setUnit(getPreferredUnit()); setTheme(loadTheme()); }, []);

  const changeUnit = useCallback((u: MeasurementUnit) => { setUnit(u); storePreferredUnit(u); }, []);

  const updateTheme = useCallback((patch: Partial<MeasurementTheme>) => {
    setTheme((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(THEME_KEY, JSON.stringify({ lineWidth: next.lineWidth, lineColor: next.lineColor })); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── SDK ready ────────────────────────────────────────────────────────────
  const handleSdkReady = useCallback((sdk: MatterportSdk) => {
    mpSdkRef.current = sdk;
    setViewerReady(true);
    try { sdk.Camera.pose.subscribe((pose) => { poseRef.current = pose; }); } catch { /* noop */ }
  }, []);

  const handleIntersectionChange = useCallback((i: MatterportIntersection | null) => {
    lastIntersectionRef.current = i;
  }, []);

  // ── Track viewer size ────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => { const r = { w: el.clientWidth, h: el.clientHeight }; sizeRef.current = r; setSize(r); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── rAF re-project on camera move ────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = poseRef.current;
      const hash = p
        ? `${p.position.x.toFixed(3)},${p.position.y.toFixed(3)},${p.position.z.toFixed(3)},${p.rotation.x.toFixed(2)},${p.rotation.y.toFixed(2)},${p.sweep}`
        : '';
      // Always tick while drafting so the cursor tail tracks the mouse
      if (hash !== lastHashRef.current || draftRef.current.length > 0) {
        lastHashRef.current = hash;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const project = useCallback((pos: Vec3): ScreenPoint => {
    const pose = poseRef.current;
    const sz = sizeRef.current;
    if (!pose || !mpSdkRef.current || sz.w === 0) return null;
    try {
      const s = mpSdkRef.current.Conversion.worldToScreen(pos, pose, { w: sz.w, h: sz.h });
      if (s.z < 0) return null;
      return { x: s.x, y: s.y };
    } catch { return null; }
  }, []);

  // ── Capture ──────────────────────────────────────────────────────────────
  const hoverPoint = (): { pos: Vec3; normal: Vec3 } | null => {
    const i = lastIntersectionRef.current;
    if (!i || i.object === 'intersectedobject.none') return null;
    return { pos: { x: i.position.x, y: i.position.y, z: i.position.z }, normal: i.normal ?? { x: 0, y: 1, z: 0 } };
  };

  const finalizePath = useCallback(() => {
    const pts = draftRef.current;
    if (pts.length >= 2) {
      const m: Measurement = { id: uid(), kind: 'path', points: pts, closed: closedRef.current && pts.length >= 3 };
      setMeasurements((prev) => [...prev, m]);
      setSelectedId(m.id);
    }
    setDraftPoints([]);
  }, []);

  const placeVertex = useCallback(() => {
    const h = hoverPoint();
    if (!h) return;
    if (toolRef.current === 'circle') {
      if (draftRef.current.length === 0) {
        circleNormalRef.current = h.normal;
        setDraftPoints([h.pos]);
      } else {
        const center = draftRef.current[0];
        const m: Measurement = { id: uid(), kind: 'circle', points: [center, h.pos], closed: true, normal: circleNormalRef.current };
        setMeasurements((prev) => [...prev, m]);
        setSelectedId(m.id);
        setDraftPoints([]);
      }
    } else {
      setDraftPoints((prev) => [...prev, h.pos]);
    }
  }, []);

  // Tap vs double-tap (double = finish path)
  const handleTap = useCallback((x: number, y: number) => {
    if (autoSuggestRef.current && toolRef.current === 'path') return; // gaze drives
    const now = Date.now();
    const lt = lastTapRef.current;
    const isDouble = !!lt && now - lt.t < 300 && Math.hypot(x - lt.x, y - lt.y) < 14;
    if (toolRef.current === 'path' && isDouble) {
      lastTapRef.current = null;
      finalizePath();
      return;
    }
    placeVertex();
    lastTapRef.current = { t: now, x, y };
  }, [finalizePath, placeVertex]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = downRef.current; downRef.current = null;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && Date.now() - d.t < 500) {
      handleTap(e.clientX, e.clientY);
    }
  }, [handleTap]);

  // Keyboard: Space add · Enter finish · Escape cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (!(autoSuggestRef.current && toolRef.current === 'path')) placeVertex(); }
      else if (e.code === 'Enter') { e.preventDefault(); if (toolRef.current === 'path') finalizePath(); }
      else if (e.code === 'Escape') { setDraftPoints([]); setSelectedId(null); }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [placeVertex, finalizePath]);

  const removeMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);
  const clearAll = useCallback(() => { setMeasurements([]); setDraftPoints([]); setSelectedId(null); }, []);

  const switchTool = useCallback((t: MeasurementKind) => {
    setTool(t);
    setDraftPoints([]);
    if (t === 'circle') setAutoSuggest(false);
  }, []);

  // ── MEAS-4 gaze engine ───────────────────────────────────────────────────
  const DWELL_MS = 350, MOVE_COOLDOWN_MS = 250, STABLE_DIST = 0.12;
  const resetAnchor = useCallback(() => { setAnchor(null); setSuggestions([]); setGazeClass(null); dwellRef.current = null; }, []);

  useEffect(() => {
    if (!autoSuggest) { resetAnchor(); return; }
    const id = setInterval(() => {
      const pose = poseRef.current; const now = Date.now();
      if (pose && prevPoseRef.current) {
        const p0 = prevPoseRef.current;
        const dPos = Math.hypot(pose.position.x - p0.position.x, pose.position.y - p0.position.y, pose.position.z - p0.position.z);
        const dRot = Math.abs(pose.rotation.x - p0.rotation.x) + Math.abs(pose.rotation.y - p0.rotation.y);
        if (dPos > 0.03 || dRot > 1.2) movingUntilRef.current = now + MOVE_COOLDOWN_MS;
      }
      prevPoseRef.current = pose;
      if (now < movingUntilRef.current) { setSuggestions([]); return; }
      const h = hoverPoint();
      if (!h) { dwellRef.current = null; return; }
      const d = dwellRef.current;
      const dist = d ? Math.hypot(d.pos.x - h.pos.x, d.pos.y - h.pos.y, d.pos.z - h.pos.z) : Infinity;
      if (!d || dist > STABLE_DIST) { dwellRef.current = { pos: h.pos, t: now }; return; }
      if (now - d.t < DWELL_MS) return;
      const cls = classifySurface(h.normal);
      setGazeClass(cls);
      if (!anchorRef.current) { anchorRef.current = h.pos; setAnchor(h.pos); setSuggestions([]); return; }
      setSuggestions(buildSuggestions(anchorRef.current, h.pos, cls));
    }, 120);
    return () => clearInterval(id);
  }, [autoSuggest, resetAnchor]);

  const confirmSuggestion = useCallback((s: GazeSuggestion) => {
    const m: Measurement = { id: uid(), kind: 'path', points: [s.a, s.b], closed: false };
    setMeasurements((prev) => [...prev, m]);
    setSelectedId(m.id);
  }, []);

  const toggleAutoSuggest = useCallback(() => {
    setAutoSuggest((on) => { const next = !on; if (next) setDraftPoints([]); return next; });
  }, []);

  // ── Projection (per frame) ───────────────────────────────────────────────
  const shapes: ProjectedShape[] = useMemo(
    () => measurements.map((m) => {
      if (m.kind === 'circle') {
        const { circumference } = circleMetrics(m.points[0], m.points[1]);
        const radius = Math.hypot(m.points[1].x - m.points[0].x, m.points[1].y - m.points[0].y, m.points[1].z - m.points[0].z);
        const ring = ringPoints3D(m.points[0], m.normal ?? { x: 0, y: 1, z: 0 }, radius);
        void circumference;
        return {
          id: m.id, kind: 'circle' as const,
          line: ring.map(project), markers: m.points.map(project),
          closed: true, primary: primaryLabel(m, unit), labelAt: project(m.points[0]),
        };
      }
      return {
        id: m.id, kind: 'path' as const,
        line: m.points.map(project), markers: m.points.map(project),
        closed: m.closed, primary: primaryLabel(m, unit), labelAt: project(centroid(m.points)),
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measurements, unit, project, size, frame],
  );

  const draft: DraftShape | null = useMemo(() => {
    if (draftPoints.length === 0) return null;
    const h = hoverPoint();
    const cursor = h ? project(h.pos) : null;
    if (tool === 'circle') {
      const center = draftPoints[0];
      const radius = h ? Math.hypot(h.pos.x - center.x, h.pos.y - center.y, h.pos.z - center.z) : 0;
      const ring = h ? ringPoints3D(center, circleNormalRef.current, radius).map(project) : [];
      return { kind: 'circle', line: [], markers: [project(center)], cursor: cursor ?? { x: 0, y: 0 }, ring, closed: true, primary: h ? `⌀ ${format(radius * 2, unit)}` : '', labelAt: project(center) };
    }
    const live = h ? [...draftPoints, h.pos] : draftPoints;
    return {
      kind: 'path',
      line: draftPoints.map(project),
      markers: draftPoints.map(project),
      cursor: cursor ?? { x: 0, y: 0 },
      closed: closedShape,
      primary: format(pathLength(live, closedShape && live.length >= 3), unit),
      labelAt: cursor,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPoints, tool, closedShape, unit, project, size, frame]);

  const projectedSuggestions: ProjectedSuggestion[] = useMemo(
    () => suggestions.map((s) => ({ id: s.id, a: project(s.a), b: project(s.b), meters: s.meters, focused: focusedKind === s.kind })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, focusedKind, project, size, frame],
  );
  const projectedAnchor: ScreenPoint = useMemo(
    () => (anchor ? project(anchor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, project, size, frame],
  );

  const hint = autoSuggest && tool === 'path'
    ? (anchor ? 'Look at a target — pick a suggestion' : 'Look at a surface to set the start point')
    : tool === 'circle'
      ? (draftPoints.length === 0 ? 'Click the circle center' : 'Click to set the radius')
      : draftPoints.length === 0
        ? 'Click to start · single-click adds points · double-click to finish'
        : 'Single-click to add · double-click (or Enter) to finish';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0F172A' }}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => router.push('/dashboard/expert')} style={btn()}>
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={20} color="#F59E0B" />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Measurement</span>
          </div>

          {/* Tool selector */}
          <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden' }}>
            <SegBtn active={tool === 'path'} onClick={() => switchTool('path')}><Spline size={14} /> Line / Shape</SegBtn>
            <SegBtn active={tool === 'circle'} onClick={() => switchTool('circle')}><CircleIcon size={14} /> Circle</SegBtn>
          </div>

          {/* Close-shape toggle (path only) */}
          {tool === 'path' && (
            <button type="button" onClick={() => setClosedShape((v) => !v)} title="Connect last point back to the first (triangle, square, …)" style={btn(closedShape)}>
              <Square size={14} /> {closedShape ? 'Closed shape' : 'Open path'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Style */}
          <button type="button" onClick={() => setShowStyle((v) => !v)} title="Line thickness & colour" style={btn(showStyle)}>
            <Palette size={14} /> Style
          </button>

          {/* Auto-suggest (path only) */}
          {tool === 'path' && (
            <button type="button" onClick={toggleAutoSuggest} title="Suggest measurements based on where you look" style={btn(autoSuggest, '#22D3EE', '#ECFEFF', '#0E7490')}>
              {autoSuggest ? <Sparkles size={14} /> : <Eye size={14} />} Auto-suggest {autoSuggest ? 'On' : 'Off'}
            </button>
          )}

          {/* Units */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
            Units
            <select value={unit} onChange={(e) => changeUnit(e.target.value as MeasurementUnit)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 600, color: '#0F172A', background: '#FFFFFF', cursor: 'pointer' }}>
              <optgroup label="Metric">{UNIT_OPTIONS.filter((o) => o.system === 'metric').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
              <optgroup label="Imperial">{UNIT_OPTIONS.filter((o) => o.system === 'imperial').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            </select>
          </label>

          {measurements.length > 0 && (
            <button type="button" onClick={clearAll} style={btn(false, '#FECACA', '#FEF2F2', '#DC2626')}>
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>

        {/* Style popover (MEAS-1) */}
        {showStyle && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: '16px', zIndex: 30, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '14px', width: '240px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Line style</div>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Thickness</span><strong>{theme.lineWidth}px</strong>
            </div>
            <input type="range" min={1} max={12} step={1} value={theme.lineWidth} onChange={(e) => updateTheme({ lineWidth: Number(e.target.value), highlightWidth: Number(e.target.value) + 2 })} style={{ width: '100%', accentColor: theme.lineColor }} />
            <div style={{ fontSize: '12px', color: '#475569', margin: '12px 0 6px' }}>Colour</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {COLOR_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => updateTheme({ lineColor: c })} title={c}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: theme.lineColor.toLowerCase() === c.toLowerCase() ? '3px solid #0F172A' : '1px solid #CBD5E1' }} />
              ))}
              <input type="color" value={theme.lineColor.startsWith('#') ? theme.lineColor : '#F59E0B'} onChange={(e) => updateTheme({ lineColor: e.target.value })} title="Custom colour" style={{ width: '28px', height: '28px', padding: 0, border: '1px solid #CBD5E1', borderRadius: '6px', background: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Viewer + overlay ─────────────────────────────────────────── */}
      <div ref={wrapperRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ position: 'relative', flex: 1, background: '#000', cursor: 'crosshair' }}>
        <MatterportViewer isReadOnly={false} onIntersectionChange={handleIntersectionChange} onSdkReady={handleSdkReady} />

        {viewerReady && size.w > 0 && (
          <MeasurementOverlay
            width={size.w} height={size.h} unit={unit} theme={theme}
            shapes={shapes} draft={draft}
            suggestions={autoSuggest && tool === 'path' ? projectedSuggestions : undefined}
            anchor={autoSuggest && tool === 'path' ? projectedAnchor : null}
            selectedId={selectedId} hoveredId={hoveredId} onSelect={setSelectedId}
          />
        )}

        {viewerReady && (
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,42,0.92)', color: '#FFFFFF', fontSize: '12px', fontWeight: 600, padding: '8px 16px', borderRadius: '999px', zIndex: 12, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {autoSuggest && tool === 'path' ? <Sparkles size={14} color="#22D3EE" /> : <MousePointerClick size={14} color="#F59E0B" />}
            {hint}
          </div>
        )}

        {/* MEAS-4 suggestion card */}
        {autoSuggest && tool === 'path' && viewerReady && (
          <div style={{ position: 'absolute', bottom: '72px', left: '16px', width: '250px', background: 'rgba(255,255,255,0.97)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 12, padding: '12px', border: '1px solid #A5F3FC' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.06em' }}><Sparkles size={13} /> Suggestions</div>
              {anchor && <button type="button" onClick={resetAnchor} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}><RotateCcw size={12} /> Reset</button>}
            </div>
            {!anchor && <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>Look around the model — the start point locks onto the first surface you focus on.</p>}
            {anchor && suggestions.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>Start point locked{gazeClass ? ` on the ${gazeClass}` : ''}. Now look at the target area.</p>}
            {suggestions.map((s) => {
              const Icon = s.kind === 'horizontal' ? MoveHorizontal : s.kind === 'vertical' ? MoveVertical : Slash;
              return (
                <button key={s.id} type="button" onMouseEnter={() => setFocusedKind(s.kind)} onMouseLeave={() => setFocusedKind(null)} onClick={() => confirmSuggestion(s)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', marginBottom: '6px', padding: '9px 10px', background: '#ECFEFF', border: '1px solid #67E8F9', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Icon size={15} color="#0E7490" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0E7490', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{format(s.meters, unit)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Measurements list */}
        {measurements.length > 0 && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '260px', maxHeight: 'calc(100% - 32px)', overflowY: 'auto', background: 'rgba(255,255,255,0.97)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 12, padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{measurements.length} measurement{measurements.length > 1 ? 's' : ''}</div>
            {measurements.map((m, idx) => {
              const active = m.id === selectedId;
              return (
                <div key={m.id} onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => setSelectedId(m.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: active ? '#ECFEFF' : 'transparent', border: `1px solid ${active ? '#22D3EE' : 'transparent'}`, marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
                    <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: m.kind === 'circle' ? '#3B82F6' : m.closed ? '#A855F7' : '#F59E0B', color: '#FFFFFF', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{shapeName(m)}</div>
                      {detailLines(m, unit).map((ln, i) => (
                        <div key={i} style={{ fontSize: i === 0 ? '14px' : '11px', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#0F172A' : '#64748B', fontFamily: 'ui-monospace, monospace' }}>{ln}</div>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeMeasurement(m.id); }} title="Delete" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── small UI helpers ────────────────────────────────────────────────────────

function btn(active = false, accent = '#1D4ED8', activeBg = '#EFF6FF', activeColor = '#1D4ED8'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px',
    border: `1px solid ${active ? accent : '#CBD5E1'}`, background: active ? activeBg : '#FFFFFF',
    color: active ? activeColor : '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  };
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: 'none', background: active ? '#1D4ED8' : '#FFFFFF', color: active ? '#FFFFFF' : '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function shapeName(m: Measurement): string {
  if (m.kind === 'circle') return 'Circle';
  if (m.closed) {
    const n = m.points.length;
    return n === 3 ? 'Triangle' : n === 4 ? 'Quad' : `Polygon · ${n} sides`;
  }
  return m.points.length === 2 ? 'Line' : `Path · ${m.points.length} pts`;
}

function detailLines(m: Measurement, unit: MeasurementUnit): string[] {
  if (m.kind === 'circle') {
    const { radius, diameter, circumference, area } = circleMetrics(m.points[0], m.points[1]);
    return [
      `⌀ ${format(diameter, unit)}`,
      `r ${format(radius, unit)} · C ${format(circumference, unit)}`,
      `A ${area.toFixed(2)} m²`,
    ];
  }
  const lines = [format(pathLength(m.points, m.closed), unit)];
  if (m.closed && m.points.length >= 3) lines.push(`Area ${polygonArea(m.points).toFixed(2)} m²`);
  return lines;
}
