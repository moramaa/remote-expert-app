'use client';

import { MapPin, Zap, Square, Move } from 'lucide-react';

export type ExpertMode = 'marker' | 'laser' | 'highlight' | 'navigate';

interface Props {
  mode: ExpertMode;
  onChange: (mode: ExpertMode) => void;
}

const MODES: ReadonlyArray<{ id: ExpertMode; label: string; Icon: typeof MapPin }> = [
  { id: 'marker', label: 'Marker', Icon: MapPin },
  { id: 'laser', label: 'Laser', Icon: Zap },
  { id: 'highlight', label: 'Highlight', Icon: Square },
  { id: 'navigate', label: 'Navigate', Icon: Move },
];

export default function ModeSelector({ mode, onChange }: Props) {
  return (
    <div className="border border-zinc-800 bg-[#0d1b2a] p-3">
      <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Mode</div>
      <div className="grid grid-cols-4 gap-2">
        {MODES.map(({ id, label, Icon }) => {
          const active = id === mode;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="flex flex-col items-center justify-center gap-1 border px-2 py-3 text-xs transition-colors"
              style={{
                borderColor: active ? '#f97316' : '#27272a',
                background: active ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                color: active ? '#f97316' : '#94a3b8',
                boxShadow: active ? '0 0 12px rgba(249, 115, 22, 0.4)' : 'none',
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
