'use client';

import { AlertTriangle, X } from 'lucide-react';

interface Props {
  machineName: string;
  ticketId: string;
  onCancel: () => void;
}

export default function SearchingOverlay({ machineName, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        zIndex: 200,
      }}
    >
      {/* Animated pulse ring */}
      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid #f97316',
            animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '2px solid #f97316',
            animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) 0.5s infinite',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={24} color="#f97316" />
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#f97316',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.05em',
          }}
        >
          SOS SENT
        </div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
          Searching for an expert certified in
        </div>
        <div style={{ fontSize: '15px', color: '#f1f5f9', fontWeight: 600, marginTop: '4px' }}>
          {machineName}
        </div>
        <div
          style={{
            marginTop: '12px',
            fontSize: '11px',
            color: '#475569',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          You'll be connected automatically when an expert accepts…
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: '1px solid #27272a',
          color: '#64748b',
          padding: '8px 16px',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        <X size={12} />
        Cancel Request
      </button>
    </div>
  );
}
