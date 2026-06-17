'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ruler, Trash2, X, MousePointerClick } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import MeasurementOverlay, {
  type Measurement,
  type ProjectedMeasurement,
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

  const wrapperRef          = useRef<HTMLDivElement>(null);
  const mpSdkRef            = useRef<MatterportSdk | null>(null);
  const poseRef             = useRef<MatterportPose | null>(null);
  const sizeRef             = useRef({ w: 0, h: 0 });
  const lastIntersectionRef = useRef<MatterportIntersection | null>(null);
  const firstPointRef       = useRef<PendingPoint | null>(null);
  const lastHashRef         = useRef('');
  const downRef             = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => { firstPointRef.current = firstPoint; }, [firstPoint]);

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
    if (!firstPoint) return null;
    const hover = lastIntersectionRef.current?.position;
    if (!hover) return null;
    const b = { x: hover.x, y: hover.y, z: hover.z };
    return { a: project(firstPoint.pos), b: project(b), meters: distance(firstPoint.pos, b) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPoint, project, size, frame]);

  const hint = firstPoint
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
            <MousePointerClick size={14} color="#F59E0B" />
            {hint} · or press <strong style={{ margin: '0 2px' }}>Space</strong>
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
