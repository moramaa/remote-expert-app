'use client';

import { X, Trash2 } from 'lucide-react';
import type { Marker } from '@/types/socket';

interface Props {
  markers: Marker[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function MarkersList({ markers, onRemove, onClearAll }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          padding: '8px 12px',
          background: '#F8FAFC',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#64748B',
            fontWeight: 700,
          }}
        >
          Markers{' '}
          <span style={{ color: '#0F172A' }}>({markers.length})</span>
        </div>
        {markers.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: '#64748B',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>
      <div style={{ maxHeight: '192px', overflowY: 'auto' }}>
        {markers.length === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              textAlign: 'center',
              fontSize: '11px',
              color: '#94A3B8',
            }}
          >
            No markers placed. Switch to Marker mode, hover over a surface, then press Space.
          </div>
        ) : (
          markers.map((m, idx) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                borderBottom: '1px solid #F1F5F9',
                padding: '8px 12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#0F172A',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.label || `Marker #${idx + 1}`}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8' }}>
                  {formatTime(m.timestamp)} · x:{m.x.toFixed(2)} y:{m.y.toFixed(2)} z:{m.z.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(m.id)}
                style={{
                  color: '#94A3B8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
                aria-label="Remove marker"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
