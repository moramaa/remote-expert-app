'use client';

interface Props {
  socketConnected: boolean;
  viewerReady: boolean;
  connectionCount: number;
  role: 'expert' | 'worker';
}

export default function ConnectionStatus({ socketConnected, viewerReady, connectionCount, role }: Props) {
  let color = '#ef4444'; // red
  let label = 'Disconnected';
  if (socketConnected && viewerReady) {
    color = '#22c55e';
    label = 'Live';
  } else if (socketConnected || viewerReady) {
    color = '#eab308';
    label = socketConnected ? 'Loading viewer...' : 'Reconnecting...';
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="relative inline-flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-zinc-200">{label}</span>
      </span>
      {role === 'expert' && (
        <span className="text-zinc-400 font-mono text-xs">
          {connectionCount} online
        </span>
      )}
    </div>
  );
}
