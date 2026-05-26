'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, Trash2, Bell } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import ModeSelector, { type ExpertMode } from '@/components/expert/ModeSelector';
import MarkersList from '@/components/expert/MarkersList';
import InstructionInput from '@/components/expert/InstructionInput';
import MirrorViewToggle from '@/components/expert/MirrorViewToggle';
import LaserOverlay from '@/components/expert/LaserOverlay';
import HighlightZoneDrawer from '@/components/expert/HighlightZoneDrawer';
import MarkerLabelDialog from '@/components/expert/MarkerLabelDialog';
import EmergencyFreezeButton from '@/components/expert/EmergencyFreezeButton';
import PlaybookSelector from '@/components/expert/PlaybookSelector';
import PttButton from '@/components/shared/PttButton';
import DriverIndicator from '@/components/shared/DriverIndicator';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import StatusBar from '@/components/shared/StatusBar';
import EndSessionButton from '@/components/shared/EndSessionButton';
import SessionFeedbackModal from '@/components/shared/SessionFeedbackModal';
import { useSocket } from '@/hooks/useSocket';
import { getStoredRole, getStoredSessionId, getStoredUserId } from '@/lib/identity';
import type {
  CameraState,
  HighlightZone,
  Instruction,
  Marker,
  PttChunk,
} from '@/types/socket';

