'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, CheckCircle2, XCircle, Clock, AlertTriangle,
  Loader2, ChevronRight, MapPin, MessageSquare, Tag,
  Mic, Map, Trash2, Eye, BarChart3, User,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import type { AdminSessionDTO } from '@/app/api/sessions/all/route';

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

function fmtRelative(ts: number, startMs: number): string {
  const diff = Math.max(0, Math.round((ts - startMs) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `+${m}m ${s}s` : `+${s}s`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdministratorDashboardPage() {
  const router  = useRouter();
  const profile = useProfile('administrator');

  const [sessions,     setSessions]    = useState<AdminSessionDTO[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [expanded,     setExpanded]    = useState<string | null>(null);
  const [movementOpen, setMovementOpen] = useState<string | null>(null);
  const [deleting,     setDeleting]    = useState<string | null>(null);
  const [confirmId,    setConfirmId]   = useState<string | null>(null);

  useEffect(() => {
    if (profile.status !== 'ready') return;
    fetch('/api/sessions/all?limit=100')
      .then((r) => r.json())
      .then((data: AdminSessionDTO[]) => { setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [profile]);

  const handleDelete = useCallback(async (sessionId: string) => {
    setDeleting(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        setExpanded(null);
        setConfirmId(null);
      }
    } catch { /* noop */ }
    setDeleting(null);
  }, []);

  if (profile.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="#1D4ED8" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Aggregate quick stats for the metrics placeholder
  const resolved = sessions.filter((s) => s.resolvedExpert === true).length;
  const safety   = sessions.filter((s) => s.safetyTriggered).length;

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
        <Shield size={20} color="#1D4ED8" />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
            Session Administration
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8', letterSpacing: '0.04em' }}>
            All recorded sessions across the platform
          </p>
        </div>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: '#94A3B8' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Loading all sessions…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#FFFFFF', borderRadius: '16px',
              border: '1px dashed #E2E8F0',
            }}
          >
            <Shield size={40} color="#CBD5E1" style={{ marginBottom: '16px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>No sessions yet</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748B' }}>
              Sessions will appear here once workers complete SOS calls.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map((s) => {
              const isExpanded     = expanded === s.sessionId;
              const isMovementOpen = movementOpen === s.sessionId;
              const isResolved     = s.resolvedExpert || s.resolvedWorker;
              const isFailed       = s.summary === '__AI_FAILED__' || s.summary === null;
              const sessionStartMs = new Date(s.startedAt).getTime();

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
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : s.sessionId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      width: '100%', padding: '14px 16px',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {isResolved
                      ? <CheckCircle2 size={20} color="#16A34A" style={{ flexShrink: 0 }} />
                      : <XCircle      size={20} color="#DC2626" style={{ flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                          {s.machineName}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#64748B' }}>
                          <User size={10} /> {s.workerName}
                        </span>
                        {s.safetyTriggered && (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E' }}>⚠️ Safety</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#94A3B8', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} /> {fmtDuration(s.durationSeconds)}
                        </span>
                        <span>{fmtDate(s.endedAt)} {fmtTime(s.endedAt)}</span>
                        <span style={{ fontFamily: 'monospace' }}>id: {s.sessionId.slice(0, 8)}</span>
                      </div>
                    </div>
                    <ChevronRight
                      size={16} color="#CBD5E1"
                      style={{ flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                    />
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 16px', background: '#F8FAFC' }}>
                      {/* Location chip */}
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

                      {/* Markers */}
                      {s.markers.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <Tag size={11} color="#64748B" />
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
                              Tags placed ({s.markers.length})
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {s.markers.map((m, idx) => (
                              <div
                                key={m.id}
                                style={{
                                  display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap',
                                  background: '#FEF3C7', border: '1px solid #FCD34D',
                                  borderRadius: '6px', padding: '5px 10px',
                                }}
                              >
                                <span style={{ fontWeight: 700, color: '#D97706', fontSize: '11px' }}>#{idx + 1}</span>
                                <span style={{ fontSize: '12px', color: '#78350F', fontWeight: 500 }}>{m.label}</span>
                                {(m.sweepId || m.floor !== undefined) && (
                                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#92400E', fontFamily: 'monospace' }}>
                                    {m.sweepId ? `sweep ${m.sweepId.slice(0, 8)}` : ''}
                                    {m.floor !== undefined ? ` · floor ${m.floor}` : ''}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instructions */}
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
                                <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>
                                  {fmtRelative(ins.timestamp, sessionStartMs)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Voice chip */}
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

                      {/* Movement breadcrumb */}
                      {s.positionLog.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <button
                            type="button"
                            onClick={() => setMovementOpen(isMovementOpen ? null : s.sessionId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              width: '100%', background: '#FFFFFF',
                              border: '1px solid #E2E8F0', borderRadius: '6px',
                              padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <Map size={11} color="#64748B" />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A' }}>
                              {s.positionLog.length} movement event{s.positionLog.length !== 1 ? 's' : ''} recorded
                            </span>
                            <ChevronRight
                              size={12} color="#94A3B8"
                              style={{ marginLeft: 'auto', transform: isMovementOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                            />
                          </button>
                          {isMovementOpen && (
                            <ol style={{ margin: '6px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {s.positionLog.map((p, i) => (
                                <li key={i} style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                                  <span style={{ color: '#94A3B8' }}>{fmtRelative(p.ts, sessionStartMs)}</span>
                                  {' — sweep '}
                                  <span style={{ color: '#0F172A' }}>{p.sweepId.slice(0, 8)}</span>
                                  {p.floor !== undefined && <span style={{ color: '#94A3B8' }}>{' · floor '}{p.floor}</span>}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}

                      {/* Empty content note */}
                      {s.markers.length === 0 && s.instructions.length === 0 && s.pttCount === 0 && s.positionLog.length === 0 && (
                        <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                          No markers, instructions, voice messages or movement were recorded during this session.
                        </p>
                      )}

                      {/* AI Summary */}
                      <div style={{ marginBottom: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: '6px' }}>
                          AI Summary
                        </div>
                        {isFailed ? (
                          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                            No AI summary available.
                          </p>
                        ) : (
                          <p style={{ margin: 0, fontSize: '12px', color: '#0F172A', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {s.summary}
                          </p>
                        )}
                      </div>

                      {/* Action row */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {s.markers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => router.push(`/worker?preview=${s.sessionId}`)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '9px 14px',
                              background: '#DBEAFE', border: '1px solid #93C5FD',
                              borderRadius: '8px', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600, color: '#1D4ED8',
                            }}
                          >
                            <Eye size={13} />
                            Show on 3D
                          </button>
                        )}

                        {confirmId === s.sessionId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDelete(s.sessionId)}
                              disabled={deleting === s.sessionId}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '9px 14px',
                                background: '#DC2626', border: '1px solid #DC2626',
                                borderRadius: '8px',
                                cursor: deleting === s.sessionId ? 'not-allowed' : 'pointer',
                                opacity: deleting === s.sessionId ? 0.6 : 1,
                                fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                              }}
                            >
                              <Trash2 size={13} />
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              style={{
                                padding: '9px 14px',
                                background: 'transparent', border: '1px solid #E2E8F0',
                                borderRadius: '8px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 500, color: '#64748B',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmId(s.sessionId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              marginLeft: 'auto',
                              padding: '9px 14px',
                              background: '#FFFFFF', border: '1px solid #FCA5A5',
                              borderRadius: '8px', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600, color: '#DC2626',
                            }}
                          >
                            <Trash2 size={13} />
                            Delete session
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Metrics placeholder slot */}
        <div
          style={{
            marginTop: '40px',
            padding: '24px',
            background: '#FFFFFF',
            border: '1px dashed #E2E8F0',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <BarChart3 size={28} color="#CBD5E1" style={{ marginBottom: '8px' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Metrics — coming soon
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
            Resolution rate, average call duration, top machines, AI failure rate, and more.
            <br />
            Current quick view: {sessions.length} total · {resolved} resolved by expert · {safety} safety triggers.
          </p>
        </div>
      </div>
    </div>
  );
}
