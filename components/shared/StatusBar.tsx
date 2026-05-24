'use client';

interface Props {
  mode: string;
  markerCount: number;
  zoneCount: number;
  lastAction: string;
}

const MODE_LABELS: Record<string, string> = {
  marker: 'Marker',
  laser: 'Laser Pointer',
  highlight: 'Highlight',
  navigate: 'Navigate',
};

export default function StatusBar({ mode, markerCount, zoneCount, lastAction }: Props) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-zinc-800 bg-[#0d1b2a] px-6 py-2 font-mono text-xs text-zinc-400">
      <div>
        Mode: <span className="text-orange-500">{MODE_LABELS[mode] ?? mode}</span>
      </div>
      <div>
        Markers: <span className="text-zinc-200">{markerCount}</span>
      </div>
      <div>
        Zones: <span className="text-zinc-200">{zoneCount}</span>
      </div>
      <div className="flex-1 truncate text-right">
        Last action: <span className="text-zinc-200">{lastAction || '—'}</span>
      </div>
    </div>
  );
}
