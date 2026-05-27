'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HardHat, ArrowLeft, PhoneCall,
  MapPin, MessageSquare, Tag, Mic, Clock,
  CheckCircle2, XCircle, AlertTriangle, ChevronRight, Loader2,
} from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import LaserPointerDot from '@/components/worker/LaserPointerDot';
import ActiveStepCard from '@/components/worker/ActiveStepCard';
import WorkerZonesOverlay from '@/components/worker/WorkerZonesOverlay';
import EmergencyFreezeOverlay from '@/components/worker/EmergencyFreezeOverlay';
import WorkerControlRequest from '@/components/worker/WorkerControlRequest';
import PttButton from '@/components/shared/PttButton';
import DriverIndicator from '@/components/shared/DriverIndicator';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import EndSessionButton from '@/components/shared/EndSessionButton';
import SessionFeedbackModal from '@/components/shared/SessionFeedbackModal';
import { useSocket } from '@/hooks/useSocket';
import { getStoredUserId, getStoredSessionId } from '@/lib/identity';
import type {
  CameraState,
  HighlightZone,
  Instruction,
  LaserPointer,
  Marker,
  PttChunk,
  SyncState,
} from '@/types/socket';

const TAG_COLOR = { r: 0.114, g: 0.306, b: 0.847 }; // brand blue #1D4ED8
const STEM_SCALE = 0.3;

// ── Preview mode data shape ────────────────────────────────────────────────────
interface PreviewData {
  sessionId:       string;
  machineId:       string;
  machineName:     string;
  markers:         Marker[];
  instructions:    Instruction[];
  pttCount:        number;
  durationSeconds: number;
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;
  locationDept:    string | null;
  locationLine:    string | null;
  locationStation: string | null;
}

function WorkerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket, isConnected, connectionCount } = useSocket();

  // Preview mode: ?preview=SESSION_ID (show historical markers, no live session)
  const previewSessionId = searchParams.get('preview');
  const autoSosMachineId = searchParams.get('sos'); // ?sos=MACHINE_ID → open SOS for that machine
  const isPreview = !!previewSessionId;

  const [viewerReady, setViewerReady]     = useState(false);
  const [markers, setMarkers]             = useState<Marker[]>([]);
  const [zones, setZones]                 = useState<HighlightZone[]>([]);
  const [laser, setLaser]                 = useState<LaserPointer | null>(null);
  const [activeInstruction, setActiveInstruction] = useState<Instruction | null>(null);
  const [syncedCamera, setSyncedCamera]   = useState<CameraState | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [feedbackOpen, setFeedbackOpen]   = useState(false);
  // Epic 5: bidirectional mirror (worker no longer has a self-toggle)
  const [driver, setDriver]               = useState<'expert' | 'worker' | null>(null);
  const [controlPending, setControlPending] = useState(false);
  const [controlDenied,  setControlDenied]  = useState(false);
  // Epic 5: Expert PTT subtitle (auto-clears after 4s)
  const [expertPttSubtitle, setExpertPttSubtitle] = useState<string | null>(null);
  // Preview mode state
  const [previewData, setPreviewData]     = useState<PreviewData | null>(null);

  const mpSdkRef    = useRef<MatterportSdk | null>(null);
  // Stage 1: live current sweep + last position-ping fingerprint
  const currentSweepRef   = useRef<{ sweepId: string; floor?: number } | null>(null);
  const currentPoseRef    = useRef<CameraState | null>(null);
  const lastPingedSweepRef = useRef<string | null>(null);
  const tagIdMapRef = useRef(new Map<string, string>());
  const syncedIdsRef = useRef(new Set<string>());
  const expertPttTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCameraEmitRef = useRef<number>(0);

  // ── Preview mode: load full session data from API ────────────────────────
  useEffect(() => {
    if (!isPreview || !previewSessionId) return;
    fetch(`/api/sessions/${previewSessionId}`)
      .then((r) => r.json())
      .then((data: PreviewData) => setPreviewData(data))
      .catch(() => {/* noop */});
  }, [isPreview, previewSessionId]);

  // ── Add/remove SDK tags ───────────────────────────────────────────────────
  const addSdkTag = useCallback(async (m: Marker) => {
    const sdk = mpSdkRef.current;
    if (!sdk || syncedIdsRef.current.has(m.id)) return;
    syncedIdsRef.current.add(m.id);
    try {
      const [grantedId] = await sdk.Tag.add({
        id: m.id,
        anchorPosition: { x: m.x, y: m.y, z: m.z },
        stemVector:     { x: m.nx * STEM_SCALE, y: m.ny * STEM_SCALE, z: m.nz * STEM_SCALE },
        label:      m.label ?? 'Marker',
        color:      TAG_COLOR,
        stemVisible: true,
      });
      tagIdMapRef.current.set(m.id, grantedId);
    } catch (err) {
      syncedIdsRef.current.delete(m.id);
      console.warn('Worker Tag.add failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!mpSdkRef.current) return;
    const unsynced = markers.filter((m) => !syncedIdsRef.current.has(m.id));
    unsynced.forEach((m) => void addSdkTag(m));
  }, [markers, addSdkTag]);

  // Load preview markers into viewer when SDK becomes ready
  useEffect(() => {
    if (!isPreview || !previewData || !viewerReady) return;
    setMarkers(previewData.markers);
  }, [isPreview, previewData, viewerReady]);

  // ── Worker requests camera control from expert ────────────────────────────
  const handleRequestControl = useCallback(() => {
    if (!socket || isPreview || controlPending) return;
    setControlPending(true);
    socket.emit('worker:request-control');
  }, [socket, isPreview, controlPending]);

  // ── Preview: click a marker chip to fly the 3D camera to it ────────────
  const handleJumpToMarker = useCallback(async (m: Marker) => {
    const sdk = mpSdkRef.current;
    if (!sdk) return;
    const sdkTagId = tagIdMapRef.current.get(m.id);
    if (!sdkTagId) return;
    try {
      // Tag.open navigates the camera to the tag and highlights it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sdk.Tag as any).open(sdkTagId);
    } catch { /* noop */ }
  }, []);

  // ── Stage 1: rebind socket to live session room after navigating in ──────
  useEffect(() => {
    if (!socket || !isConnected || isPreview) return;
    const stored = getStoredSessionId();
    if (stored) socket.emit('socket:bind-session', { sessionId: stored });
  }, [socket, isConnected, isPreview]);

  // ── Stage 1: breadcrumb position-ping every 30s when sweep changes ───────
  useEffect(() => {
    if (!socket || isPreview) return;
    const interval = setInterval(() => {
      const sweep = currentSweepRef.current;
      const pose  = currentPoseRef.current;
      if (!sweep || !pose) return;
      // Skip if sweep hasn't changed since last ping (avoids identical entries)
      if (sweep.sweepId === lastPingedSweepRef.current) return;
      lastPingedSweepRef.current = sweep.sweepId;
      socket.emit('worker:position-ping', {
        ts: Date.now(),
        sweepId:  sweep.sweepId,
        position: pose.position,
        floor:    sweep.floor,
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [socket, isPreview]);

  // ── Auto-dismiss expert PTT subtitle ─────────────────────────────────────
  useEffect(() => {
    if (!expertPttSubtitle) return;
    if (expertPttTimerRef.current) clearTimeout(expertPttTimerRef.current);
    expertPttTimerRef.current = setTimeout(() => setExpertPttSubtitle(null), 4000);
    return () => {
      if (expertPttTimerRef.current) clearTimeout(expertPttTimerRef.current);
    };
  }, [expertPttSubtitle]);

  // ── Socket listeners (live session only) ─────────────────────────────────
  useEffect(() => {
    if (!socket || isPreview) return;

    const onMarker = (m: Marker) => {
      setMarkers((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      void addSdkTag(m);
    };

    const onRemoveMarker = async (id: string) => {
      const sdkId = tagIdMapRef.current.get(id) ?? id;
      try { await mpSdkRef.current?.Tag.remove(sdkId); } catch { /* ignore */ }
      tagIdMapRef.current.delete(id);
      syncedIdsRef.current.delete(id);
      setMarkers((prev) => prev.filter((m) => m.id !== id));
    };

    const onClearMarkers = async () => {
      const sdkIds = [...tagIdMapRef.current.values()];
      if (sdkIds.length > 0) {
        try { await mpSdkRef.current?.Tag.remove(...sdkIds); } catch { /* ignore */ }
      }
      tagIdMapRef.current.clear();
      syncedIdsRef.current.clear();
      setMarkers([]);
    };

    const onInstruction    = (ins: Instruction) => setActiveInstruction(ins);
    const onLaser          = (pos: LaserPointer | null) => setLaser(pos);
    const onCamera         = (cam: CameraState) => setSyncedCamera(cam);
    const onZone           = (z: HighlightZone) => setZones((prev) => [...prev, z]);
    const onClearZones     = () => setZones([]);
    const onEmergencyFreeze = () => setEmergencyActive(true);
    const onSessionEnded   = () => setFeedbackOpen(true);

    const onSync = async (state: SyncState) => {
      const sdkIds = [...tagIdMapRef.current.values()];
      if (sdkIds.length > 0) {
        try { await mpSdkRef.current?.Tag.remove(...sdkIds); } catch { /* ignore */ }
      }
      tagIdMapRef.current.clear();
      syncedIdsRef.current.clear();
      setMarkers(state.markers);
      setZones(state.zones);
      if (state.latestInstruction) setActiveInstruction(state.latestInstruction);
      if (state.camera) setSyncedCamera(state.camera);
    };

    // Epic 5: mirror events
    const onMirrorForcedOff = () => { /* driver state updated via session:driver-changed */ };
    const onDriverChanged   = ({ driver: d }: { driver: 'expert' | 'worker' | null }) => {
      setDriver(d);
      // If expert took control back, clear any pending state
      if (d !== 'worker') setControlPending(false);
    };
    const onControlGranted  = () => {
      setControlPending(false);
      setControlDenied(false);
    };
    const onControlDenied   = () => {
      setControlPending(false);
      setControlDenied(true);
    };
    const onExpertPtt       = (chunk: PttChunk) => setExpertPttSubtitle(chunk.text);

    socket.on('worker:sync-state',       onSync);
    socket.on('worker:new-marker',       onMarker);
    socket.on('worker:remove-marker',    onRemoveMarker);
    socket.on('worker:clear-markers',    onClearMarkers);
    socket.on('worker:instruction',      onInstruction);
    socket.on('worker:laser-pointer',    onLaser);
    socket.on('worker:camera-sync',      onCamera);
    socket.on('worker:highlight-zone',   onZone);
    socket.on('worker:clear-zones',      onClearZones);
    socket.on('worker:emergency-freeze', onEmergencyFreeze);
    socket.on('session:ended',           onSessionEnded);
    socket.on('worker:mirror-forced-off', onMirrorForcedOff);
    socket.on('session:driver-changed',  onDriverChanged);
    socket.on('worker:control-granted',  onControlGranted);
    socket.on('worker:control-denied',   onControlDenied);
    socket.on('worker:expert-ptt',       onExpertPtt);

    return () => {
      socket.off('worker:sync-state',       onSync);
      socket.off('worker:new-marker',       onMarker);
      socket.off('worker:remove-marker',    onRemoveMarker);
      socket.off('worker:clear-markers',    onClearMarkers);
      socket.off('worker:instruction',      onInstruction);
      socket.off('worker:laser-pointer',    onLaser);
      socket.off('worker:camera-sync',      onCamera);
      socket.off('worker:highlight-zone',   onZone);
      socket.off('worker:clear-zones',      onClearZones);
      socket.off('worker:emergency-freeze', onEmergencyFreeze);
      socket.off('session:ended',           onSessionEnded);
      socket.off('worker:mirror-forced-off', onMirrorForcedOff);
      socket.off('session:driver-changed',  onDriverChanged);
      socket.off('worker:control-granted',  onControlGranted);
      socket.off('worker:control-denied',   onControlDenied);
      socket.off('worker:expert-ptt',       onExpertPtt);
    };
  }, [socket, addSdkTag, isPreview]);

  // ── Camera emit when worker is driving ───────────────────────────────────
  const handleCameraMove = useCallback(
    (camera: CameraState) => {
      // Always remember the latest pose for breadcrumb pings
      currentPoseRef.current = camera;
      if (driver !== 'worker' || !socket || isPreview) return;
      const now = Date.now();
      if (now - lastCameraEmitRef.current < 100) return; // throttle to 100ms
      lastCameraEmitRef.current = now;
      socket.emit('worker:camera-sync', camera);
    },
    [driver, socket, isPreview],
  );

  const handleStepDone = useCallback((instructionId: string) => {
    socket?.emit('worker:step-done', { instructionId });
    setActiveInstruction(null);
  }, [socket]);

  const handleClarification = useCallback((instructionId: string) => {
    socket?.emit('worker:needs-clarification', { instructionId });
  }, [socket]);

  const handleEmergencyAcknowledge = useCallback(() => {
    socket?.emit('worker:emergency-acknowledged');
    setEmergencyActive(false);
  }, [socket]);

  const handleEndSession = useCallback(() => setFeedbackOpen(true), []);

  const handleFeedbackAnswer = useCallback((resolved: boolean) => {
    socket?.emit('session:end', { resolved });
    // Modal stays open to show recording confirmation — navigation happens via onDone
  }, [socket]);

  const handleFeedbackDone = useCallback(() => {
    setFeedbackOpen(false);
    router.push('/dashboard/worker');
  }, [router]);

  const handlePttChunk = useCallback((chunk: PttChunk) => {
    socket?.emit('worker:ptt-chunk', chunk);
  }, [socket]);

  const userId    = getStoredUserId() ?? '';
  const sessionId = getStoredSessionId();

  // ── Preview mode banner ───────────────────────────────────────────────────
  const PreviewBanner = previewData ? (
    <div
      style={{
        background: '#DBEAFE',
        borderBottom: '1px solid #93C5FD',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preview Mode
        </span>
        <span style={{ fontSize: '11px', color: '#1E40AF' }}>
          {previewData.machineName} — historical markers
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => {
            router.push(`/dashboard/worker${previewData.machineId ? `?sos=${previewData.machineId}` : ''}`);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: '#1D4ED8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <PhoneCall size={12} />
          Start Live SOS Call
        </button>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            background: 'transparent',
            color: '#1D4ED8',
            border: '1px solid #93C5FD',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'stretch',
        justifyContent: 'center',
        background: '#F8FAFC',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '430px',
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Preview banner (if preview mode) */}
        {isPreview && PreviewBanner}

        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: '10px 12px',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardHat size={18} color="#1D4ED8" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', color: '#0F172A' }}>
                FieldSync Worker
              </div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8' }}>
                {isPreview ? 'Preview Mode' : 'On-Site'}
              </div>
            </div>
            {!isPreview && <DriverIndicator driver={driver} myRole="worker" />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isPreview && (
              <ConnectionStatus
                socketConnected={isConnected}
                viewerReady={viewerReady}
                connectionCount={connectionCount}
                role="worker"
              />
            )}
            {!isPreview && <EndSessionButton onEndSession={handleEndSession} />}
          </div>
        </header>

        {/* Viewer */}
        <div style={{ position: 'relative', height: '50vh', minHeight: '280px', background: '#000' }}>
          <MatterportViewer
            isReadOnly={isPreview ? false : driver !== 'worker'}
            onSdkReady={(sdk) => {
              mpSdkRef.current = sdk;
              setViewerReady(true);
              setMarkers((prev) => [...prev]);
            }}
            onSweepChange={(sweep) => { currentSweepRef.current = sweep; }}
            syncedCamera={isPreview ? null : (driver === 'worker' ? null : syncedCamera)}
            onCameraMove={handleCameraMove}
          >
            <WorkerZonesOverlay zones={zones} />
            {!isPreview && <LaserPointerDot position={laser} />}
          </MatterportViewer>

          {/* Floating PTT FAB — bottom-right of viewer */}
          {!isPreview && (
            <div style={{ position: 'absolute', bottom: '20px', right: '16px', zIndex: 20 }}>
              <PttButton speakerId={userId} onChunk={handlePttChunk} floating />
            </div>
          )}

          {/* Expert PTT subtitle — sits above the floating PTT FAB */}
          {!isPreview && expertPttSubtitle && (
            <div
              style={{
                position: 'absolute',
                bottom: '104px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(29,78,216,0.9)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                padding: '6px 16px',
                borderRadius: '20px',
                zIndex: 20,
                whiteSpace: 'nowrap',
                maxWidth: '80%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              🎙 Expert: {expertPttSubtitle}
            </div>
          )}
        </div>

        {/* Controls + Step Card (live session only) */}
        {!isPreview && (
          <div style={{ flex: 1, padding: '12px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <WorkerControlRequest
              driver={driver}
              controlPending={controlPending}
              controlDenied={controlDenied}
              onRequest={handleRequestControl}
            />
            <ActiveStepCard
              instruction={activeInstruction}
              onDone={handleStepDone}
              onClarification={handleClarification}
            />
          </div>
        )}

        {/* ── Preview Mode: rich session detail panel ───────────────────── */}
        {isPreview && (
          <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

            {/* Loading state */}
            {!previewData && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94A3B8', padding: '32px' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px' }}>Loading session…</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {previewData && (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* ── Status row ─────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {(previewData.resolvedExpert || previewData.resolvedWorker) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D' }}>
                      <CheckCircle2 size={11} /> Resolved
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: '#FEE2E2', color: '#DC2626' }}>
                      <XCircle size={11} /> Unresolved
                    </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B' }}>
                    <Clock size={11} />
                    {previewData.durationSeconds < 60
                      ? `${previewData.durationSeconds}s`
                      : `${Math.floor(previewData.durationSeconds / 60)}m ${previewData.durationSeconds % 60}s`}
                  </span>
                  {previewData.pttCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B' }}>
                      <Mic size={11} /> {previewData.pttCount} voice
                    </span>
                  )}
                </div>

                {/* ── Location chip ───────────────────────────────────── */}
                {(previewData.locationDept || previewData.locationLine || previewData.locationStation) && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', color: '#0F172A', fontWeight: 500, alignSelf: 'flex-start' }}>
                    <MapPin size={12} color="#1D4ED8" />
                    {[previewData.locationDept, previewData.locationLine, previewData.locationStation].filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* ── Safety warning ──────────────────────────────────── */}
                {previewData.safetyTriggered && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#FEF3C7', border: '1px solid #FCD34D' }}>
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: '#78350F', fontWeight: 500, lineHeight: 1.5 }}>
                      An emergency stop was triggered during this session. Review all safety precautions before proceeding.
                    </span>
                  </div>
                )}

                {/* ── Expert Instructions ─────────────────────────────── */}
                {previewData.instructions.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <MessageSquare size={12} color="#64748B" />
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                        Expert Instructions ({previewData.instructions.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {previewData.instructions.map((ins, i) => (
                        <div
                          key={ins.id}
                          style={{
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            padding: '9px 12px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderLeft: '3px solid #1D4ED8',
                            borderRadius: '0 8px 8px 0',
                          }}
                        >
                          <span style={{
                            flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                            background: '#1D4ED8', color: '#FFFFFF',
                            fontSize: '10px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: '13px', color: '#0F172A', lineHeight: 1.5 }}>
                            {ins.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Markers — tap to jump in 3D ────────────────────── */}
                {previewData.markers.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Tag size={12} color="#64748B" />
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                        Markers — tap to jump in 3D
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {previewData.markers.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => void handleJumpToMarker(m)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            width: '100%', padding: '9px 12px',
                            background: '#FFFFFF', border: '1px solid #E2E8F0',
                            borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                            transition: 'border-color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#93C5FD'; (e.currentTarget as HTMLButtonElement).style.background = '#F0F7FF'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
                        >
                          <span style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: '#FEF3C7', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#D97706' }}>
                            {i + 1}
                          </span>
                          <span style={{ flex: 1, fontSize: '13px', color: '#0F172A', fontWeight: 500 }}>
                            {m.label ?? 'Unlabeled marker'}
                          </span>
                          <ChevronRight size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Empty state ─────────────────────────────────────── */}
                {previewData.markers.length === 0 && previewData.instructions.length === 0 && previewData.pttCount === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: '13px' }}>
                    No markers, instructions or voice messages were recorded in this session.
                  </div>
                )}

              </div>
            )}

            {/* ── Sticky SOS CTA ─────────────────────────────────────── */}
            {previewData && (
              <div style={{ marginTop: 'auto', padding: '12px 12px 16px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF', flexShrink: 0 }}>
                <button
                  onClick={() => router.push(`/dashboard/worker${previewData.machineId ? `?sos=${previewData.machineId}` : ''}`)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', padding: '13px',
                    background: '#DC2626', color: '#FFFFFF', border: 'none',
                    borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 2px 10px rgba(220,38,38,0.3)',
                  }}
                >
                  <PhoneCall size={15} />
                  Still need help? Start Live SOS Call
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Emergency overlay */}
      {!isPreview && (
        <EmergencyFreezeOverlay
          visible={emergencyActive}
          onAcknowledge={handleEmergencyAcknowledge}
        />
      )}

      {/* Session outcome modal */}
      {!isPreview && (
        <SessionFeedbackModal
          open={feedbackOpen}
          role="worker"
          sessionId={sessionId}
          onAnswer={handleFeedbackAnswer}
          onDone={handleFeedbackDone}
          onViewHistory={() => { setFeedbackOpen(false); router.push('/dashboard/worker/history'); }}
        />
      )}
    </div>
  );
}

// Suspense boundary required for useSearchParams in Next.js App Router
export default function WorkerPage() {
  return (
    <Suspense>
      <WorkerPageInner />
    </Suspense>
  );
}
