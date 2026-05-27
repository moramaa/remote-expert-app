'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  onFreeze: () => void;
  acknowledged: boolean; // true after worker confirms stop
}

export default function EmergencyFreezeButton({ onFreeze, acknowledged }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (acknowledged) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#DCFCE7',
          border: '1px solid #16A34A',
          borderRadius: '8px',
          padding: '10px 16px',
          color: '#16A34A',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <CheckCircle size={16} />
        Worker confirmed machine stop ✓
      </div>
    );
  }

  if (confirming) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: '#FEE2E2',
          border: '1px solid #DC2626',
          borderRadius: '7px',
          padding: '8px 10px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>
          ⚠️ This will lock the worker&apos;s screen immediately.
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => { setConfirming(false); onFreeze(); }}
            style={{
              flex: 1,
              background: '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Yes — Freeze Now
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            style={{
              background: 'transparent',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '7px 10px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        width: '100%',
        background: '#DC2626',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '7px',
        padding: '9px 14px',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        boxShadow: '0 2px 6px rgba(220,38,38,0.30)',
      }}
    >
      <AlertTriangle size={15} />
      Emergency Freeze
    </button>
  );
}
