'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Factory, Trash2 } from 'lucide-react';
import MatterportViewer, { type MarkerClickPayload } from '@/components/MatterportViewer';
import ModeSelector, { type ExpertMode } from '@/components/expert/ModeSelector';
import MarkersList from '@/components/expert/MarkersList';
import InstructionInput from '@/components/expert/InstructionInput';
import MirrorViewToggle from '@/components/expert/MirrorViewToggle';
import LaserOverlay from '@/components/expert/LaserOverlay';
import HighlightZoneDrawer from '@/components/expert/HighlightZoneDrawer';
import MarkersOverlay from '@/components/expert/MarkersOverlay';
import MarkerLabelDialog from '@/components/expert/MarkerLabelDialog';
import ConnectionStatus from '@/components/shared/ConnectionStatus';
import StatusBar from '@/components/shared/StatusBar';
import { useSocket } from '@/hooks/useSocket';
import type {
  CameraState,
  HighlightZone,
  Instruction,
  Marker,
} from '@/types/socket';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PendingMarker {
  payload: MarkerClickPayload;
  screen: { x: number; y: number };
}

export default function ExpertPage() {
  const { socket, isConnected, connectionCount } = useSocket();

  const [mode, setMode] = useState<ExpertMode>('navigate');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [sentInstructions, setSentInstructions] = useState<Instruction[]>([]);
  const [mirrorView, setMirrorView] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [pendingMarker, setPendingMarker] = useState<PendingMarker | null>(null);
  const [lastAction, setLastAction] = useState('');

  const viewerWrapperRef = useRef<HTMLDivElement>(null);
  const lastLaserEmitRef = useRef<number>(0);

  // ----- Marker handling -----
  const handleMarkerClick = useCallback((payload: MarkerClickPayload) => {
    setPendingMarker({ payload, screen: payload.screen });
  }, []);

  const finalizeMarker = useCallback(
    (label: string) => {
      if (!pendingMarker) return;
      const { world, screen } = pendingMarker.payload;
      const marker: Marker = {
        id: uid(),
        x: world.x,
        y: world.y,
        z: world.z,
        screenX: screen.x,
        screenY: screen.y,
        label: label.trim() || undefined,
        timestamp: Date.now(),
      };
      setMarkers((prev) => [...prev, marker]);
      socket?.emit('expert:place-marker', marker);
      setLastAction(`Marker placed${label ? `: "${label}"` : ''}`);
      setPendingMarker(null);
    },
    [pendingMarker, socket]
  );

  const removeMarker = useCallback(
    (id: string) => {
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      socket?.emit('expert:remove-marker', id);
      setLastAction('Marker removed');
    },
    [socket]
  );

  const clearMarkers = useCallback(() => {
    setMarkers([]);
    socket?.emit('expert:clear-markers');
    setLastAction('Markers cleared');
  }, [socket]);

  // ----- Instructions -----
  const sendInstruction = useCallback(
    (text: string) => {
      const ins: Instruction = { id: uid(), text, timestamp: Date.now() };
      setSentInstructions((prev) => [ins, ...prev].slice(0, 20));
      socket?.emit('expert:send-instruction', ins);
      setLastAction(`Instruction sent`);
    },
    [socket]
  );

  // ----- Zones -----
  const addZone = useCallback(
    (partial: Omit<HighlightZone, 'id' | 'timestamp'>) => {
      const zone: HighlightZone = { ...partial, id: uid(), timestamp: Date.now() };
      setZones((prev) => [...prev, zone]);
      socket?.emit('expert:highlight-zone', zone);
      setLastAction('Highlight zone added');
    },
    [socket]
  );

  const clearZones = useCallback(() => {
    setZones([]);
    socket?.emit('expert:clear-zones');
    setLastAction('Zones cleared');
  }, [socket]);

  // ----- Camera sync -----
  const handleCameraMove = useCallback(
    (camera: CameraState) => {
      if (mirrorView) {
        socket?.emit('expert:camera-sync', camera);
      }
    },
    [mirrorView, socket]
  );

  // ----- Laser pointer tracking -----
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
    [mode, socket]
  );

  const handleViewerMouseLeave = useCallback(() => {
    if (mode !== 'laser') return;
    setLaser(null);
    socket?.emit('expert:laser-pointer', null);
  }, [mode, socket]);

  // Clear laser when leaving laser mode
  useEffect(() => {
    if (mode !== 'laser' && laser) {
      setLaser(null);
      socket?.emit('expert:laser-pointer', null);
    }
  }, [mode, laser, socket]);

  // ----- Clear All -----
  const clearAll = useCallback(() => {
    if (!window.confirm('Clear all markers, zones, and instructions?')) return;
    setMarkers([]);
    setZones([]);
    setSentInstructions([]);
    socket?.emit('expert:clear-markers');
    socket?.emit('expert:clear-zones');
    setLastAction('Cleared everything');
  }, [socket]);

  const captureClicks = mode === 'marker';

  const headerInfo = useMemo(() => ({ markerCount: markers.length, zoneCount: zones.length }), [markers, zones]);

  return (
    <div className="flex h-screen flex-col bg-[#0a0f1e] text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0d1b2a] px-6 py-3">
        <div className="flex items-center gap-3">
          <Factory size={22} className="text-orange-500" />
          <div>
            <div className="text-sm font-semibold tracking-wide">FieldSync Expert Console</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              Space: RXLkh8vriYF
            </div>
          </div>
        </div>
        <ConnectionStatus
          socketConnected={isConnected}
          viewerReady={viewerReady}
          connectionCount={connectionCount}
          role="expert"
        />
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewer area */}
        <div
          ref={viewerWrapperRef}
          onMouseMove={handleViewerMouseMove}
          onMouseLeave={handleViewerMouseLeave}
          className="relative flex-1 bg-black"
        >
          <MatterportViewer
            isReadOnly={false}
            captureClicks={captureClicks}
            onMarkerClick={handleMarkerClick}
            onCameraMove={handleCameraMove}
            onSdkReady={() => setViewerReady(true)}
          >
            <HighlightZoneDrawer active={mode === 'highlight'} zones={zones} onComplete={addZone} />
            <MarkersOverlay markers={markers} />
            <LaserOverlay position={laser} />
            <MarkerLabelDialog
              position={pendingMarker?.screen ?? null}
              onSubmit={finalizeMarker}
              onCancel={() => setPendingMarker(null)}
            />
          </MatterportViewer>
        </div>

        {/* Control panel */}
        <aside className="flex w-[360px] flex-col gap-3 overflow-y-auto border-l border-zinc-800 bg-[#0a0f1e] p-3">
          <ModeSelector mode={mode} onChange={setMode} />
          <MarkersList markers={markers} onRemove={removeMarker} onClearAll={clearMarkers} />
          <InstructionInput recent={sentInstructions} onSend={sendInstruction} />
          <MirrorViewToggle enabled={mirrorView} onChange={setMirrorView} />

          {/* Clear controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={clearMarkers}
              className="flex items-center justify-center gap-1 border border-zinc-800 px-2 py-2 text-xs text-zinc-400 hover:border-orange-500 hover:text-orange-500"
            >
              <Trash2 size={12} /> Markers
            </button>
            <button
              type="button"
              onClick={clearZones}
              className="flex items-center justify-center gap-1 border border-zinc-800 px-2 py-2 text-xs text-zinc-400 hover:border-orange-500 hover:text-orange-500"
            >
              <Trash2 size={12} /> Zones
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center justify-center gap-1 border border-orange-500/50 px-2 py-2 text-xs text-orange-500 hover:bg-orange-500 hover:text-black"
            >
              <Trash2 size={12} /> All
            </button>
          </div>
        </aside>
      </div>

      <StatusBar
        mode={mode}
        markerCount={headerInfo.markerCount}
        zoneCount={headerInfo.zoneCount}
        lastAction={lastAction}
      />
    </div>
  );
}
