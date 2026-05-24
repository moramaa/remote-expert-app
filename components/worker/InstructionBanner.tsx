'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Instruction } from '@/types/socket';

interface Props {
  instruction: Instruction | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function InstructionBanner({ instruction, onDismiss, autoDismissMs = 8000 }: Props) {
  useEffect(() => {
    if (!instruction) return;
    const t = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [instruction, onDismiss, autoDismissMs]);

  return (
    <AnimatePresence>
      {instruction && (
        <motion.div
          key={instruction.id}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 25 }}
          style={{
            background: '#f97316',
            color: '#0a0f1e',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 -4px 24px rgba(249, 115, 22, 0.4)',
          }}
        >
          <div style={{ flex: 1, fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
            {instruction.text}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0a0f1e',
              cursor: 'pointer',
              padding: '2px',
            }}
            aria-label="Dismiss instruction"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
