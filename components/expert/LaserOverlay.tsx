'use client';

interface Props {
  position: { x: number; y: number } | null; // percentages 0-100
}

export default function LaserOverlay({ position }: Props) {
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
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: '#1D4ED8',
          boxShadow: '0 0 14px 4px rgba(29, 78, 216, 0.6)',
          animation: 'laser-pulse 1.1s ease-in-out infinite',
        }}
      />
      <style jsx>{`
        @keyframes laser-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}
