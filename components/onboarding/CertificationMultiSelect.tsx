'use client';

import type { MachineOption } from '@/lib/machines';
import { VENDORS } from '@/lib/machines';

interface Props {
  machines: MachineOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function CertificationMultiSelect({ machines, selected, onChange }: Props) {
  function toggle(id: string): void {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  const byVendor = VENDORS.map((vendor) => ({
    vendor,
    items: machines.filter((m) => m.vendor === vendor),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {byVendor.map(({ vendor, items }) => (
        <div key={vendor}>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#94A3B8',
              marginBottom: '6px',
            }}
          >
            {vendor}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {items.map((m) => {
              const active = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  style={{
                    background: active ? '#1D4ED8' : 'transparent',
                    color: active ? '#FFFFFF' : '#64748B',
                    border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`,
                    borderRadius: '20px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
