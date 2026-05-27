'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ChevronRight, Clock, CheckCircle2,
  XCircle, Search, X, Loader2, Users, MapPin, Eye, Sparkles,
} from 'lucide-react';
import { MACHINES, MACHINE_MAP } from '@/lib/machines';
import type { SuggestionDTO } from '@/app/api/suggestions/route';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, SosAck } from '@/types/socket';
import { getStoredUserId } from '@/lib/identity';

type FlowStep = 'machine' | 'suggestions' | 'searching';

interface WorkerProfile {
  name: string;
  factory: string;
}

interface LocationInfo {
  dept:    string;
  line:    string;
  station: string;
}

interface Props {
  profile: WorkerProfile;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  onSessionJoined: (sessionId: string) => void;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ── Machine Picker Step ───────────────────────────────────────────────────────

function MachinePickerStep({
  onSelect,
  onClose,
}: {
  onSelect: (id: string, location: LocationInfo) => void;
  onClose: () => void;
}) {
  const [query, setQuery]       = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState<LocationInfo>({ dept: '', line: '', station: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = MACHINES.filter(
    (m) =>
      m.label.toLowerCase().includes(query.toLowerCase()) ||
      m.vendor.toLowerCase().includes(query.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, typeof MACHINES>>((acc, m) => {
    (acc[m.vendor] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
            Which machine needs help?
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
            Select the machine you&apos;re working on
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', borderRadius: '6px' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 8px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            border: '1px solid #E2E8F0', borderRadius: '8px',
            padding: '8px 12px', background: '#F8FAFC',
          }}
        >
          <Search size={14} color="#94A3B8" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search machines…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: '#0F172A' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={12} color="#94A3B8" />
            </button>
          )}
        </div>
      </div>

      {/* Optional location fields */}
      <div style={{ padding: '0 20px 8px' }}>
        <button
          type="button"
          onClick={() => setShowLocation(!showLocation)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '11px', color: '#64748B', padding: 0, fontWeight: 500,
          }}
        >
          <MapPin size={11} />
          {showLocation ? 'Hide location ▲' : '+ Add your location (optional)'}
        </button>

        {showLocation && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
            {([
              { key: 'dept',    placeholder: 'Department' },
              { key: 'line',    placeholder: 'Line' },
              { key: 'station', placeholder: 'Station' },
            ] as { key: keyof LocationInfo; placeholder: string }[]).map(({ key, placeholder }) => (
              <input
                key={key}
                value={location[key]}
                onChange={(e) => setLocation((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{
                  border: '1px solid #E2E8F0', borderRadius: '6px',
                  padding: '6px 8px', fontSize: '12px', color: '#0F172A',
                  background: '#F8FAFC', outline: 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Machine list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
        {Object.entries(grouped).map(([vendor, machines]) => (
          <div key={vendor}>
            <div style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8' }}>
              {vendor}
            </div>
            {machines.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id, location)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px', marginBottom: '4px',
                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                  borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1D4ED8'; (e.currentTarget as HTMLButtonElement).style.background = '#F0F7FF'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#0F172A' }}>{m.label}</span>
                <ChevronRight size={16} color="#CBD5E1" />
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
            No machines match &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suggestions Step ──────────────────────────────────────────────────────────

function SuggestionsStep({
  machineId,
  workerId,
  onEscalate,
  onSolved,
  onClose,
}: {
  machineId: string;
  workerId: string;
  onEscalate: () => void;
  onSolved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionDTO[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [answered, setAnswered]       = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const machine = MACHINE_MAP.get(machineId);

  useEffect(() => {
    fetch(`/api/suggestions?machineId=${machineId}`)
      .then((r) => r.json())
      .then((data: SuggestionDTO[]) => { setSuggestions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [machineId]);

  async function logDeflection(sessionId: string | null, outcome: 'solved' | 'unsolved'): Promise<void> {
    setSubmitting(true);
    try {
      await fetch('/api/deflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, machineId, suggestedSessionId: sessionId, outcome }),
      });
    } catch { /* fire-and-forget */ }
    setSubmitting(false);
  }

  async function handleYes(sessionId: string): Promise<void> {
    await logDeflection(sessionId, 'solved');
    onSolved();
  }

  async function handleNo(sessionId: string): Promise<void> {
    await logDeflection(sessionId, 'unsolved');
    onEscalate();
  }

  async function handleEscalateDirectly(): Promise<void> {
    await logDeflection(null, 'unsolved');
    onEscalate();
  }

  function handleShowOn3D(sessionId: string): void {
    onClose();
    router.push(`/worker?preview=${sessionId}`);
  }

  // Split into resolved and unresolved
  const resolved   = suggestions.filter((s) => s.resolvedExpert || s.resolvedWorker);
  const unresolved = suggestions.filter((s) => !s.resolvedExpert && !s.resolvedWorker);

  function renderCard(s: SuggestionDTO) {
    const isExpanded  = expanded === s.sessionId;
    const isAnswering = answered === s.sessionId;
    const isResolved  = s.resolvedExpert || s.resolvedWorker;

    return (
      <div
        key={s.sessionId}
        style={{
          border: `1px solid ${isExpanded ? '#1D4ED8' : '#E2E8F0'}`,
          borderRadius: '12px',
          background: isExpanded ? '#F0F7FF' : '#FFFFFF',
          overflow: 'hidden',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {/* Card header row */}
        <button
          type="button"
          onClick={() => { setExpanded(isExpanded ? null : s.sessionId); setAnswered(s.sessionId); }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            width: '100%', padding: '14px 16px',
            background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          {isResolved
            ? <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
            : <XCircle      size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {isResolved
                ? <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A' }}>✅ Resolved</span>
                : <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#FEE2E2', color: '#DC2626' }}>❌ Unresolved</span>
              }
              {s.safetyTriggered && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#FEF3C7', color: '#92400E' }}>⚠️ Safety</span>
              )}
            </div>

            {/* AI summary — coming soon */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={11} color="#94A3B8" />
              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                AI summary — coming soon
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: '#94A3B8', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={10} />{fmtDuration(s.durationSeconds)}
              </span>
              <span>{timeAgo(s.resolvedAt)}</span>
            </div>
          </div>
          <ChevronRight
            size={16} color="#CBD5E1"
            style={{ flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          />
        </button>

        {/* Expanded area */}
        {isExpanded && isAnswering && (
          <div style={{ borderTop: '1px solid #DBEAFE', padding: '12px 16px', background: '#EFF6FF' }}>
            {/* Unresolved disclaimer */}
            {!isResolved && (
              <div
                style={{
                  display: 'flex', gap: '8px', alignItems: 'flex-start',
                  padding: '8px 10px', borderRadius: '8px',
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  marginBottom: '10px',
                }}
              >
                <AlertTriangle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '11px', color: '#991B1B', lineHeight: 1.4 }}>
                  This session did not fully resolve the issue, but is provided to show context on previously attempted steps.
                </p>
              </div>
            )}

            {/* Safety warning */}
            {s.safetyTriggered && (
              <div
                style={{
                  display: 'flex', gap: '8px', alignItems: 'flex-start',
                  padding: '8px 10px', borderRadius: '8px',
                  background: '#FEF3C7', border: '1px solid #FCD34D',
                  marginBottom: '10px',
                }}
              >
                <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '11px', color: '#78350F', lineHeight: 1.4 }}>
                  An emergency stop was triggered during this session. Review safety precautions before proceeding.
                </p>
              </div>
            )}

            {/* Show on 3D */}
            <button
              type="button"
              onClick={() => handleShowOn3D(s.sessionId)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', marginBottom: '10px',
                padding: '9px 12px',
                background: '#DBEAFE', border: '1px solid #93C5FD',
                borderRadius: '8px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: '#1D4ED8',
              }}
            >
              <Eye size={13} />
              Show on 3D — view historical markers
            </button>

            {/* Did this solve it? */}
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#1D4ED8' }}>
              Did this solve your issue?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleYes(s.sessionId)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: '#16A34A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '10px', fontSize: '13px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >
                <CheckCircle2 size={15} />
                Yes — Resolved
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleNo(s.sessionId)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: '#FFFFFF', color: '#DC2626', border: '1px solid #DC2626',
                  borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >
                <XCircle size={15} />
                No — Still Need Help
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Similar past solutions</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
            {machine?.label} — check if one of these solves your issue first
          </p>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', borderRadius: '6px' }}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0', color: '#94A3B8' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Looking for relevant solutions…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
            <Users size={28} color="#CBD5E1" style={{ marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>No past solutions found for this machine.</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>Connect directly to a live expert below.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Resolved sessions first */}
            {resolved.map(renderCard)}

            {/* Separator before unresolved */}
            {resolved.length > 0 && unresolved.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  Previously attempted (not resolved)
                </span>
                <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
              </div>
            )}

            {/* Unresolved sessions */}
            {unresolved.map(renderCard)}
          </div>
        )}
      </div>

      {/* Escalation CTA — flexShrink:0 keeps it always visible even when cards expand */}
      <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #F1F5F9', background: '#FFFFFF', flexShrink: 0 }}>
        <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
          {suggestions.length > 0 ? 'None of these solved your problem?' : 'Need immediate help?'}
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleEscalateDirectly()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', background: '#DC2626', color: '#FFFFFF', border: 'none',
            borderRadius: '10px', padding: '14px 16px', fontSize: '14px', fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            boxShadow: '0 2px 10px rgba(220,38,38,0.3)',
          }}
        >
          <AlertTriangle size={16} />
          This didn&apos;t help — Connect to Live Expert
        </button>
      </div>
    </div>
  );
}

// ── Searching Step ────────────────────────────────────────────────────────────

function SearchingStep({ machineName, onCancel }: { machineName: string; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', height: '100%', padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
        {[0, 0.5].map((delay) => (
          <div
            key={delay}
            style={{
              position: 'absolute', inset: delay === 0 ? 0 : '8px',
              borderRadius: '50%', border: '2px solid #1D4ED8',
              animation: `sos-ping 1.5s cubic-bezier(0,0,0.2,1) ${delay}s infinite`, opacity: 0.4,
            }}
          />
        ))}
        <div style={{ position: 'absolute', inset: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={24} color="#1D4ED8" />
        </div>
      </div>

      <style>{`@keyframes sos-ping { 75%, 100% { transform: scale(2); opacity: 0; } }`}</style>

      <div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Finding an Expert</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>Searching for a certified expert in</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1D4ED8', marginTop: '4px' }}>{machineName}</div>
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#94A3B8' }}>
          You&apos;ll be connected automatically when an expert accepts…
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: '1px solid #E2E8F0',
          borderRadius: '8px', color: '#64748B', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
        }}
      >
        <X size={12} />
        Cancel Request
      </button>
    </div>
  );
}

// ── Main SosFlow component ────────────────────────────────────────────────────

export default function SosFlow({ profile, socket, isConnected, onSessionJoined, onClose }: Props) {
  const [step,      setStep]      = useState<FlowStep>('machine');
  const [machineId, setMachineId] = useState<string | null>(null);
  const [ticketId,  setTicketId]  = useState<string | null>(null);
  const [location,  setLocation]  = useState<LocationInfo>({ dept: '', line: '', station: '' });

  const workerId = getStoredUserId() ?? '';

  useEffect(() => {
    if (!socket || step !== 'searching') return;

    const onTicketStatus = (payload: { ticketId: string; state: string; sessionId?: string }): void => {
      if (payload.state === 'matched' && payload.sessionId) {
        onSessionJoined(payload.sessionId);
      }
    };

    const onSessionJoin = ({ sessionId }: { sessionId: string }): void => {
      onSessionJoined(sessionId);
    };

    socket.on('worker:ticket-status', onTicketStatus);
    socket.on('session:join',         onSessionJoin);
    return () => {
      socket.off('worker:ticket-status', onTicketStatus);
      socket.off('session:join',         onSessionJoin);
    };
  }, [socket, step, onSessionJoined]);

  const handleMachineSelect = useCallback((id: string, loc: LocationInfo) => {
    setMachineId(id);
    setLocation(loc);
    setStep('suggestions');
  }, []);

  const startLiveSearch = useCallback(() => {
    if (!socket || !isConnected || !machineId) return;
    setStep('searching');
    socket.emit(
      'worker:sos-create',
      {
        machineId,
        workerName:       profile.name,
        workerFactory:    profile.factory,
        locationDept:     location.dept   || undefined,
        locationLine:     location.line   || undefined,
        locationStation:  location.station || undefined,
      },
      (result: SosAck) => {
        if ('error' in result) {
          setStep('suggestions');
        } else {
          setTicketId(result.ticketId);
        }
      },
    );
  }, [socket, isConnected, machineId, profile, location]);

  const cancelSearch = useCallback(() => {
    if (socket && ticketId) {
      socket.emit('worker:sos-cancel', { ticketId });
    }
    setTicketId(null);
    setStep('suggestions');
  }, [socket, ticketId]);

  const machineName = machineId ? (MACHINE_MAP.get(machineId)?.label ?? machineId) : '';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={step !== 'searching' ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: '#FFFFFF', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh', overflow: 'hidden',
          animation: 'slide-up 0.25s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#E2E8F0' }} />
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {step === 'machine' && (
            <MachinePickerStep onSelect={handleMachineSelect} onClose={onClose} />
          )}
          {step === 'suggestions' && machineId && (
            <SuggestionsStep
              machineId={machineId}
              workerId={workerId}
              onEscalate={startLiveSearch}
              onSolved={onClose}
              onClose={onClose}
            />
          )}
          {step === 'searching' && (
            <SearchingStep machineName={machineName} onCancel={cancelSearch} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
