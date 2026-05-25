'use client';

import { useRef, useState } from 'react';
import type { HighlightZone } from '@/types/socket';

interface Props {
  active: boolean;
  zones: HighlightZone[];
  onComplete: (zone: Omit<HighlightZone, 'id' | 'timestamp'>) => void;
}

interface Drag {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function HighlightZoneDrawer({ active, zones, onComplete }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const pctFromEvent = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    const p = pctFromEvent(e);
    if (!p) return;
    setDrag({ startX: p.x, startY: p.y, currentX: p.x, currentY: p.y });
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!drag) return;
    const p = pctFromEvent(e);
    if (!p) return;
    setDrag({ ...drag, currentX: p.x, currentY: p.y });
  };

  const handleUp = (): void => {
    if (!drag) return;
    const x = Math.min(drag.startX, drag.currentX);
    const y = Math.min(drag.startY, drag.currentY);
    const width = Math.abs(drag.currentX - drag.startX);
    const height = Math.abs(drag.currentY - drag.startY);
    setDrag(null);
    if (width < 1 || height < 1) return;
    onComplete({ x, y, width, height });
  };

  return (
    <>
      {/* Drawing surface — only when active */}
      {active && (
        <div
          ref={layerRef}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={() => setDrag(null)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 8,
            cursor: 'crosshair',
            background: 'transparent',
          }}
        >
          {drag && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(drag.startX, drag.currentX)}%`,
                top: `${Math.min(drag.startY, drag.currentY)}%`,
                width: `${Math.abs(drag.currentX - drag.startX)}%`,
                height: `${Math.abs(drag.currentY - drag.startY)}%`,
                border: '2px solid #1D4ED8',
                background: 'rgba(29, 78, 216, 0.15)',
                boxShadow: '0 0 12px rgba(29, 78, 216, 0.4)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      )}

      {/* Placed zones layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none' }}>
        {zones.map((z) => (
          <div
            key={z.id}
            style={{
              position: 'absolute',
              left: `${z.x}%`,
              top: `${z.y}%`,
              width: `${z.width}%`,
              height: `${z.height}%`,
              border: '2px solid #1D4ED8',
              background: 'rgba(29, 78, 216, 0.1)',
              boxShadow: '0 0 10px rgba(29, 78, 216, 0.3)',
            }}
          >
            {z.label && (
              <span
                style={{
                  position: 'absolute',
                  top: '-22px',
                  left: 0,
                  background: '#1D4ED8',
                  color: '#FFFFFF',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  borderRadius: '3px',
                }}
              >
                {z.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
