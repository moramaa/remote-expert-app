'use client';

import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onAnswer: (resolved: boolean) => void;
}

/**
 * Full-screen feedback modal shown to both expert and worker when a session ends.
 * Cannot be dismissed without answering — blocks all underlying interactions.
 */
export default function SessionFeedbackModal({ open, onAnswer }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '40px 32px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>📋</div>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 8px',
          }}
        >
          Session Ended
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: '#64748B',
            margin: '0 0 32px',
            lineHeight: 1.5,
          }}
        >
          Was the issue resolved successfully?
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <CheckCircle size={18} />
            Yes — Resolved
          </button>

          <button
            type="button"
            onClick={() => onAnswer(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <XCircle size={18} />
            No — Not Resolved
          </button>
        </div>
      </div>
    </div>
  );
}
