'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardHat } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import LaserPointerDot from '@/components/worker/LaserPointerDot';
import ActiveStepCard from '@/components/worker/ActiveStepCard';
import WorkerZonesOverlay from '@/components/worker/WorkerZonesOverlay';
import EmergencyFreezeOverlay from '@/components/worker/EmergencyFreezeOverlay';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import EndSessionButton from '@/components/shared/EndSessionButton';
import SessionFeedbackModal from '@/components/shared/SessionFeedbackModal';
import { useSocket } from '@/hooks/useSocket';
import type { CameraState, HighlightZone, Instruction, LaserPointer, Marker, SyncState } from '@/types/socket';

const TAG_COLOR = { r: 0.114, g: 0.306, b: 0.847 }; // brand blue #1D4ED8
const STEM_SCALE = 0.3;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkerPage() {
  const router = useRouter();
  const { socket, isConnected, connectionCount } = useSocket();

  const [viewerReady, setViewerReady] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [laser, setLaser] = useState<LaserPointer | null>(null);
  const [activeInstruction, setActiveInstruction] = useState<Instruction | null>(null);
  const [syncedCamera, setSyncedCamera] = useState<CameraState | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  /**
   * Ref-based SDK handle so socket callbacks always see the latest SDK
   * without needing to be re-registered every time mpSdk changes.
   */
  const mpSdkRef = useRef<MatterportSdk | null>(null);

  /**
   * Tracks logical marker IDs → SDK-granted tag IDs.
   * The SDK may assign a different ID than the one we request, so we keep
   * this map so Tag.remove() always uses the correct SDK-side ID.
   */
  const tagIdMapRef = useRef(new Map<string, string>());

  /**
   * Tracks which logical marker IDs have already been handed to Tag.add().
   * Used by the sync useEffect so we don't double-add tags.
   */
  const syncedIdsRef = useRef(new Set<string>());

  /**
   * Add a native Matterport Tag for a marker.
   * Safe to call even before the SDK is ready — the markers-sync useEffect
   * will catch any markers that arrive before the SDK initialises.
   */
  const addSdkTag = useCallback(async (m: Marker) => {
    const sdk = mpSdkRef.current;
    if (!sdk || syncedIdsRef.current.has(m.id)) return;
    syncedIdsRef.current.add(m.id); // mark immediately to avoid duplicate calls
    try {
      const [grantedId] = await sdk.Tag.add({
        id: m.id,
        anchorPosition: { x: m.x, y: m.y, z: m.z },
        stemVector:     { x: m.nx * STEM_SCALE, y: m.ny * STEM_SCALE, z: m.nz * STEM_SCALE },
        label:      m.label ?? `Marker`,
        color:      TAG_COLOR,
        stemVisible: true,
      });
      tagIdMapRef.current.set(m.id, grantedId);
    } catch (err) {
      // If Tag.add fails, allow retry next time
      syncedIdsRef.current.delete(m.id);
      console.warn('Worker Tag.add failed:', err);
    }
  }, []);

  /**
   * Sync effect: whenever mpSdk becomes available (or markers arrive before SDK
   * was ready), add any tags that are not yet in the SDK.
   */
  useEffect(() => {
    if (!mpSdkRef.current) return;
    const unsynced = markers.filter((m) => !syncedIdsRef.current.has(m.id));
    unsynced.forEach((m) => void addSdkTag(m));
  }, [markers, addSdkTag]);

  // Wire socket listeners
  useEffect(() => {
    if (!socket) return;

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

    const onInstruction = (ins: Instruction) => {
      setActiveInstruction(ins);
    };

    const onLaser = (pos: LaserPointer | null) => {
      setLaser(pos);
    };

    const onCamera = (cam: CameraState) => {
      setSyncedCamera(cam);
    };

    const onZone = (z: HighlightZone) => {
      setZones((prev) => [...prev, z]);
    };

    const onClearZones = () => {
      setZones([]);
    };

    const onSync = async (state: SyncState) => {
      // Clear existing SDK tags before restoring from sync snapshot
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
      // Tags are added by the markers-sync useEffect after state update
    };

    const onEmergencyFreeze = () => {
      setEmergencyActive(true);
    };

    const onSessionEnded = () => {
      setFeedbackOpen(true);
    };

    socket.on('worker:sync-state',     onSync);
    socket.on('worker:new-marker',     onMarker);
    socket.on('worker:remove-marker',  onRemoveMarker);
    socket.on('worker:clear-markers',  onClearMarkers);
    socket.on('worker:instruction',    onInstruction);
    socket.on('worker:laser-pointer',  onLaser);
    socket.on('worker:camera-sync',    onCamera);
    socket.on('worker:highlight-zone', onZone);
    socket.on('worker:clear-zones',    onClearZones);
    socket.on('worker:emergency-freeze', onEmergencyFreeze);
    socket.on('session:ended',         onSessionEnded);

    return () => {
      socket.off('worker:sync-state',     onSync);
      socket.off('worker:new-marker',     onMarker);
      socket.off('worker:remove-marker',  onRemoveMarker);
      socket.off('worker:clear-markers',  onClearMarkers);
      socket.off('worker:instruction',    onInstruction);
      socket.off('worker:laser-pointer',  onLaser);
      socket.off('worker:camera-sync',    onCamera);
      socket.off('worker:highlight-zone', onZone);
      socket.off('worker:clear-zones',    onClearZones);
      socket.off('worker:emergency-freeze', onEmergencyFreeze);
      socket.off('session:ended',         onSessionEnded);
    };
  }, [socket, addSdkTag]);

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

  const handleEndSession = useCallback(() => {
    setFeedbackOpen(true);
  }, []);

  const handleFeedbackAnswer = useCallback((resolved: boolean) => {
    socket?.emit('session:end', { resolved });
    setFeedbackOpen(false);
    router.push('/dashboard/worker');
  }, [socket, router]);

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
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardHat size={18} color="#1D4ED8" />
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#0F172A',
                }}
              >
                FieldSync Worker
              </div>
              <div
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#94A3B8',
                }}
              >
                On-Site
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ConnectionStatus
              socketConnected={isConnected}
              viewerReady={viewerReady}
              connectionCount={connectionCount}
              role="worker"
            />
            <EndSessionButton onEndSession={handleEndSession} />
          </div>
        </header>

        {/* Viewer (read-only) */}
        <div style={{ position: 'relative', height: '50vh', minHeight: '280px', background: '#000' }}>
          <MatterportViewer
            isReadOnly
            onSdkReady={(sdk) => {
              mpSdkRef.current = sdk;
              setViewerReady(true);
              setMarkers((prev) => [...prev]); // trigger sync useEffect
            }}
            syncedCamera={syncedCamera}
          >
            <WorkerZonesOverlay zones={zones} />
            <LaserPointerDot position={laser} />
          </MatterportViewer>
        </div>

        {/* Active Step Card — replaces InstructionBanner + ActivityFeed */}
        <div style={{ flex: 1, padding: '12px', background: '#F8FAFC' }}>
          <ActiveStepCard
            instruction={activeInstruction}
            onDone={handleStepDone}
            onClarification={handleClarification}
          />
        </div>
      </div>

      {/* Emergency overlay — full screen, blocks all interaction */}
      <EmergencyFreezeOverlay
        visible={emergencyActive}
        onAcknowledge={handleEmergencyAcknowledge}
      />

      {/* Session outcome modal */}
      <SessionFeedbackModal
        open={feedbackOpen}
        onAnswer={handleFeedbackAnswer}
      />
    </div>
  );
}
