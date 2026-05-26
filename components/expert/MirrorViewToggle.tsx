'use client';

import type { CSSProperties } from 'react';

interface Props {
  driver: 'expert' | 'worker' | null;
  controlRequested: boolean;
  onExpertDrive:    () => void;   // expert takes / keeps control
  onWorkerDrive:    () => void;   // expert grants control to worker
  onStopMirror:     () => void;   // turn mirror off entirely
  onGrant:          () => void;   // approve pending worker request
  onDeny:           () => void;   // deny pending worker request
}

const SEG_BASE: CSSProperties = {
  flex: 1,
  padding: '6px 0',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
  whiteSpace: 'nowrap',
};

export default function MirrorViewToggle({
  driver,
  controlRequested,
  onExpertDrive,
  onWorkerDrive,
  onStopMirror,
  onGrant,
  onDeny,
}: Props) {
  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#64748B',
            fontWeight: 700,
          }}
        >
          Mirror View
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
          {driver === 'expert' && 'Worker follows your camera'}
          {driver === 'worker' && 'You follow the worker\'s camera'}
          {driver === null    && 'Both navigate freely'}
        </div>
      </div>

      {/* Segmented control */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '4px',
          padding: '0 10px 10px',
        }}
      >
        <button
          type="button"
          onClick={onExpertDrive}
          style={{
            ...SEG_BASE,
            background: driver === 'expert' ? '#1D4ED8' : '#F1F5F9',
            color:      driver === 'expert' ? '#FFFFFF'  : '#64748B',
          }}
        >
          My Control
        </button>
        <button
          type="button"
          onClick={onWorkerDrive}
          style={{
            ...SEG_BASE,
            background: driver === 'worker' ? '#7C3AED' : '#F1F5F9',
            color:      driver === 'worker' ? '#FFFFFF'  : '#64748B',
          }}
        >
          Worker
        </button>
        <button
          type="button"
          onClick={onStopMirror}
          style={{
            ...SEG_BASE,
            background: driver === null ? '#0F172A' : '#F1F5F9',
            color:      driver === null ? '#FFFFFF'  : '#64748B',
          }}
        >
          Off
        </button>
      </div>

      {/* Control-request banner */}
      {controlRequested && (
        <div
          style={{
            borderTop: '1px solid #FCD34D',
            background: '#FFFBEB',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#92400E', flex: 1, fontWeight: 600 }}>
            ⚠ Worker requested control
          </span>
          <button
            type="button"
            onClick={onGrant}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '5px',
              border: 'none',
              background: '#7C3AED',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Grant
          </button>
          <button
            type="button"
            onClick={onDeny}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
