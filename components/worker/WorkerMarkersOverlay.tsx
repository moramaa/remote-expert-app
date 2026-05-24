'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Marker } from '@/types/socket';
import { useMarkerProjection } from '@/hooks/useMarkerProjection';

interface Props {
  markers: Marker[];
  mpSdk: MatterportSdk | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function WorkerMarkersOverlay({ markers, mpSdk, containerRef }: Props) {
  const projected = useMarkerProjection(mpSdk, markers, containerRef);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      <AnimatePresence>
        {markers.map((m, idx) => {
          const pos = projected[m.id];
          if (!pos?.visible) return null;
          return (
            <motion.div
              key={m.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    background: '#f97316',
                    color: '#000',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.label || `#${idx + 1}`}
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#f97316',
                    border: '2px solid #fff',
                    boxShadow: '0 0 18px 5px rgba(249, 115, 22, 0.8)',
                    animation: 'wm-pulse 3s ease-out',
                  }}
                />
              </div>
              <style jsx>{`
                @keyframes wm-pulse {
                  0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.9); }
                  100% { box-shadow: 0 0 0 26px rgba(249, 115, 22, 0); }
                }
              `}</style>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
