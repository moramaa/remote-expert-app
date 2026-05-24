'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HardHat } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import LaserPointerDot from '@/components/worker/LaserPointerDot';
import InstructionBanner from '@/components/worker/InstructionBanner';
import ActivityFeed, { type ActivityEntry } from '@/components/worker/ActivityFeed';
import WorkerMarkersOverlay from '@/components/worker/WorkerMarkersOverlay';
import WorkerZonesOverlay from '@/components/worker/WorkerZonesOverlay';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import { useSocket } from '@/hooks/useSocket';
import type { CameraState, HighlightZone, Instruction, LaserPointer, Marker } from '@/types/socket';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkerPage() {
  const { socket, isConnected, connectionCount } = useSocket();

  const [viewerReady, setViewerReady] = useState(false);
  const [mpSdk, setMpSdk] = useState<MatterportSdk | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [laser, setLaser] = useState<LaserPointer | null>(null);
  const [activeInstruction, setActiveInstruction] = useState<Instruction | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [syncedCamera, setSyncedCamera] = useState<CameraState | null>(null);

  const pushActivity = useCallback((kind: ActivityEntry['kind'], text: string) => {
    setActivity((prev) => [{ id: uid(), kind, text, timestamp: Date.now() }, ...prev].slice(0, 50));
  }, []);

  // Wire socket listeners
  useEffect(() => {
    if (!socket) return;

    const onMarker = (m: Marker) => {
      setMarkers((prev) => [...prev, m]);
      pushActivity('marker', `Marker placed${m.label ? `: "${m.label}"` : ''}`);
    };
    const onRemoveMarker = (id: string) => {
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      pushActivity('clear', 'Marker removed');
    };
    const onClearMarkers = () => {
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

    socket.on('worker:new-marker', onMarker);
    socket.on('worker:remove-marker', onRemoveMarker);
    socket.on('worker:clear-markers', onClearMarkers);
    socket.on('worker:instruction', onInstruction);
    socket.on('worker:laser-pointer', onLaser);
    socket.on('worker:camera-sync', onCamera);
    socket.on('worker:highlight-zone', onZone);
    socket.on('worker:clear-zones', onClearZones);

    return () => {
      socket.off('worker:new-marker', onMarker);
      socket.off('worker:remove-marker', onRemoveMarker);
      socket.off('worker:clear-markers', onClearMarkers);
      socket.off('worker:instruction', onInstruction);
      socket.off('worker:laser-pointer', onLaser);
      socket.off('worker:camera-sync', onCamera);
      socket.off('worker:highlight-zone', onZone);
      socket.off('worker:clear-zones', onClearZones);
    };
  }, [socket, pushActivity]);

  const viewerWrapperRef = useRef<HTMLDivElement>(null);

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
        <div ref={viewerWrapperRef} className="relative h-[50vh] min-h-[320px] bg-black">
          <MatterportViewer
            isReadOnly
            onSdkReady={(sdk) => { setViewerReady(true); setMpSdk(sdk); }}
            syncedCamera={syncedCamera}
          >
            <WorkerZonesOverlay zones={zones} />
            <WorkerMarkersOverlay markers={markers} mpSdk={mpSdk} containerRef={viewerWrapperRef} />
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
