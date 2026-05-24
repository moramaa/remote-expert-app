'use client';

interface Props {
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export default function MirrorViewToggle({ enabled, onChange }: Props) {
  return (
    <div className="flex items-center justify-between border border-zinc-800 bg-[#0d1b2a] px-3 py-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-500">Mirror View</div>
        <div className="text-[11px] text-zinc-500">
          {enabled ? 'Worker camera follows yours' : 'Worker navigates freely'}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className="relative h-6 w-11 border transition-colors"
        style={{
          borderColor: enabled ? '#f97316' : '#27272a',
          background: enabled ? 'rgba(249, 115, 22, 0.15)' : '#0a0f1e',
          boxShadow: enabled ? '0 0 8px rgba(249, 115, 22, 0.5)' : 'none',
        }}
      >
        <span
          className="absolute top-[2px] block h-4 w-4 transition-transform"
          style={{
            background: enabled ? '#f97316' : '#52525b',
            transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
            boxShadow: enabled ? '0 0 8px #f97316' : 'none',
          }}
        />
      </button>
    </div>
  );
}
