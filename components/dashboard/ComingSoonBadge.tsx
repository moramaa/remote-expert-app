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
        color: '#f97316',
        border: '1px solid #f97316',
        opacity: 0.7,
      }}
    >
      Coming Soon
    </span>
  );
}
