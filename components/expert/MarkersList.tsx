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
    <div className="flex flex-col border border-zinc-800 bg-[#0d1b2a]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="text-xs uppercase tracking-widest text-zinc-500">
          Markers <span className="ml-1 text-zinc-300">({markers.length})</span>
        </div>
        {markers.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-orange-500"
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {markers.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-zinc-600">
            No markers placed. Switch to Marker mode, hover over a surface, then press Space.
          </div>
        ) : (
          markers.map((m, idx) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 border-b border-zinc-900 px-3 py-2 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm text-zinc-100">
                  {m.label || `Marker #${idx + 1}`}
                </div>
                <div className="font-mono text-[10px] text-zinc-500">
                  {formatTime(m.timestamp)} · x:{m.x.toFixed(2)} y:{m.y.toFixed(2)} z:{m.z.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(m.id)}
                className="text-zinc-500 hover:text-orange-500"
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
