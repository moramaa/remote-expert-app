'use client';

export default function ComingSoonBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: '9px',
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#1D4ED8',
        border: '1px solid #1D4ED8',
        borderRadius: '20px',
        opacity: 0.7,
      }}
    >
      Coming Soon
    </span>
  );
}
