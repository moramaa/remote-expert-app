'use client';

import { MapPin, Zap, Square, Move } from 'lucide-react';
import type { ExpertMode } from './ModeSelector';

interface Props {
  mode: ExpertMode;
  onChange: (mode: ExpertMode) => void;
}

const MODES: ReadonlyArray<{
  id: ExpertMode;
  Icon: typeof MapPin;
  label: string;
  activeColor: string;
  activeShadow: string;
}> = [
  { id: 'navigate',  Icon: Move,   label: 'Navigate',  activeColor: '#1D4ED8', activeShadow: 'rgba(29,78,216,0.4)'  },
  { id: 'marker',    Icon: MapPin,  label: 'Marker',    activeColor: '#D97706', activeShadow: 'rgba(217,119,6,0.4)'  },
  { id: 'laser',     Icon: Zap,    label: 'Laser',     activeColor: '#DC2626', activeShadow: 'rgba(220,38,38,0.4)'  },
  { id: 'highlight', Icon: Square, label: 'Highlight', activeColor: '#7C3AED', activeShadow: 'rgba(124,58,237,0.4)' },
];

/**
 * Floating vertical mode-selector pill overlaid on the top-right of the
 * Matterport viewer. Icon-only buttons with tooltips; avoids covering any
 * Matterport SDK controls (which live at the bottom).
 */
export default function FloatingModeBar({ mode, onChange }: Props) {
  return (
    <>
      <style>{`
        .fmb-btn:hover { background: rgba(100,116,139,0.12) !important; }
      `}</style>
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '14px',
          padding: '5px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      >
        {MODES.map(({ id, Icon, label, activeColor, activeShadow }) => {
          const active = id === mode;
          return (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => onChange(id)}
              className="fmb-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: active ? activeColor : 'transparent',
                color: active ? '#FFFFFF' : '#475569',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                boxShadow: active ? `0 2px 10px ${activeShadow}` : 'none',
              }}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>
    </>
  );
}
