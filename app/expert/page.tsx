'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Factory, Trash2 } from 'lucide-react';
import MatterportViewer from '@/components/MatterportViewer';
import ModeSelector, { type ExpertMode } from '@/components/expert/ModeSelector';
import MarkersList from '@/components/expert/MarkersList';
import InstructionInput from '@/components/expert/InstructionInput';
import MirrorViewToggle from '@/components/expert/MirrorViewToggle';
import LaserOverlay from '@/components/expert/LaserOverlay';
import HighlightZoneDrawer from '@/components/expert/HighlightZoneDrawer';
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

const STEM_SCALE = 0.3; // stem height in metres
const TAG_COLOR  = { r: 0.976, g: 0.451, b: 0.086 }; // orange (#f97316)

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ExpertPage() {
  const { socket, isConnected, connectionCount } = useSocket();

  const [mode, setMode] = useState<ExpertMode>('navigate');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zones, setZones] = useState<HighlightZone[]>([]);
  const [sentInstructions, setSentInstructions] = useState<Instruction[]>([]);
  const [mirrorView, setMirrorView] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [mpSdk, setMpSdk] = useState<MatterportSdk | null>(null);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  /**
   * Set when the user presses Spacebar in marker mode.
   * Drives the MarkerLabelDialog — the intersection is read from lastIntersectionRef
   * and finalised when the user submits the dialog.
   */
  const [pendingIntersection, setPendingIntersection] = useState<MatterportIntersection | null>(null);
  const [lastAction, setLastAction] = useState('');

  const viewerWrapperRef = useRef<HTMLDivElement>(null);
  const lastLaserEmitRef = useRef<number>(0);
  /**
   * Always-current Pointer.intersection from the SDK.
   * Updated by onIntersectionChange (no click overlay — events reach the iframe
   * so raycasting stays live as the cursor moves over the 3D model).
   */
  const lastIntersectionRef = useRef<MatterportIntersection | null>(null);
  const mpSdkRef = useRef<MatterportSdk | null>(null);

  // Keep refs in sync with state
  useEffect(() => { mpSdkRef.current = mpSdk; }, [mpSdk]);

  // ----- Intersection tracking -----
  const handleIntersectionChange = useCallback((i: MatterportIntersection | null) => {
    lastIntersectionRef.current = i;
  }, []);

  // ----- Spacebar → open label dialog for marker placement -----
  useEffect(() => {
    if (mode !== 'marker') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      // Prevent the SDK from consuming the space bar for its own navigation
      e.preventDefault();
      e.stopPropagation();
      const i = lastIntersectionRef.current;
      if (!i) return;
      // Skip if cursor is hovering on empty air (no model surface under cursor)
      if (i.object === 'intersectedobject.none') return;
      setPendingIntersection(i);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [mode]);

  // ----- Marker handling -----

  /**
   * Called when the user submits (or skips) the label dialog.
   * Places a native SDK Tag at the pending intersection's exact 3D position
   * with a stem oriented along the surface normal.
   */
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

  // ----- Instructions -----
  const sendInstruction = useCallback(
    (text: string) => {
      const ins: Instruction = { id: uid(), text, timestamp: Date.now() };
      setSentInstructions((prev) => [ins, ...prev].slice(0, 20));
      socket?.emit('expert:send-instruction', ins);
      setLastAction('Instruction sent');
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
      if (mirrorView) {
        socket?.emit('expert:camera-sync', camera);
      }
    },
    [mirrorView, socket],
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
      // Dismiss any pending label dialog when leaving marker mode
      if (mode === 'marker' && nextMode !== 'marker') {
        setPendingIntersection(null);
      }
      setMode(nextMode);
    },
    [mode, socket],
  );

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

  // Crosshair cursor style in marker mode
  const viewerWrapperStyle: React.CSSProperties = {
    cursor: mode === 'marker' ? 'crosshair' : 'default',
  };

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
          style={viewerWrapperStyle}
        >
          <MatterportViewer
            isReadOnly={false}
            onIntersectionChange={handleIntersectionChange}
            onCameraMove={handleCameraMove}
            onSdkReady={(sdk) => { setViewerReady(true); setMpSdk(sdk); }}
          >
            <HighlightZoneDrawer active={mode === 'highlight'} zones={zones} onComplete={addZone} />
            <LaserOverlay position={laser} />
            {/* Label dialog — centred in the viewer, triggered by Spacebar */}
            <MarkerLabelDialog
              key={pendingIntersection ? 'open' : 'closed'}
              position={pendingIntersection ? { x: 50, y: 40 } : null}
              onSubmit={handleLabelSubmit}
              onCancel={() => setPendingIntersection(null)}
            />
          </MatterportViewer>

          {/* Marker mode hint banner */}
          {mode === 'marker' && viewerReady && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(13, 27, 42, 0.9)',
                border: '1px solid #f97316',
                color: '#f97316',
                fontSize: '11px',
                padding: '6px 14px',
                fontFamily: 'monospace',
                letterSpacing: '0.06em',
                zIndex: 10,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Hover over a surface · Press <strong>Space</strong> to place marker
            </div>
          )}
        </div>

        {/* Control panel */}
        <aside className="flex w-[360px] flex-col gap-3 overflow-y-auto border-l border-zinc-800 bg-[#0a0f1e] p-3">
          <ModeSelector mode={mode} onChange={handleModeChange} />
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
