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

  // Focus the input whenever a new dialog opens; reset the label.
  // No auto-close timer — the dialog stays until Save, Skip, or Escape.
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
        background: '#0d1b2a',
        border: '1px solid #f97316',
        boxShadow: '0 0 16px rgba(249, 115, 22, 0.5)',
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
          background: '#0a0f1e',
          border: '1px solid #27272a',
          color: '#fff',
          padding: '4px 8px',
          fontSize: '12px',
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={() => onSubmit(label)}
        style={{
          background: '#f97316',
          color: '#000',
          padding: '4px 8px',
          fontSize: '11px',
          border: 'none',
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
          border: '1px solid #27272a',
          color: '#94a3b8',
          padding: '4px 8px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Skip
      </button>
    </div>
  );
}
