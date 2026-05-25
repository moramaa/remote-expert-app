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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        borderTop: '1px solid #E2E8F0',
        background: '#F8FAFC',
        padding: '6px 20px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#64748B',
      }}
    >
      <div>
        Mode: <span style={{ color: '#1D4ED8', fontWeight: 600 }}>{MODE_LABELS[mode] ?? mode}</span>
      </div>
      <div>
        Markers: <span style={{ color: '#0F172A' }}>{markerCount}</span>
      </div>
      <div>
        Zones: <span style={{ color: '#0F172A' }}>{zoneCount}</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', textAlign: 'right', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Last action: <span style={{ color: '#0F172A' }}>{lastAction || '—'}</span>
      </div>
    </div>
  );
}
