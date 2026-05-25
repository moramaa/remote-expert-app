'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, HelpCircle } from 'lucide-react';
import type { Instruction } from '@/types/socket';

interface Props {
  instruction: Instruction | null;
  onDone: (instructionId: string) => void;
  onClarification: (instructionId: string) => void;
}

/**
 * The primary worker action card.
 * Displays the current instruction from the expert with two glove-friendly buttons.
 * Replaces the old InstructionBanner + ActivityFeed combination.
 */
export default function ActiveStepCard({ instruction, onDone, onClarification }: Props) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '200px',
      }}
    >
      <AnimatePresence mode="wait">
        {instruction ? (
          <motion.div
            key={instruction.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {/* Step badge */}
            {instruction.stepNumber != null && instruction.totalSteps != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: '#DBEAFE',
                    color: '#1D4ED8',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '99px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Step {instruction.stepNumber} of {instruction.totalSteps}
                </span>
              </div>
            )}

            {/* Instruction header */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#1D4ED8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Current Instruction
            </div>

            {/* Instruction text */}
            <p
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#0F172A',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              {instruction.text}
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => onDone(instruction.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                <CheckCircle size={20} />
                ✓ Mark as Done
              </button>

              <button
                type="button"
                onClick={() => onClarification(instruction.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#F1F5F9',
                  color: '#1D4ED8',
                  border: '2px solid #DBEAFE',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                <HelpCircle size={20} />
                ? Need Clarification
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#94A3B8',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px' }}>📡</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Waiting for expert guidance…</div>
            <div style={{ fontSize: '12px', color: '#CBD5E1' }}>
              The expert will send instructions shortly
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
