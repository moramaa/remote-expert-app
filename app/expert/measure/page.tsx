'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ruler, Trash2, X, MousePointerClick, Eye, Sparkles, MoveHorizontal, MoveVertical, Slash, RotateCcw } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import MeasurementOverlay, {
  type Measurement,
  type ProjectedMeasurement,
  type ProjectedSuggestion,
  type ScreenPoint,
} from '@/components/measure/MeasurementOverlay';
import {
  UNIT_OPTIONS,
  getPreferredUnit,
  storePreferredUnit,
  distance,
  format,
  type MeasurementUnit,
  type Vec3,
} from '@/lib/measurement-units';
import {
  classifySurface,
  buildSuggestions,
  type GazeSuggestion,
  type SurfaceClass,
} from '@/lib/gaze-suggestions';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PendingPoint { pos: Vec3; normal: Vec3; }

export default function MeasurePage() {
  const router = useRouter();

  const [viewerReady, setViewerReady] = useState(false);
  const [unit, setUnit] = useState<MeasurementUnit>('m');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [firstPoint, setFirstPoint] = useState<PendingPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState(0);   // bumped on camera move to re-project

  // ── MEAS-4: gaze-based auto-suggestions ──────────────────────────────────
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
  const firstPointRef       = useRef<PendingPoint | null>(null);
  const lastHashRef         = useRef('');
  const downRef             = useRef<{ x: number; y: number; t: number } | null>(null);
  // Gaze engine refs
  const autoSuggestRef      = useRef(false);
  const anchorRef           = useRef<Vec3 | null>(null);
  const prevPoseRef         = useRef<MatterportPose | null>(null);
  const dwellRef            = useRef<{ pos: Vec3; t: number } | null>(null);
  const movingUntilRef      = useRef(0);

  useEffect(() => { firstPointRef.current = firstPoint; }, [firstPoint]);
  useEffect(() => { autoSuggestRef.current = autoSuggest; }, [autoSuggest]);
  useEffect(() => { anchorRef.current = anchor; }, [anchor]);

  // Restore saved unit preference
  useEffect(() => { setUnit(getPreferredUnit()); }, []);

  const changeUnit = useCallback((u: MeasurementUnit) => {
    setUnit(u);
    storePreferredUnit(u);
  }, []);

  // ── SDK ready: subscribe to camera pose for live re-projection ───────────
  const handleSdkReady = useCallback((sdk: MatterportSdk) => {
    mpSdkRef.current = sdk;
    setViewerReady(true);
    try {
      sdk.Camera.pose.subscribe((pose) => { poseRef.current = pose; });
    } catch { /* Camera API unavailable */ }
  }, []);

  const handleIntersectionChange = useCallback((i: MatterportIntersection | null) => {
    lastIntersectionRef.current = i;
  }, []);

  // ── Track viewer size for worldToScreen projection ───────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const r = { w: el.clientWidth, h: el.clientHeight };
      sizeRef.current = r;
      setSize(r);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── rAF loop: re-project only when the camera moved or a point is pending ─
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = poseRef.current;
      const hash = p
        ? `${p.position.x.toFixed(3)},${p.position.y.toFixed(3)},${p.position.z.toFixed(3)},${p.rotation.x.toFixed(2)},${p.rotation.y.toFixed(2)},${p.sweep}`
        : '';
      if (hash !== lastHashRef.current || firstPointRef.current) {
        lastHashRef.current = hash;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Project a 3D world point to 2D screen space ──────────────────────────
  const project = useCallback((pos: Vec3): ScreenPoint => {
    const pose = poseRef.current;
    const sz = sizeRef.current;
    if (!pose || !mpSdkRef.current || sz.w === 0) return null;
    try {
      const s = mpSdkRef.current.Conversion.worldToScreen(pos, pose, { w: sz.w, h: sz.h });
      if (s.z < 0) return null; // behind camera
      return { x: s.x, y: s.y };
    } catch {
      return null;
    }
  }, []);

  // ── Place a point (from current hover intersection) ──────────────────────
  const placePoint = useCallback(() => {
    if (autoSuggestRef.current) return;  // manual placement off in gaze mode
    const i = lastIntersectionRef.current;
    if (!i || i.object === 'intersectedobject.none') return;
    const pos    = { x: i.position.x, y: i.position.y, z: i.position.z };
    const normal = i.normal ?? { x: 0, y: 1, z: 0 };

    if (!firstPointRef.current) {
      setFirstPoint({ pos, normal });
    } else {
      const a = firstPointRef.current;
      const m: Measurement = { id: uid(), a: a.pos, b: pos, normalA: a.normal };
      setMeasurements((prev) => [...prev, m]);
      setFirstPoint(null);
      setSelectedId(m.id);
    }
  }, []);

  // ── Space to place (matches the marker-placement UX in the app) ──────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); placePoint(); }
      if (e.code === 'Escape') { setFirstPoint(null); setSelectedId(null); }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [placePoint]);

  // ── Click-to-place (tap detection: ignore camera-drag gestures) ──────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const dt = Date.now() - d.t;
    if (moved < 6 && dt < 500) placePoint();  // a tap, not a navigation drag
  }, [placePoint]);

  const removeMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const clearAll = useCallback(() => {
    setMeasurements([]);
    setFirstPoint(null);
    setSelectedId(null);
  }, []);

  // ── MEAS-4: gaze suggestion engine ───────────────────────────────────────
  // Polls the gazed surface (raycast hit) + camera pose. Suggestions only
  // surface when the gaze is stable (dwell) and the camera isn't moving fast.
  const DWELL_MS    = 350;   // how long gaze must settle before suggesting
  const MOVE_COOLDOWN_MS = 250;
  const STABLE_DIST = 0.12;  // metres of jitter tolerated while "stable"

  const resetAnchor = useCallback(() => {
    setAnchor(null);
    setSuggestions([]);
    setGazeClass(null);
    dwellRef.current = null;
  }, []);

  useEffect(() => {
    if (!autoSuggest) { resetAnchor(); return; }

    const id = setInterval(() => {
      const pose = poseRef.current;
      const now  = Date.now();

      // ── Motion suppression: skip while the camera is moving fast ────────
      if (pose && prevPoseRef.current) {
        const p0 = prevPoseRef.current;
        const dPos = Math.hypot(pose.position.x - p0.position.x, pose.position.y - p0.position.y, pose.position.z - p0.position.z);
        const dRot = Math.abs(pose.rotation.x - p0.rotation.x) + Math.abs(pose.rotation.y - p0.rotation.y);
        if (dPos > 0.03 || dRot > 1.2) movingUntilRef.current = now + MOVE_COOLDOWN_MS;
      }
      prevPoseRef.current = pose;
      if (now < movingUntilRef.current) { setSuggestions([]); return; }

      const i = lastIntersectionRef.current;
      if (!i || i.object === 'intersectedobject.none') { dwellRef.current = null; return; }
      const pos = { x: i.position.x, y: i.position.y, z: i.position.z };

      // ── Dwell: require the gaze to settle on roughly one spot ───────────
      const d = dwellRef.current;
      if (!d || distance(d.pos, pos) > STABLE_DIST) {
        dwellRef.current = { pos, t: now };
        return;
      }
      if (now - d.t < DWELL_MS) return;  // not settled long enough yet

      const cls = classifySurface(i.normal ?? { x: 0, y: 1, z: 0 });
      setGazeClass(cls);

      // First stable gaze auto-captures the anchor; subsequent gaze builds
      // suggestions relative to it.
      if (!anchorRef.current) {
        anchorRef.current = pos;
        setAnchor(pos);
        setSuggestions([]);
        return;
      }
      setSuggestions(buildSuggestions(anchorRef.current, pos, cls));
    }, 120);

    return () => clearInterval(id);
  }, [autoSuggest, resetAnchor]);

  // Confirm a suggestion → real measurement (MEAS-0). Anchor is kept so the
  // user can grab several measurements from the same start point.
  const confirmSuggestion = useCallback((s: GazeSuggestion) => {
    const m: Measurement = { id: uid(), a: s.a, b: s.b };
    setMeasurements((prev) => [...prev, m]);
    setSelectedId(m.id);
  }, []);

  const toggleAutoSuggest = useCallback(() => {
    setAutoSuggest((on) => {
      const next = !on;
      if (next) setFirstPoint(null);  // drop any half-finished manual point
      return next;
    });
  }, []);

  // ── Build projected geometry for the overlay (recomputed each frame) ─────
  // `frame` is bumped by the rAF loop whenever the camera moves, forcing the
  // projections to recompute and the SVG line to stay anchored to the points.
  const projected: ProjectedMeasurement[] = useMemo(
    () => measurements.map((m) => ({
      id: m.id,
      a: project(m.a),
      b: project(m.b),
      meters: distance(m.a, m.b),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measurements, project, size, frame],
  );

  const preview = useMemo(() => {
    if (!firstPoint || autoSuggest) return null;
    const hover = lastIntersectionRef.current?.position;
    if (!hover) return null;
    const b = { x: hover.x, y: hover.y, z: hover.z };
    return { a: project(firstPoint.pos), b: project(b), meters: distance(firstPoint.pos, b) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPoint, autoSuggest, project, size, frame]);

  const projectedSuggestions: ProjectedSuggestion[] = useMemo(
    () => suggestions.map((s) => ({
      id: s.id,
      a: project(s.a),
      b: project(s.b),
      meters: s.meters,
      focused: focusedKind === s.kind,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, focusedKind, project, size, frame],
  );

  const projectedAnchor: ScreenPoint = useMemo(
    () => (anchor ? project(anchor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, project, size, frame],
  );

  const hint = autoSuggest
    ? (anchor
        ? 'Look at a target area — pick a suggested measurement'
        : 'Look at a surface to set the start point automatically')
    : firstPoint
      ? 'Click the second point to complete the measurement'
      : 'Click a surface to drop the first point';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0F172A' }}>
      {/* ── Top toolbar ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', padding: '10px 16px', background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => router.push('/dashboard/expert')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '8px',
              border: '1px solid #E2E8F0', background: '#FFFFFF',
              color: '#64748B', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={20} color="#F59E0B" />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Measurement</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* MEAS-4: gaze auto-suggest toggle */}
          <button
            type="button"
            onClick={toggleAutoSuggest}
            title="Suggest measurements automatically based on where you look"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '8px',
              border: `1px solid ${autoSuggest ? '#22D3EE' : '#CBD5E1'}`,
              background: autoSuggest ? '#ECFEFF' : '#FFFFFF',
              color: autoSuggest ? '#0E7490' : '#64748B',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {autoSuggest ? <Sparkles size={14} /> : <Eye size={14} />}
            Auto-suggest {autoSuggest ? 'On' : 'Off'}
          </button>

          {/* Unit selector (MEAS-2) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
            Units
            <select
              value={unit}
              onChange={(e) => changeUnit(e.target.value as MeasurementUnit)}
              style={{
                padding: '6px 10px', borderRadius: '8px', border: '1px solid #CBD5E1',
                fontSize: '13px', fontWeight: 600, color: '#0F172A', background: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <optgroup label="Metric">
                {UNIT_OPTIONS.filter((o) => o.system === 'metric').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="Imperial">
                {UNIT_OPTIONS.filter((o) => o.system === 'imperial').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </label>

          {measurements.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '8px',
                border: '1px solid #FECACA', background: '#FEF2F2',
                color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Viewer + overlay ─────────────────────────────────────────── */}
      <div
        ref={wrapperRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{ position: 'relative', flex: 1, background: '#000', cursor: 'crosshair' }}
      >
        <MatterportViewer
          isReadOnly={false}
          onIntersectionChange={handleIntersectionChange}
          onSdkReady={handleSdkReady}
        />

        {/* Measurement SVG overlay */}
        {viewerReady && size.w > 0 && (
          <MeasurementOverlay
            width={size.w}
            height={size.h}
            unit={unit}
            projected={projected}
            preview={preview}
            suggestions={autoSuggest ? projectedSuggestions : undefined}
            anchor={autoSuggest ? projectedAnchor : null}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
          />
        )}

        {/* Hint pill */}
        {viewerReady && (
          <div
            style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(15,23,42,0.92)', color: '#FFFFFF',
              fontSize: '12px', fontWeight: 600, padding: '8px 16px', borderRadius: '999px',
              zIndex: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            {autoSuggest ? <Sparkles size={14} color="#22D3EE" /> : <MousePointerClick size={14} color="#F59E0B" />}
            {hint}
            {!autoSuggest && <> · or press <strong style={{ margin: '0 2px' }}>Space</strong></>}
          </div>
        )}

        {/* MEAS-4: gaze suggestion card */}
        {autoSuggest && viewerReady && (
          <div
            style={{
              position: 'absolute', bottom: '72px', left: '16px', width: '250px',
              background: 'rgba(255,255,255,0.97)', borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 12, padding: '12px',
              border: '1px solid #A5F3FC',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Sparkles size={13} /> Suggestions
              </div>
              {anchor && (
                <button
                  type="button"
                  onClick={resetAnchor}
                  title="Reset start point"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            {!anchor && (
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                Look around the model — the start point locks onto the first surface you focus on.
              </p>
            )}
            {anchor && suggestions.length === 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                Start point locked{gazeClass ? ` on the ${gazeClass}` : ''}. Now look at the target area.
              </p>
            )}

            {suggestions.map((s) => {
              const Icon = s.kind === 'horizontal' ? MoveHorizontal : s.kind === 'vertical' ? MoveVertical : Slash;
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseEnter={() => setFocusedKind(s.kind)}
                  onMouseLeave={() => setFocusedKind(null)}
                  onClick={() => confirmSuggestion(s)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    width: '100%', marginBottom: '6px', padding: '9px 10px',
                    background: '#ECFEFF', border: '1px solid #67E8F9', borderRadius: '8px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Icon size={15} color="#0E7490" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0E7490', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                    {format(s.meters, unit)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Measurements list panel */}
        {measurements.length > 0 && (
          <div
            style={{
              position: 'absolute', top: '16px', right: '16px', width: '240px',
              maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
              background: 'rgba(255,255,255,0.97)', borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 12, padding: '12px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              {measurements.length} measurement{measurements.length > 1 ? 's' : ''}
            </div>
            {measurements.map((m, idx) => {
              const meters = distance(m.a, m.b);
              const active = m.id === selectedId;
              return (
                <div
                  key={m.id}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: active ? '#ECFEFF' : 'transparent',
                    border: `1px solid ${active ? '#22D3EE' : 'transparent'}`,
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{
                      flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                      background: '#F59E0B', color: '#FFFFFF', fontSize: '11px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{idx + 1}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', fontFamily: 'ui-monospace, monospace' }}>
                      {format(meters, unit)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeMeasurement(m.id); }}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '24px', height: '24px', borderRadius: '6px',
                      border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer',
                    }}
                    title="Delete measurement"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
