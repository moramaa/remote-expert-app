'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
import type { MachineOption } from '@/lib/machines';

interface Props {
  machines: MachineOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function CertificationMultiSelect({ machines, selected, onChange }: Props) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Machines not yet selected that match the current query
  const filteredGroups = (() => {
    const q = query.trim().toLowerCase();
    const candidates = machines.filter((m) => !selected.includes(m.id));
    const matched = q
      ? candidates.filter(
          (m) =>
            m.label.toLowerCase().includes(q) ||
            m.vendor.toLowerCase().includes(q),
        )
      : candidates;

    // Group by vendor
    const map = new Map<string, MachineOption[]>();
    matched.forEach((m) => {
      const list = map.get(m.vendor) ?? [];
      list.push(m);
      map.set(m.vendor, list);
    });
    return Array.from(map.entries()); // [vendor, machines[]]
  })();

  const selectedMachines = selected
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is MachineOption => m !== undefined);

  // ── Interactions ──────────────────────────────────────────────────────────

  function add(id: string): void {
    onChange([...selected, id]);
    setQuery('');
    inputRef.current?.focus();
  }

  function remove(id: string): void {
    onChange(selected.filter((s) => s !== id));
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
    if (e.key === 'Backspace' && query === '' && selectedMachines.length > 0) {
      // Remove the last chip on backspace when input is empty
      remove(selectedMachines[selectedMachines.length - 1]!.id);
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const hasResults = filteredGroups.some(([, items]) => items.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>

      {/* ── Input field + chips ── */}
      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
          padding: '6px 10px',
          border: `1px solid ${open ? '#1D4ED8' : '#E2E8F0'}`,
          borderRadius: '8px',
          background: '#FFFFFF',
          cursor: 'text',
          boxShadow: open ? '0 0 0 3px #DBEAFE' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Chips for selected machines */}
        {selectedMachines.map((m) => (
          <span
            key={m.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#DBEAFE',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              borderRadius: '20px',
              padding: '2px 8px 2px 10px',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.5,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {m.label}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(m.id); }}
              aria-label={`Remove ${m.label}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: '#1D4ED8',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#BFDBFE';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        {/* Search input */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={selectedMachines.length === 0 ? 'Type to find your certified machines…' : ''}
          style={{
            flex: '1 1 120px',
            minWidth: '80px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '13px',
            color: '#0F172A',
            padding: '2px 0',
          }}
        />

        {/* Chevron */}
        <ChevronDown
          size={14}
          color="#94A3B8"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            marginLeft: 'auto',
          }}
        />
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            zIndex: 50,
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {/* Search hint row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderBottom: '1px solid #F1F5F9',
              color: '#94A3B8',
              fontSize: '11px',
            }}
          >
            <Search size={12} />
            {query ? `Results for "${query}"` : 'All available certifications'}
          </div>

          {!hasResults ? (
            <div
              style={{
                padding: '20px 12px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#94A3B8',
              }}
            >
              {query
                ? `No matches for "${query}"`
                : 'All certifications already selected'}
            </div>
          ) : (
            filteredGroups.map(([vendor, items]) =>
              items.length === 0 ? null : (
                <div key={vendor}>
                  {/* Vendor group header */}
                  <div
                    style={{
                      padding: '8px 12px 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#64748B',
                      background: '#F8FAFC',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    {vendor}
                  </div>

                  {/* Machine options */}
                  {items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onPointerDown={(e) => {
                        // Use pointerdown so we fire before the blur on the input
                        e.preventDefault();
                        add(m.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '9px 14px 9px 20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#0F172A',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#F0F7FF';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
