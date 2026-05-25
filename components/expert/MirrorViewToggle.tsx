'use client';

interface Props {
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export default function MirrorViewToggle({ enabled, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '10px 12px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#64748B',
            fontWeight: 700,
          }}
        >
          Mirror View
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
          {enabled ? 'Worker camera follows yours' : 'Worker navigates freely'}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        style={{
          position: 'relative',
          width: '44px',
          height: '24px',
          border: '1px solid',
          borderRadius: '12px',
          borderColor: enabled ? '#1D4ED8' : '#E2E8F0',
          background: enabled ? '#DBEAFE' : '#F1F5F9',
          boxShadow: enabled ? '0 0 0 3px #DBEAFE' : 'none',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: enabled ? '#1D4ED8' : '#CBD5E1',
            transform: enabled ? 'translateX(22px)' : 'translateX(3px)',
            transition: 'transform 0.2s, background 0.2s',
            display: 'block',
          }}
        />
      </button>
    </div>
  );
}
