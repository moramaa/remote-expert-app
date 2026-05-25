'use client';

import { MapPin, Zap, Square, Move } from 'lucide-react';

export type ExpertMode = 'marker' | 'laser' | 'highlight' | 'navigate';

interface Props {
  mode: ExpertMode;
  onChange: (mode: ExpertMode) => void;
}

const MODES: ReadonlyArray<{ id: ExpertMode; label: string; Icon: typeof MapPin }> = [
  { id: 'marker',    label: 'Marker',    Icon: MapPin },
  { id: 'laser',     label: 'Laser',     Icon: Zap },
  { id: 'highlight', label: 'Highlight', Icon: Square },
  { id: 'navigate',  label: 'Navigate',  Icon: Move },
];

export default function ModeSelector({ mode, onChange }: Props) {
  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '10px 12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          marginBottom: '8px',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#64748B',
          fontWeight: 700,
        }}
      >
        Mode
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {MODES.map(({ id, label, Icon }) => {
          const active = id === mode;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`,
                borderRadius: '6px',
                padding: '8px 4px',
                fontSize: '10px',
                background: active ? '#DBEAFE' : '#F8FAFC',
                color: active ? '#1D4ED8' : '#64748B',
                boxShadow: active ? '0 0 0 2px #BFDBFE' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontWeight: active ? 700 : 400,
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
