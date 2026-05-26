'use client';

import { useEffect, useState } from 'react';

interface Props {
  driver:         'expert' | 'worker' | null;
  controlPending: boolean;
  controlDenied:  boolean;
  onRequest:      () => void;
}

export default function WorkerControlRequest({
  driver,
  controlPending,
  controlDenied,
  onRequest,
}: Props) {
  // Show "declined" text briefly then hide it
  const [showDenied, setShowDenied] = useState(false);

  useEffect(() => {
    if (!controlDenied) return;
    setShowDenied(true);
    const t = setTimeout(() => setShowDenied(false), 3000);
    return () => clearTimeout(t);
  }, [controlDenied]);

  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#64748B',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        Camera Control
      </div>

      {/* Worker is currently driving */}
      {driver === 'worker' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: '#EDE9FE',
            border: '1px solid #C4B5FD',
            fontSize: '12px',
            fontWeight: 600,
            color: '#5B21B6',
          }}
        >
          🔵 You are driving
        </div>
      )}

      {/* Expert driving or nobody driving — show request button */}
      {driver !== 'worker' && (
        <>
          <button
            type="button"
            onClick={onRequest}
            disabled={controlPending}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: controlPending ? '#E2E8F0' : '#7C3AED',
              background:  controlPending ? '#F8FAFC'  : '#EDE9FE',
              color:       controlPending ? '#94A3B8'  : '#5B21B6',
              fontSize: '12px',
              fontWeight: 700,
              cursor: controlPending ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {controlPending ? '⏳ Waiting for approval…' : 'Request Control'}
          </button>

          {showDenied && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#DC2626',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              ✕ Request declined by instructor
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '6px', textAlign: 'center' }}>
        {driver === 'worker'
          ? 'Instructor can reclaim control at any time'
          : 'Instructor decides who drives the view'}
      </div>
    </div>
  );
}
