'use client';

interface Props {
  socketConnected: boolean;
  viewerReady: boolean;
  connectionCount: number;
  role: 'expert' | 'worker';
}

export default function ConnectionStatus({ socketConnected, viewerReady, connectionCount, role }: Props) {
  let color = '#DC2626'; // red — disconnected
  let label = 'Disconnected';
  if (socketConnected && viewerReady) {
    color = '#16A34A';
    label = 'Live';
  } else if (socketConnected || viewerReady) {
    color = '#D97706';
    label = socketConnected ? 'Loading viewer...' : 'Reconnecting...';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        <span style={{ color: '#0F172A', fontSize: '12px', fontWeight: 500 }}>{label}</span>
      </span>
      {role === 'expert' && (
        <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>
          {connectionCount} online
        </span>
      )}
    </div>
  );
}
