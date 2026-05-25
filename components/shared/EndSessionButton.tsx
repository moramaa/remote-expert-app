'use client';

import { useState } from 'react';
import { PhoneOff } from 'lucide-react';

interface Props {
  onEndSession: () => void; // parent handles socket emit + navigation
}

/**
 * "End Session" button with an inline confirmation step.
 * The parent is responsible for emitting the socket event and showing
 * the feedback modal (SessionFeedbackModal).
 */
export default function EndSessionButton({ onEndSession }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
          End session?
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onEndSession();
          }}
          style={{
            background: '#DC2626',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Yes, End
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{
            background: 'transparent',
            color: '#64748B',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
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
        gap: '6px',
        background: 'transparent',
        color: '#64748B',
        border: '1px solid #E2E8F0',
        borderRadius: '6px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC2626';
        (e.currentTarget as HTMLButtonElement).style.color = '#DC2626';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
        (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
      }}
    >
      <PhoneOff size={14} />
      End Session
    </button>
  );
}
