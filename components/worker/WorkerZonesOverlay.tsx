'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { HighlightZone } from '@/types/socket';

interface Props {
  zones: HighlightZone[];
}

export default function WorkerZonesOverlay({ zones }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      <AnimatePresence>
        {zones.map((z) => (
          <motion.div
            key={z.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              left: `${z.x}%`,
              top: `${z.y}%`,
              width: `${z.width}%`,
              height: `${z.height}%`,
              border: '2px solid #f97316',
              background: 'rgba(249, 115, 22, 0.15)',
              boxShadow: '0 0 12px rgba(249, 115, 22, 0.45)',
            }}
          >
            {z.label && (
              <span
                style={{
                  position: 'absolute',
                  top: '-22px',
                  left: 0,
                  background: '#f97316',
                  color: '#000',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                }}
              >
                {z.label}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
