'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
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
  const [stepsOpen, setStepsOpen] = useState(true);

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
    if (pb) setStepsOpen(true); // auto-expand when a playbook is chosen
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
          padding: '8px 12px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <BookOpen size={13} color="#1D4ED8" />
        <span
          style={{
            flex: 1,
            fontSize: '11px',
            fontWeight: 700,
            color: '#1D4ED8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Playbooks
        </span>
        {/* Progress badge */}
        {selected && (
          <span style={{ fontSize: '10px', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
            {Math.min(stepIndex, selected.steps.length)}/{selected.steps.length}
          </span>
        )}
        {/* Collapse toggle (only when a playbook is active) */}
        {selected && (
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            title={stepsOpen ? 'Collapse steps' : 'Show steps'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px', color: '#94A3B8', display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronDown
              size={14}
              style={{ transition: 'transform 0.2s', transform: stepsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            />
          </button>
        )}
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Dropdown */}
        <select
          value={selected?.id ?? ''}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '7px 10px',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            fontSize: '12px',
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

        {/* Step list + send button — collapsible */}
        {selected && stepsOpen && (
          <>
            <div
              style={{
                maxHeight: '110px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              {selected.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: idx < stepIndex
                      ? '#F0FDF4'
                      : idx === stepIndex
                        ? '#DBEAFE'
                        : '#F8FAFC',
                    borderLeft: `3px solid ${idx < stepIndex ? '#16A34A' : idx === stepIndex ? '#1D4ED8' : '#E2E8F0'}`,
                    fontSize: '11px',
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

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {allDone ? (
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#16A34A',
                    padding: '7px',
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
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Send Next Step
                  <ChevronRight size={13} />
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
                  padding: '7px',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </>
        )}

        {/* Collapsed summary — shows current step inline */}
        {selected && !stepsOpen && !allDone && (
          <div
            style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              padding: '6px 8px', borderRadius: '6px',
              background: '#DBEAFE', borderLeft: '3px solid #1D4ED8',
              fontSize: '11px', color: '#1D4ED8',
            }}
          >
            <span style={{ fontWeight: 700, flexShrink: 0 }}>{stepIndex + 1}.</span>
            <span style={{ flex: 1, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.steps[stepIndex]}
            </span>
            <button
              type="button"
              onClick={handleSendStep}
              style={{
                flexShrink: 0, background: '#1D4ED8', color: '#fff',
                border: 'none', borderRadius: '5px',
                padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
