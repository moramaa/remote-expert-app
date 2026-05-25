'use client';

interface Props {
  position: { x: number; y: number } | null;
}

export default function LaserPointerDot({ position }: Props) {
  if (!position) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#1D4ED8',
          boxShadow: '0 0 18px 5px rgba(29, 78, 216, 0.6)',
          animation: 'wl-pulse 1.1s ease-in-out infinite',
        }}
      />
      <style jsx>{`
        @keyframes wl-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.45); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
