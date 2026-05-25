'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  position: { x: number; y: number } | null; // screen percentages
  onSubmit: (label: string) => void;
  onCancel: () => void;
}

export default function MarkerLabelDialog({ position, onSubmit, onCancel }: Props) {
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!position) return;
    setLabel('');
    inputRef.current?.focus();
  }, [position]);

  if (!position) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, calc(-100% - 30px))',
        zIndex: 40,
        background: '#FFFFFF',
        border: '1px solid #1D4ED8',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(29, 78, 216, 0.2)',
        padding: '8px',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        minWidth: '260px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(label);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Add label?"
        style={{
          flex: 1,
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          color: '#0F172A',
          padding: '4px 8px',
          fontSize: '12px',
          outline: 'none',
          borderRadius: '4px',
        }}
      />
      <button
        type="button"
        onClick={() => onSubmit(label)}
        style={{
          background: '#1D4ED8',
          color: '#FFFFFF',
          padding: '4px 10px',
          fontSize: '11px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => onSubmit('')}
        style={{
          background: 'transparent',
          border: '1px solid #E2E8F0',
          color: '#64748B',
          padding: '4px 8px',
          fontSize: '11px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Skip
      </button>
    </div>
  );
}