const STEM_SCALE = 0.3;
const TAG_COLOR  = { r: 0.976, g: 0.451, b: 0.086 };

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ExpertPage() {
  const { socket, isConnected, connectionCount } = useSocket();
  const router = useRouter();

  const [mode, setMode] = useState<ExpertMode>('navigate');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [sentInstructions, setSentInstructions] = useState<Instruction[]>([]);
  // mirrorView replaced by driver state (expert drives ↔ worker drives ↔ off)
  const [viewerReady, setViewerReady] = useState(false);
  const [mpSdk, setMpSdk] = useState<MatterportSdk | null>(null);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [pendingIntersection, setPendingIntersection] = useState<MatterportIntersection | null>(null);
  const [lastAction, setLastAction] = useState('');
  const [emergencyAcknowledged, setEmergencyAcknowledged] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Notification banners for worker responses
  const [notification, setNotification] = useState<{ text: string; color: string } | null>(null);
  // Epic 5: bidirectional mirror
  const [syncedCamera, setSyncedCamera] = useState<CameraState | null>(null);
  const [driver, setDriver] = useState<'expert' | 'worker' | null>(null);
  const [controlRequested, setControlRequested] = useState(false);
  // Epic 5: Worker PTT subtitle (auto-clears after 4s)
  const [workerPttSubtitle, setWorkerPttSubtitle] = useState<string | null>(null);

  const viewerWrapperRef = useRef<HTMLDivElement>(null);
  const lastLaserEmitRef = useRef<number>(0);
  const lastIntersectionRef = useRef<MatterportIntersection | null>(null);
  const mpSdkRef = useRef<MatterportSdk | null>(null);
  const workerPttTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stage 1: live current sweep, refreshed by MatterportViewer's onSweepChange
  const currentSweepRef = useRef<{ sweepId: string; floor?: number } | null>(null);

  useEffect(() => { mpSdkRef.current = mpSdk; }, [mpSdk]);

  // ── Stage 1: rebind socket to live session room after navigating in ──────
  // The initial socket handshake may have used sessionId='demo' if this page
  // mounted before localStorage was updated. This explicit bind guarantees
  // markers/instructions/PTT events land in the right DB row.
  useEffect(() => {
    if (!socket || !isConnected) return;
    const stored = getStoredSessionId();
    if (stored) socket.emit('socket:bind-session', { sessionId: stored });
  }, [socket, isConnected]);

  // Auto-dismiss notification after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  // Auto-dismiss worker PTT subtitle after 4s
  useEffect(() => {
    if (!workerPttSubtitle) return;
    if (workerPttTimerRef.current) clearTimeout(workerPttTimerRef.current);
    workerPttTimerRef.current = setTimeout(() => setWorkerPttSubtitle(null), 4000);
    return () => {
      if (workerPttTimerRef.current) clearTimeout(workerPttTimerRef.current);
    };
  }, [workerPttSubtitle]);

  // Mirror control handlers — apply state OPTIMISTICALLY so the UI responds
  // immediately, then emit to server so the worker's view stays in sync.
  const handleExpertDrive = useCallback(() => {
    setDriver('expert');
    socket?.emit('expert:mirror-on');
  }, [socket]);

  const handleWorkerDrive = useCallback(() => {
    setDriver('worker');
    socket?.emit('expert:grant-control');
  }, [socket]);

  const handleStopMirror = useCallback(() => {
    setDriver(null);
    socket?.emit('expert:mirror-off');
  }, [socket]);

  const handleGrantControl = useCallback(() => {
    setControlRequested(false);
    setDriver('worker');
    socket?.emit('expert:grant-control');
  }, [socket]);

  const handleDenyControl = useCallback(() => {
    setControlRequested(false);
    socket?.emit('expert:deny-control');
  }, [socket]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onStepDone = ({ instructionId }: { instructionId: string }) => {
      const ins = sentInstructions.find((i) => i.id === instructionId);
      const label = ins?.text.slice(0, 40) ?? 'step';
      setNotification({ text: `✓ Worker marked done: "${label}…"`, color: '#16A34A' });
      setLastAction('Worker: step done');
    };

    const onNeedsClarification = ({ instructionId }: { instructionId: string }) => {
      const ins = sentInstructions.find((i) => i.id === instructionId);
      const label = ins?.text.slice(0, 40) ?? 'step';
      setNotification({ text: `❓ Worker needs clarification: "${label}…"`, color: '#D97706' });
      setLastAction('Worker: needs clarification');
    };

    const onEmergencyAcknowledged = () => {
      setEmergencyAcknowledged(true);
      setNotification({ text: '✓ Worker confirmed machine stop', color: '#16A34A' });
      setLastAction('Emergency acknowledged by worker');
    };

    const onSessionEnded = () => { setFeedbackOpen(true); };

    // Epic 5: worker camera relay (when worker is driving)
    const onWorkerCamera = (camera: CameraState) => { setSyncedCamera(camera); };

    // Epic 5: expert mirror was forced off (worker took over)
    const onMirrorForcedOff = () => {
      // driver state is updated via session:driver-changed; nothing extra needed
    };

    const onControlRequested = () => {
      setControlRequested(true);
    };

    // Epic 5: who is driving
    const onDriverChanged = ({ driver: d }: { driver: 'expert' | 'worker' | null }) => {
      setDriver(d);
    };

    // Epic 5: worker PTT subtitle
    const onWorkerPtt = (chunk: PttChunk) => {
      setWorkerPttSubtitle(chunk.text);
    };

    socket.on('expert:step-done',            onStepDone);
    socket.on('expert:needs-clarification',  onNeedsClarification);
    socket.on('expert:emergency-acknowledged', onEmergencyAcknowledged);
    socket.on('session:ended',               onSessionEnded);
    socket.on('expert:worker-camera',        onWorkerCamera);
    socket.on('expert:mirror-forced-off',    onMirrorForcedOff);
    socket.on('session:driver-changed',      onDriverChanged);
    socket.on('expert:worker-ptt',           onWorkerPtt);
    socket.on('expert:control-requested',    onControlRequested);

    return () => {
      socket.off('expert:step-done',            onStepDone);
      socket.off('expert:needs-clarification',  onNeedsClarification);
      socket.off('expert:emergency-acknowledged', onEmergencyAcknowledged);
      socket.off('session:ended',               onSessionEnded);
      socket.off('expert:worker-camera',        onWorkerCamera);
      socket.off('expert:mirror-forced-off',    onMirrorForcedOff);
      socket.off('session:driver-changed',      onDriverChanged);
      socket.off('expert:worker-ptt',           onWorkerPtt);
      socket.off('expert:control-requested',    onControlRequested);
    };
  }, [socket, sentInstructions]);

  // ----- Intersection tracking -----
  const handleIntersectionChange = useCallback((i: MatterportIntersection | null) => {
    lastIntersectionRef.current = i;
  }, []);

  // ----- Spacebar → place marker -----
  useEffect(() => {
    if (mode !== 'marker') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      e.stopPropagation();
      const i = lastIntersectionRef.current;
      if (!i) return;
      if (i.object === 'intersectedobject.none') return;
      setPendingIntersection(i);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [mode]);

  // ----- Marker placement -----
  const handleLabelSubmit = useCallback(
    async (label: string) => {
      const intersection = pendingIntersection;
      setPendingIntersection(null);
      if (!intersection || !mpSdkRef.current) return;

      const normal = intersection.normal ?? { x: 0, y: 1, z: 0 };
      const descriptor: MatterportTagDescriptor = {
        anchorPosition: intersection.position,
        stemVector: {
          x: normal.x * STEM_SCALE,
          y: normal.y * STEM_SCALE,
          z: normal.z * STEM_SCALE,
        },
        label: label.trim() || `Marker ${markers.length + 1}`,
        color: TAG_COLOR,
        stemVisible: true,
      };

      try {
        const [sdkTagId] = await mpSdkRef.current.Tag.add(descriptor);
        const marker: Marker = {
          id: sdkTagId,
          x: intersection.position.x,
          y: intersection.position.y,
          z: intersection.position.z,
          nx: normal.x,
          ny: normal.y,
          nz: normal.z,
          label: label.trim() || undefined,
          timestamp: Date.now(),
          // Stage 1: Matterport SDK context
          sweepId: currentSweepRef.current?.sweepId,
          floor:   currentSweepRef.current?.floor,
          placedBy: 'expert',
        };
        setMarkers((prev) => [...prev, marker]);
        socket?.emit('expert:place-marker', marker);
        setLastAction(`Marker placed${label.trim() ? `: "${label.trim()}"` : ''}`);
      } catch (err) {
        console.warn('Tag.add failed:', err);
      }
    },
    [pendingIntersection, markers.length, socket],
  );

  const removeMarker = useCallback(
    async (id: string) => {
      try { await mpSdkRef.current?.Tag.remove(id); } catch { /* ignore */ }
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      socket?.emit('expert:remove-marker', id);
      setLastAction('Marker removed');
    },
    [socket],
  );

  const clearMarkers = useCallback(async () => {
    if (mpSdkRef.current && markers.length > 0) {
      try { await mpSdkRef.current.Tag.remove(...markers.map((m) => m.id)); } catch { /* ignore */ }
    }
    setMarkers([]);
    socket?.emit('expert:clear-markers');
    setLastAction('Markers cleared');
  }, [markers, socket]);

  // ----- Instructions (also used by PlaybookSelector) -----
  const sendInstruction = useCallback(
    (instruction: Instruction | string) => {
      const ins: Instruction = typeof instruction === 'string'
        ? { id: uid(), text: instruction, timestamp: Date.now() }
        : instruction;
      setSentInstructions((prev) => [ins, ...prev].slice(0, 20));
      socket?.emit('expert:send-instruction', ins);
      setLastAction('Instruction sent');
    },
    [socket],
  );

  // ----- PTT -----
  const handlePttChunk = useCallback(
    (chunk: PttChunk) => {
      socket?.emit('expert:ptt-chunk', chunk);
      setLastAction(`PTT: "${chunk.text.slice(0, 30)}…"`);
    },
    [socket],
  );

  // ----- Zones -----
  const addZone = useCallback(
    (partial: Omit<HighlightZone, 'id' | 'timestamp'>) => {
      const zone: HighlightZone = { ...partial, id: uid(), timestamp: Date.now() };
      setZones((prev) => [...prev, zone]);
      socket?.emit('expert:highlight-zone', zone);
      setLastAction('Highlight zone added');
    },
    [socket],
  );

  const clearZones = useCallback(() => {
    setZones([]);
    socket?.emit('expert:clear-zones');
    setLastAction('Zones cleared');
  }, [socket]);

  // ----- Camera sync -----
  const handleCameraMove = useCallback(
    (camera: CameraState) => {
      if (driver === 'expert') socket?.emit('expert:camera-sync', camera);
    },
    [driver, socket],
  );

  // ----- Laser -----
  const handleViewerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== 'laser') return;
      const rect = viewerWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLaser({ x, y });
      const now = Date.now();
      if (now - lastLaserEmitRef.current >= 50) {
        lastLaserEmitRef.current = now;
        socket?.emit('expert:laser-pointer', { x, y });
      }
    },
    [mode, socket],
  );

  const handleViewerMouseLeave = useCallback(() => {
    if (mode !== 'laser') return;
    setLaser(null);
    socket?.emit('expert:laser-pointer', null);
  }, [mode, socket]);

  const handleModeChange = useCallback(
    (nextMode: ExpertMode) => {
      if (mode === 'laser' && nextMode !== 'laser') {
        setLaser(null);
        socket?.emit('expert:laser-pointer', null);
      }
      if (mode === 'marker' && nextMode !== 'marker') {
        setPendingIntersection(null);
      }
      setMode(nextMode);
    },
    [mode, socket],
  );

  // ----- Emergency -----
  const handleEmergencyFreeze = useCallback(() => {
    socket?.emit('expert:emergency-freeze');
    setLastAction('Emergency freeze sent');
    setEmergencyAcknowledged(false);
  }, [socket]);

  // ----- Session end -----
  const handleEndSession = useCallback(() => {
    setFeedbackOpen(true);
  }, []);

  const handleFeedbackAnswer = useCallback(
    (resolved: boolean) => {
      socket?.emit('session:end', { resolved });
      // Modal stays open to show recording confirmation — navigation happens via onDone
    },
    [socket],
  );

  const handleFeedbackDone = useCallback(() => {
    setFeedbackOpen(false);
    const role = getStoredRole();
    router.push(role === 'expert' ? '/dashboard/expert' : '/dashboard/worker');
  }, [router]);

  // ----- Clear All -----
  const clearAll = useCallback(async () => {
    if (!window.confirm('Clear all markers, zones, and instructions?')) return;
    if (mpSdkRef.current && markers.length > 0) {
      try { await mpSdkRef.current.Tag.remove(...markers.map((m) => m.id)); } catch { /* ignore */ }
    }
    setMarkers([]);
    setZones([]);
    setSentInstructions([]);
    socket?.emit('expert:clear-markers');
    socket?.emit('expert:clear-zones');
    setLastAction('Cleared everything');
  }, [markers, socket]);

  const headerInfo = useMemo(
    () => ({ markerCount: markers.length, zoneCount: zones.length }),
    [markers, zones],
  );

  const sessionId = getStoredSessionId();
  const userId = getStoredUserId() ?? '';

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#F8FAFC', color: '#0F172A' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          background: '#FFFFFF',
          padding: '10px 20px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Factory size={22} color="#1D4ED8" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.02em' }}>
              FieldSync Expert Console
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Space: RXLkh8vriYF
            </div>
          </div>
          <DriverIndicator driver={driver} myRole="expert" />
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: notification.color + '18',
              border: `1px solid ${notification.color}40`,
              color: notification.color,
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Bell size={12} />
            {notification.text}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <EndSessionButton onEndSession={handleEndSession} />
          <ConnectionStatus
            socketConnected={isConnected}
            viewerReady={viewerReady}
            connectionCount={connectionCount}
            role="expert"
          />
        </div>
      </header>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Viewer */}
        <div
          ref={viewerWrapperRef}
          onMouseMove={handleViewerMouseMove}
          onMouseLeave={handleViewerMouseLeave}
          style={{
            position: 'relative',
            flex: 1,
            background: '#000',
            cursor: mode === 'marker' ? 'crosshair' : 'default',
          }}
        >
          <MatterportViewer
            isReadOnly={false}
            onIntersectionChange={handleIntersectionChange}
            onCameraMove={handleCameraMove}
            onSdkReady={(sdk) => { setViewerReady(true); setMpSdk(sdk); }}
            onSweepChange={(sweep) => { currentSweepRef.current = sweep; }}
            syncedCamera={driver === 'worker' ? syncedCamera : null}
          >
            <HighlightZoneDrawer active={mode === 'highlight'} zones={zones} onComplete={addZone} />
            <LaserOverlay position={laser} />
            <MarkerLabelDialog
              key={pendingIntersection ? 'open' : 'closed'}
              position={pendingIntersection ? { x: 50, y: 40 } : null}
              onSubmit={handleLabelSubmit}
              onCancel={() => setPendingIntersection(null)}
            />
          </MatterportViewer>

          {mode === 'marker' && viewerReady && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid #1D4ED8',
                color: '#1D4ED8',
                fontSize: '11px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                zIndex: 10,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Hover over a surface · Press <strong>Space</strong> to place marker
            </div>
          )}

          {/* Worker PTT subtitle */}
          {workerPttSubtitle && (
            <div
              style={{
                position: 'absolute',
                bottom: '48px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(217,119,6,0.92)',
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
              🎙 Worker: {workerPttSubtitle}
            </div>
          )}
        </div>

        {/* Control panel */}
        <aside
          style={{
            width: '300px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #E2E8F0',
            background: '#F8FAFC',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable section — everything except the danger bar */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
            }}
          >
            {/* Mode */}
            <ModeSelector mode={mode} onChange={handleModeChange} />

            {/* Playbooks */}
            <PlaybookSelector onSendStep={sendInstruction} />

            {/* PTT */}
            <div
              style={{
                padding: '8px 10px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                background: '#FFFFFF',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Push-to-Talk
              </div>
              <PttButton speakerId={userId} onChunk={handlePttChunk} />
            </div>

            {/* Send Instruction */}
            <InstructionInput recent={sentInstructions} onSend={(text) => sendInstruction(text)} />

            {/* Markers */}
            <MarkersList markers={markers} onRemove={removeMarker} onClearAll={clearMarkers} />

            {/* Mirror View */}
            <MirrorViewToggle
              driver={driver}
              controlRequested={controlRequested}
              onExpertDrive={handleExpertDrive}
              onWorkerDrive={handleWorkerDrive}
              onStopMirror={handleStopMirror}
              onGrant={handleGrantControl}
              onDeny={handleDenyControl}
            />
          </div>

          {/* Sticky danger bar — always visible at the bottom */}
          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid #E2E8F0',
              background: '#FFFFFF',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Emergency Freeze */}
            <EmergencyFreezeButton onFreeze={handleEmergencyFreeze} acknowledged={emergencyAcknowledged} />

            {/* Clear actions row */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={clearMarkers}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  border: '1px solid #E2E8F0', background: 'transparent', color: '#64748B',
                  borderRadius: '6px', padding: '6px', fontSize: '11px', cursor: 'pointer',
                }}
              >
                <Trash2 size={10} /> Markers
              </button>
              <button
                type="button"
                onClick={clearZones}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  border: '1px solid #E2E8F0', background: 'transparent', color: '#64748B',
                  borderRadius: '6px', padding: '6px', fontSize: '11px', cursor: 'pointer',
                }}
              >
                <Trash2 size={10} /> Zones
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  border: '1px solid #DC262640', background: 'transparent', color: '#DC2626',
                  borderRadius: '6px', padding: '6px', fontSize: '11px', cursor: 'pointer',
                }}
              >
                <Trash2 size={10} /> All
              </button>
            </div>
          </div>
        </aside>
      </div>

      <StatusBar
        mode={mode}
        markerCount={headerInfo.markerCount}
        zoneCount={headerInfo.zoneCount}
        lastAction={lastAction}
      />

      {/* Session feedback modal */}
      <SessionFeedbackModal
        open={feedbackOpen}
        role="expert"
        sessionId={sessionId}
        onAnswer={handleFeedbackAnswer}
        onDone={handleFeedbackDone}
        onViewHistory={handleFeedbackDone}
      />
    </div>
  );
}
