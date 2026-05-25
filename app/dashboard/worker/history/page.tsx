'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle,
  Eye, RefreshCw, Loader2, History, ChevronRight,
  MapPin, MessageSquare, Tag, Mic,
} from 'lucide-react';
import { getStoredUserId } from '@/lib/identity';
import type { WorkerSessionDTO } from '@/app/api/sessions/worker-history/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerHistoryPage() {
  const router   = useRouter();
  const workerId = getStoredUserId() ?? '';

  const [sessions,    setSessions]    = useState<WorkerSessionDTO[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId) { setLoading(false); return; }
    fetch(`/api/sessions/worker-history?workerId=${workerId}`)
      .then((r) => r.json())
      .then((data: WorkerSessionDTO[]) => { setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workerId]);

  async function handleRegenerate(sessionId: string): Promise<void> {
    setRegenerating(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/regenerate-summary`, { method: 'POST' });
      if (res.ok) {
        const { summary } = await res.json() as { summary: string };
        setSessions((prev) => prev.map((s) => s.sessionId === sessionId ? { ...s, summary } : s));
      }
    } catch { /* noop */ }
    setRegenerating(null);
  }

  // Group sessions by date label
  const grouped = sessions.reduce<Record<string, WorkerSessionDTO[]>>((acc, s) => {
    const label = fmtDate(s.endedAt);
    (acc[label] ??= []).push(s);
    return acc;
  }, {});

  const dateGroups = Object.entries(grouped);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A' }}>
      {/* Header */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/dashboard/worker')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748B', fontSize: '13px', padding: '4px', borderRadius: '6px',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} color="#1D4ED8" />
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
            Call History
          </h1>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94A3B8' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: '#94A3B8' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Loading session history…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 24px',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px dashed #E2E8F0',
            }}
          >
            <History size={40} color="#CBD5E1" style={{ marginBottom: '16px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>No calls yet</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748B' }}>
              Past SOS sessions will appear here once completed.
            </p>
          </div>
        ) : (
          dateGroups.map(([dateLabel, group]) => (
            <div key={dateLabel} style={{ marginBottom: '24px' }}>
              {/* Date group header */}
              <div
                style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#94A3B8', marginBottom: '8px',
                }}
              >
                {dateLabel}
              </div>

              {/* Session cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.map((s) => {
                  const isExpanded  = expanded === s.sessionId;
                  const isResolved  = s.resolvedExpert || s.resolvedWorker;
                  // Treat NULL summary the same as __AI_FAILED__ in lists —
                  // session is saved, only summary is missing
                  const isFailed    = s.summary === '__AI_FAILED__' || s.summary === null;
                  const isPending   = false;

                  return (
                    <div
                      key={s.sessionId}
                      style={{
                        background: '#FFFFFF',
                        border: `1px solid ${isExpanded ? '#1D4ED8' : '#E2E8F0'}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      {/* Card row */}
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : s.sessionId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          width: '100%', padding: '14px 16px',
                          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {/* Status icon */}
                        {isResolved
                          ? <CheckCircle2 size={20} color="#16A34A" style={{ flexShrink: 0 }} />
                          : <XCircle      size={20} color="#DC2626" style={{ flexShrink: 0 }} />
                        }

                        {/* Main info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                              {s.machineName}
                            </span>
                            {isResolved
                              ? <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A' }}>Resolved</span>
                              : <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: '#FEE2E2', color: '#DC2626' }}>Unresolved</span>
                            }
                            {s.safetyTriggered && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E' }}>⚠️ Safety</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#94A3B8' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={10} /> {fmtDuration(s.durationSeconds)}
                            </span>
                            <span>{fmtTime(s.endedAt)}</span>
                          </div>
                        </div>

                        <ChevronRight
                          size={16} color="#CBD5E1"
                          style={{ flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                        />
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 16px', background: '#F8FAFC' }}>
                          {/* Unresolved warning */}
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
                                This session did not fully resolve the issue.
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
                                An emergency stop was triggered. Review safety precautions before proceeding.
                              </p>
                            </div>
                          )}

                          {/* Location chip (Department · Line · Station) */}
                          {(s.locationDept || s.locationLine || s.locationStation) && (
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: '6px' }}>
                                Location
                              </div>
                              <div
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                                  borderRadius: '20px', padding: '5px 12px',
                                  fontSize: '12px', color: '#0F172A', fontWeight: 500,
                                }}
                              >
                                <MapPin size={12} color="#1D4ED8" />
                                {[s.locationDept, s.locationLine, s.locationStation].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          )}

                          {/* Tags / markers */}
                          {s.markers.length > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <Tag size={11} color="#64748B" />
                                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                                  Tags placed ({s.markers.length})
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {s.markers.map((m, idx) => (
                                  <span
                                    key={m.id}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      background: '#FEF3C7', border: '1px solid #FCD34D',
                                      borderRadius: '6px', padding: '4px 8px',
                                      fontSize: '11px', color: '#78350F', fontWeight: 500,
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, color: '#D97706' }}>#{idx + 1}</span>
                                    {m.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expert's instructions */}
                          {s.instructions.length > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <MessageSquare size={11} color="#64748B" />
                                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                                  Expert instructions ({s.instructions.length})
                                </div>
                              </div>
                              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {s.instructions.map((ins) => (
                                  <li key={ins.id} style={{ fontSize: '12px', color: '#0F172A', lineHeight: 1.5 }}>
                                    {ins.text}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Voice transcript count chip */}
                          {s.pttCount > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                              <div
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                                  borderRadius: '6px', padding: '5px 10px',
                                  fontSize: '11px', color: '#1E40AF', fontWeight: 500,
                                }}
                              >
                                <Mic size={11} />
                                {s.pttCount} voice message{s.pttCount !== 1 ? 's' : ''} recorded
                              </div>
                            </div>
                          )}

                          {/* Empty-content note */}
                          {s.markers.length === 0 && s.instructions.length === 0 && s.pttCount === 0 && (
                            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                              No markers, instructions, or voice messages were exchanged during this session.
                            </p>
                          )}

                          {/* AI Summary */}
                          <div style={{ marginBottom: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: '6px' }}>
                              AI Summary
                            </div>
                            {isPending ? (
                              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                                Summary is being generated…
                              </p>
                            ) : isFailed ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                                  No AI summary available for this session.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void handleRegenerate(s.sessionId)}
                                  disabled={regenerating === s.sessionId}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#1D4ED8', fontSize: '11px', fontWeight: 600, padding: 0,
                                  }}
                                >
                                  <RefreshCw size={11} style={{ animation: regenerating === s.sessionId ? 'spin 1s linear infinite' : 'none' }} />
                                  Regenerate
                                </button>
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: '12px', color: '#0F172A', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {s.summary}
                              </p>
                            )}
                          </div>

                          {/* Show on 3D */}
                          {s.markers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => router.push(`/worker?preview=${s.sessionId}`)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                width: '100%',
                                padding: '9px 12px',
                                background: '#DBEAFE', border: '1px solid #93C5FD',
                                borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600, color: '#1D4ED8',
                              }}
                            >
                              <Eye size={13} />
                              Show on 3D — view historical markers
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
