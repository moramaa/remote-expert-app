'use client';

import { useState } from 'react';
import { X, Cpu } from 'lucide-react';
import type { MachineOption } from '@/lib/machines';
import { VENDORS } from '@/lib/machines';

interface Props {
  machines: MachineOption[];
  onSelect: (machineId: string) => void;
  onClose: () => void;
}

export default function MachinePickerModal({ machines, onSelect, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const vendors = ['All', ...VENDORS];
  const filtered = filter === 'All' ? machines : machines.filter((m) => m.vendor === filter);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: '420px',
          padding: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="#1D4ED8" />
            <span
              style={{
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#64748B',
              }}
            >
              Select Machine
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Vendor filter chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {vendors.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              style={{
                background: filter === v ? '#1D4ED8' : 'transparent',
                color: filter === v ? '#FFFFFF' : '#64748B',
                border: `1px solid ${filter === v ? '#1D4ED8' : '#E2E8F0'}`,
                borderRadius: '20px',
                padding: '3px 10px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Machine list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m.id)}
              style={{
                background: selected === m.id ? '#DBEAFE' : '#F8FAFC',
                border: `1px solid ${selected === m.id ? '#1D4ED8' : '#E2E8F0'}`,
                borderRadius: '8px',
                color: '#0F172A',
                padding: '10px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: selected === m.id ? 600 : 400 }}>{m.label}</div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#64748B',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginTop: '2px',
                  }}
                >
                  {m.vendor}
                </div>
              </div>
              {selected === m.id && (
                <span style={{ color: '#1D4ED8', fontSize: '16px' }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          style={{
            marginTop: '16px',
            width: '100%',
            background: selected ? '#1D4ED8' : '#E2E8F0',
            color: selected ? '#FFFFFF' : '#94A3B8',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.1em',
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          OPEN SOS CALL
        </button>
      </div>
    </div>
  );
}
