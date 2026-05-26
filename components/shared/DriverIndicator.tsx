'use client';

interface Props {
  driver: 'expert' | 'worker' | null;
  myRole: 'expert' | 'worker';
}

export default function DriverIndicator({ driver, myRole }: Props) {
  if (!driver) return null;

  const isMe = driver === myRole;
  const label = isMe
    ? '🔵 You are driving the view'
    : `🟡 ${driver === 'expert' ? 'Expert' : 'Worker'} is driving the view`;

  return (
    <div
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '6px',
        padding:       '4px 10px',
        borderRadius:  '20px',
        fontSize:      '11px',
        fontWeight:    600,
        background:    isMe ? '#DBEAFE' : '#FEF3C7',
        color:         isMe ? '#1D4ED8' : '#92400E',
        border:        `1px solid ${isMe ? '#93C5FD' : '#FCD34D'}`,
        whiteSpace:    'nowrap',
      }}
    >
      {label}
    </div>
  );
}
