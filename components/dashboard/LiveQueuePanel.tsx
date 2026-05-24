'use client';

import { Zap, Clock } from 'lucide-react';
import type { TicketSummary } from '@/types/socket';

interface Props {
  tickets: TicketSummary[];
  onAccept: (ticketId: string) => void;
  accepting: string | null; // ticketId currently being accepted
}

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function LiveQueuePanel({ tickets, onAccept, accepting }: Props) {
  return (
    <div
      style={{
        background: '#0d1b2a',
        border: '1px solid #27272a',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={14} color="#f97316" />
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          Live Queue
        </span>
        {tickets.length > 0 && (
          <span
            style={{
              background: '#f97316',
              color: '#000',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '8px',
            }}
          >
            {tickets.length}
          </span>
        )}
      </div>

      {tickets.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#475569', padding: '8px 0' }}>
          No active SOS requests — you&apos;re up to date.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tickets.map((t) => (
            <div
              key={t.ticketId}
              style={{
                border: '1px solid #f9731640',
                padding: '12px',
                background: '#f9731608',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>
                  {t.machineLabel}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {t.workerName} · {t.workerFactory}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px',
                    fontSize: '10px',
                    color: '#475569',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  <Clock size={10} />
                  {timeAgo(t.createdAt)}
                </div>
              </div>

              {/* Accept */}
              <button
                type="button"
                disabled={accepting !== null}
                onClick={() => onAccept(t.ticketId)}
                style={{
                  background: accepting === t.ticketId ? '#64748b' : '#f97316',
                  color: '#000',
                  border: 'none',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: accepting !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                }}
              >
                {accepting === t.ticketId ? 'JOINING…' : 'ACCEPT'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
