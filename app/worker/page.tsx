'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HardHat } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import LaserPointerDot from '@/components/worker/LaserPointerDot';
import InstructionBanner from '@/components/worker/InstructionBanner';
import ActivityFeed, { type ActivityEntry } from '@/components/worker/ActivityFeed';
import WorkerZonesOverlay from '@/components/worker/WorkerZonesOverlay';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import { useSocket } from '@/hooks/useSocket';
import type { CameraState, HighlightZone, Instruction, LaserPointer, Marker, SyncState } from '@/types/socket';

const TAG_COLOR = { r: 0.976, g: 0.451, b: 0.086 }; // orange (#f97316)
const STEM_SCALE = 0.3;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkerPage() {
  const { socket, isConnected, connectionCount } = useSocket();

  const [viewerReady, setViewerReady] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [laser, setLaser] = useState<LaserPointer | null>(null);
  const [activeInstruction, setActiveInstruction] = useState<Instruction | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [syncedCamera, setSyncedCamera] = useState<CameraState | null>(null);

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

  const pushActivity = useCallback((kind: ActivityEntry['kind'], text: string) => {
    setActivity((prev) => [{ id: uid(), kind, text, timestamp: Date.now() }, ...prev].slice(0, 50));
  }, []);

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
      pushActivity('marker', `Marker placed${m.label ? `: "${m.label}"` : ''}`);
    };

    const onRemoveMarker = async (id: string) => {
      const sdkId = tagIdMapRef.current.get(id) ?? id;
      try { await mpSdkRef.current?.Tag.remove(sdkId); } catch { /* ignore */ }
      tagIdMapRef.current.delete(id);
      syncedIdsRef.current.delete(id);
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      pushActivity('clear', 'Marker removed');
    };

    const onClearMarkers = async () => {
      const sdkIds = [...tagIdMapRef.current.values()];
      if (sdkIds.length > 0) {
        try { await mpSdkRef.current?.Tag.remove(...sdkIds); } catch { /* ignore */ }
      }
      tagIdMapRef.current.clear();
      syncedIdsRef.current.clear();
      setMarkers([]);
      pushActivity('clear', 'Markers cleared');
    };

    const onInstruction = (ins: Instruction) => {
      setActiveInstruction(ins);
      pushActivity('instruction', `Instruction: "${ins.text}"`);
    };
    const onLaser = (pos: LaserPointer | null) => {
      setLaser(pos);
    };
    const onCamera = (cam: CameraState) => {
      setSyncedCamera(cam);
    };
    const onZone = (z: HighlightZone) => {
      setZones((prev) => [...prev, z]);
      pushActivity('zone', `Highlight zone${z.label ? `: "${z.label}"` : ' added'}`);
    };
    const onClearZones = () => {
      setZones([]);
      pushActivity('clear', 'Zones cleared');
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
      pushActivity('marker', `Synced: ${state.markers.length} marker(s), ${state.zones.length} zone(s)`);
      // Tags are added by the markers-sync useEffect after state update
    };

    socket.on('worker:sync-state',    onSync);
    socket.on('worker:new-marker',    onMarker);
    socket.on('worker:remove-marker', onRemoveMarker);
    socket.on('worker:clear-markers', onClearMarkers);
    socket.on('worker:instruction',   onInstruction);
    socket.on('worker:laser-pointer', onLaser);
    socket.on('worker:camera-sync',   onCamera);
    socket.on('worker:highlight-zone', onZone);
    socket.on('worker:clear-zones',   onClearZones);

    return () => {
      socket.off('worker:sync-state',    onSync);
      socket.off('worker:new-marker',    onMarker);
      socket.off('worker:remove-marker', onRemoveMarker);
      socket.off('worker:clear-markers', onClearMarkers);
      socket.off('worker:instruction',   onInstruction);
      socket.off('worker:laser-pointer', onLaser);
      socket.off('worker:camera-sync',   onCamera);
      socket.off('worker:highlight-zone', onZone);
      socket.off('worker:clear-zones',   onClearZones);
    };
  }, [socket, pushActivity, addSdkTag]);

  return (
    <div className="flex min-h-screen items-stretch justify-center bg-[#020617] py-4">
      <div className="flex w-full max-w-[430px] flex-col border border-zinc-800 bg-[#0a0f1e] text-zinc-100 shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0d1b2a] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <HardHat size={18} className="text-orange-500" />
            <div>
              <div className="text-xs font-semibold tracking-wide">FieldSync Worker</div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">
                On-Site
              </div>
            </div>
          </div>
          <ConnectionStatus
            socketConnected={isConnected}
            viewerReady={viewerReady}
            connectionCount={connectionCount}
            role="worker"
          />
        </header>

        {/* Viewer (read-only, ~50% of vertical height) */}
        <div className="relative h-[50vh] min-h-[320px] bg-black">
          <MatterportViewer
            isReadOnly
            onSdkReady={(sdk) => {
              mpSdkRef.current = sdk;
              setViewerReady(true);
              // Any markers that arrived before the SDK was ready are picked
              // up by the markers-sync useEffect (triggered by state update below).
              setMarkers((prev) => [...prev]); // shallow-copy to trigger useEffect
            }}
            syncedCamera={syncedCamera}
          >
            <WorkerZonesOverlay zones={zones} />
            <LaserPointerDot position={laser} />
          </MatterportViewer>
        </div>

        {/* Instruction Banner */}
        <InstructionBanner
          instruction={activeInstruction}
          onDismiss={() => setActiveInstruction(null)}
        />

        {/* Activity Feed */}
        <ActivityFeed entries={activity} />
      </div>
    </div>
  );
}
