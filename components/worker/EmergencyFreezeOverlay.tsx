'use client';

import { AlertTriangle } from 'lucide-react';

interface Props {
  visible: boolean;
  onAcknowledge: () => void;
}

/**
 * Full-screen emergency overlay triggered by the expert.
 * Blocks all other UI interactions until the worker acknowledges.
 */
export default function EmergencyFreezeOverlay({ visible, onAcknowledge }: Props) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#DC2626',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        textAlign: 'center',
        pointerEvents: 'all',
      }}
    >
      {/* Flashing border effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '8px solid rgba(255,255,255,0.3)',
          animation: 'emergency-flash 0.8s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}
      />

      <AlertTriangle
        size={96}
        color="#FFFFFF"
        strokeWidth={2.5}
        style={{ marginBottom: '24px', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.5))' }}
      />

      <h1
        style={{
          fontSize: '36px',
          fontWeight: 900,
          color: '#FFFFFF',
          margin: '0 0 12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        EMERGENCY STOP
      </h1>

      <p
        style={{
          fontSize: '17px',
          color: 'rgba(255,255,255,0.9)',
          margin: '0 0 40px',
          maxWidth: '340px',
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        An expert has triggered an emergency stop.
        <br />
        <strong>Do not operate the machine.</strong>
      </p>

      <button
        type="button"
        onClick={onAcknowledge}
        style={{
          background: '#FFFFFF',
          color: '#DC2626',
          border: 'none',
          borderRadius: '12px',
          padding: '20px 40px',
          fontSize: '18px',
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          textTransform: 'uppercase',
        }}
      >
        ✓ I Have Stopped — Acknowledged
      </button>

      <style jsx>{`
        @keyframes emergency-flash {
          from { opacity: 0.3; }
          to   { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
