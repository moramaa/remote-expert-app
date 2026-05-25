'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronRight, RotateCcw } from 'lucide-react';
import type { Instruction } from '@/types/socket';
import type { PlaybookDTO } from '@/app/api/playbooks/route';

interface Props {
  onSendStep: (instruction: Instruction) => void;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PlaybookSelector({ onSendStep }: Props) {
  const [playbooks, setPlaybooks] = useState<PlaybookDTO[]>([]);
  const [selected, setSelected] = useState<PlaybookDTO | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/playbooks')
      .then((r) => r.json())
      .then((data: PlaybookDTO[]) => { setPlaybooks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((id: string) => {
    const pb = playbooks.find((p) => p.id === id) ?? null;
    setSelected(pb);
    setStepIndex(0);
  }, [playbooks]);

  const handleSendStep = useCallback(() => {
    if (!selected || stepIndex >= selected.steps.length) return;
    const step = selected.steps[stepIndex]!;
    const instruction: Instruction = {
      id: uid(),
      text: step,
      timestamp: Date.now(),
      stepNumber: stepIndex + 1,
      totalSteps: selected.steps.length,
    };
    onSendStep(instruction);
    setStepIndex((i) => i + 1);
  }, [selected, stepIndex, onSendStep]);

  const allDone = selected != null && stepIndex >= selected.steps.length;

  // Group playbooks by machine for <optgroup>
  const grouped = playbooks.reduce<Record<string, { name: string; pbs: PlaybookDTO[] }>>((acc, pb) => {
    if (!acc[pb.machineId]) {
      acc[pb.machineId] = { name: pb.machineName, pbs: [] };
    }
    acc[pb.machineId]!.pbs.push(pb);
    return acc;
  }, {});

  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <BookOpen size={14} color="#1D4ED8" />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#1D4ED8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Playbooks
        </span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Dropdown */}
        <select
          value={selected?.id ?? ''}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#0F172A',
            background: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          <option value="">{loading ? 'Loading…' : '— Select a playbook —'}</option>
          {Object.entries(grouped).map(([machineId, { name, pbs }]) => (
            <optgroup key={machineId} label={name}>
              {pbs.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Step list + send button */}
        {selected && (
          <>
            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {selected.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: idx < stepIndex
                      ? '#F0FDF4'
                      : idx === stepIndex
                        ? '#DBEAFE'
                        : '#F8FAFC',
                    borderLeft: `3px solid ${idx < stepIndex ? '#16A34A' : idx === stepIndex ? '#1D4ED8' : '#E2E8F0'}`,
                    fontSize: '12px',
                    color: idx < stepIndex ? '#16A34A' : idx === stepIndex ? '#1D4ED8' : '#64748B',
                  }}
                >
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>
                    {idx < stepIndex ? '✓' : `${idx + 1}.`}
                  </span>
                  <span style={{ lineHeight: 1.4 }}>{step}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {allDone ? (
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#16A34A',
                    padding: '8px',
                    background: '#F0FDF4',
                    borderRadius: '6px',
                  }}
                >
                  ✓ All steps sent
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendStep}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#1D4ED8',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '9px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Send Next Step
                  <ChevronRight size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setStepIndex(0)}
                title="Reset to step 1"
                style={{
                  background: 'transparent',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
