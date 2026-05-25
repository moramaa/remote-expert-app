'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HardHat, ArrowLeft, PhoneCall } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import LaserPointerDot from '@/components/worker/LaserPointerDot';
import ActiveStepCard from '@/components/worker/ActiveStepCard';
import WorkerZonesOverlay from '@/components/worker/WorkerZonesOverlay';
import EmergencyFreezeOverlay from '@/components/worker/EmergencyFreezeOverlay';
import WorkerMirrorToggle from '@/components/worker/WorkerMirrorToggle';
import PttButton from '@/components/shared/PttButton';
import DriverIndicator from '@/components/shared/DriverIndicator';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import EndSessionButton from '@/components/shared/EndSessionButton';
import SessionFeedbackModal from '@/components/shared/SessionFeedbackModal';
import { useSocket } from '@/hooks/useSocket';
import { getStoredUserId } from '@/lib/identity';
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
  sessionId:   string;
  machineId:   string;
  machineName: string;
  markers:     Marker[];
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
  // Epic 5: bidirectional mirror
  const [workerMirror, setWorkerMirror]   = useState(false);
  const [driver, setDriver]               = useState<'expert' | 'worker' | null>(null);
  // Epic 5: Expert PTT subtitle (auto-clears after 4s)
  const [expertPttSubtitle, setExpertPttSubtitle] = useState<string | null>(null);
  // Preview mode state
  const [previewData, setPreviewData]     = useState<PreviewData | null>(null);

  const mpSdkRef    = useRef<MatterportSdk | null>(null);
  const tagIdMapRef = useRef(new Map<string, string>());
  const syncedIdsRef = useRef(new Set<string>());
  const expertPttTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCameraEmitRef = useRef<number>(0);

  // ── Preview mode: load historical markers from API ────────────────────────
  useEffect(() => {
    if (!isPreview || !previewSessionId) return;
    fetch(`/api/sessions/${previewSessionId}/markers`)
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

  // ── Emit mirror-on / mirror-off when workerMirror changes ────────────────
  useEffect(() => {
    if (!socket || isPreview) return;
    if (workerMirror) {
      socket.emit('worker:mirror-on');
    } else {
      socket.emit('worker:mirror-off');
    }
  }, [workerMirror, socket, isPreview]);

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
    const onMirrorForcedOff = () => setWorkerMirror(false);
    const onDriverChanged   = ({ driver: d }: { driver: 'expert' | 'worker' | null }) => setDriver(d);
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
      socket.off('worker:expert-ptt',       onExpertPtt);
    };
  }, [socket, addSdkTag, isPreview]);

  // ── Camera emit when worker is driving ───────────────────────────────────
  const handleCameraMove = useCallback(
    (camera: CameraState) => {
      if (!workerMirror || !socket || isPreview) return;
      const now = Date.now();
      if (now - lastCameraEmitRef.current < 100) return; // throttle to 100ms
      lastCameraEmitRef.current = now;
      socket.emit('worker:camera-sync', camera);
    },
    [workerMirror, socket, isPreview],
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
    setFeedbackOpen(false);
    router.push('/dashboard/worker');
  }, [socket, router]);

  const handlePttChunk = useCallback((chunk: PttChunk) => {
    socket?.emit('worker:ptt-chunk', chunk);
  }, [socket]);

  const userId = getStoredUserId() ?? '';

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
              <PttButton speakerId={userId} onChunk={handlePttChunk} label="PTT" />
            )}
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
            isReadOnly={!workerMirror}
            onSdkReady={(sdk) => {
              mpSdkRef.current = sdk;
              setViewerReady(true);
              setMarkers((prev) => [...prev]);
            }}
            syncedCamera={isPreview ? null : (workerMirror ? null : syncedCamera)}
            onCameraMove={handleCameraMove}
          >
            <WorkerZonesOverlay zones={zones} />
            {!isPreview && <LaserPointerDot position={laser} />}
          </MatterportViewer>

          {/* Expert PTT subtitle */}
          {!isPreview && expertPttSubtitle && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
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
        <div style={{ flex: 1, padding: '12px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isPreview && (
            <WorkerMirrorToggle enabled={workerMirror} onChange={setWorkerMirror} />
          )}
          {!isPreview && (
            <ActiveStepCard
              instruction={activeInstruction}
              onDone={handleStepDone}
              onClarification={handleClarification}
            />
          )}
          {isPreview && previewData && previewData.markers.length === 0 && (
            <div style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              No markers were saved for this session.
            </div>
          )}
          {isPreview && previewData && previewData.markers.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Historical Markers ({previewData.markers.length})
              </div>
              {previewData.markers.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#0F172A',
                    marginBottom: '6px',
                    background: '#FFFFFF',
                  }}
                >
                  <span style={{ color: '#1D4ED8', fontWeight: 700, marginRight: '6px' }}>#{i + 1}</span>
                  {m.label ?? 'Unlabeled marker'}
                </div>
              ))}
            </div>
          )}
        </div>
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
        <SessionFeedbackModal open={feedbackOpen} onAnswer={handleFeedbackAnswer} />
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
