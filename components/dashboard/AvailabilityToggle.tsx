'use client';

interface Props {
  online: boolean;
  onChange: (online: boolean) => void;
  disabled?: boolean;
}

export default function AvailabilityToggle({ online, onChange, disabled = false }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        background: '#0d1b2a',
        border: `1px solid ${online ? '#f97316' : '#27272a'}`,
        boxShadow: online ? '0 0 16px rgba(249,115,22,0.3)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Toggle pill */}
      <button
        type="button"
        role="switch"
        aria-checked={online}
        disabled={disabled}
        onClick={() => onChange(!online)}
        style={{
          position: 'relative',
          width: '44px',
          height: '24px',
          background: online ? '#f97316' : '#27272a',
          border: 'none',
          borderRadius: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: online ? '23px' : '3px',
            width: '18px',
            height: '18px',
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
          }}
        />
      </button>

      {/* Status label */}
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: online ? '#f97316' : '#94a3b8',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.05em',
          }}
        >
          {online ? 'ONLINE' : 'OFFLINE'}
        </div>
        <div style={{ fontSize: '10px', color: '#475569' }}>
          {online ? 'Receiving SOS calls' : 'Not receiving calls'}
        </div>
      </div>
    </div>
  );
}
