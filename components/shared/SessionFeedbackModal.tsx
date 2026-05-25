'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle, XCircle, CheckCircle2, Star,
  AlertTriangle, Loader2, History, RefreshCw,
} from 'lucide-react';
import type { SummaryStatusDTO } from '@/app/api/sessions/[id]/summary-status/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExpertStage  = 'question' | 'saving' | 'confirmation';
type WorkerStage  = 'rating' | 'thankyou';
type AiStatus     = 'polling' | 'ready' | 'failed' | 'timeout';

interface Props {
  open:           boolean;
  role:           'expert' | 'worker';
  sessionId:      string | null;
  onAnswer:       (resolved: boolean) => void;
  onDone:         () => void;
  onViewHistory?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = 2_500;
const POLL_MAX_ATTEMPTS = 10;   // 25 seconds total

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionFeedbackModal({
  open, role, sessionId, onAnswer, onDone, onViewHistory,
}: Props) {
  // Expert flow
  const [expertStage,  setExpertStage]  = useState<ExpertStage>('question');
  const [aiStatus,     setAiStatus]     = useState<AiStatus>('polling');
  const [aiSummary,    setAiSummary]    = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Worker flow
  const [workerStage,  setWorkerStage]  = useState<WorkerStage>('rating');
  const [hoverStar,    setHoverStar]    = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);

  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  // Reset every time the modal opens
  useEffect(() => {
    if (open) {
      setExpertStage('question');
      setAiStatus('polling');
      setAiSummary(null);
      setWorkerStage('rating');
      setHoverStar(0);
      setSelectedStar(0);
      attemptsRef.current = 0;
    }
  }, [open]);

  // Poll AI status once we reach the expert confirmation stage
  useEffect(() => {
    if (expertStage !== 'confirmation' || !sessionId) return;

    function stopPolling() {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }

    function poll() {
      if (!sessionId) return;
      attemptsRef.current += 1;
      fetch(`/api/sessions/${sessionId}/summary-status`)
        .then((r) => r.json())
        .then((data: SummaryStatusDTO) => {
          if (data.status === 'ready') {
            setAiStatus('ready'); setAiSummary(data.summary); stopPolling();
          } else if (data.status === 'failed') {
            setAiStatus('failed'); stopPolling();
          } else if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
            setAiStatus('timeout'); stopPolling();
          }
        })
        .catch(() => { if (attemptsRef.current >= POLL_MAX_ATTEMPTS) { setAiStatus('timeout'); stopPolling(); } });
    }

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return stopPolling;
  }, [expertStage, sessionId]);

  async function handleRegenerate(): Promise<void> {
    if (!sessionId) return;
    setRegenerating(true);
    setAiStatus('polling');
    attemptsRef.current = 0;
    try {
      await fetch(`/api/sessions/${sessionId}/regenerate-summary`, { method: 'POST' });
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        attemptsRef.current += 1;
        fetch(`/api/sessions/${sessionId}/summary-status`)
          .then((r) => r.json())
          .then((data: SummaryStatusDTO) => {
            if (data.status === 'ready') {
              setAiStatus('ready'); setAiSummary(data.summary);
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            } else if (data.status === 'failed') {
              setAiStatus('failed');
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            } else if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
              setAiStatus('timeout');
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            }
          }).catch(() => {});
      }, POLL_INTERVAL_MS);
    } catch { /* noop */ }
    setRegenerating(false);
  }

  // Expert: answer resolution question → start save flow
  function handleExpertAnswer(resolved: boolean): void {
    onAnswer(resolved);
    setExpertStage('saving');
    setTimeout(() => setExpertStage('confirmation'), 1_200);
  }

  // Worker: submit star rating → emit session:end + show thank-you
  function handleWorkerSubmit(): void {
    if (!selectedStar) return;
    onAnswer(selectedStar >= 4); // ≥4 stars = positive experience → resolvedWorker=true
    setWorkerStage('thankyou');
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(15,23,42,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF', borderRadius: '16px',
          padding: '40px 32px', maxWidth: '440px', width: '100%',
          textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* ═══════════════ WORKER FLOW ═══════════════ */}

        {role === 'worker' && workerStage === 'rating' && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⭐</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Rate the support
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 28px', lineHeight: 1.5 }}>
              How helpful was the expert&apos;s guidance during this session?
            </p>

            {/* Star picker */}
            <div
              style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
              onMouseLeave={() => setHoverStar(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedStar(n)}
                  onMouseEnter={() => setHoverStar(n)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    transform: (hoverStar || selectedStar) >= n ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.1s',
                  }}
                >
                  <Star
                    size={36}
                    fill={(hoverStar || selectedStar) >= n ? '#F59E0B' : 'none'}
                    color={(hoverStar || selectedStar) >= n ? '#F59E0B' : '#CBD5E1'}
                  />
                </button>
              ))}
            </div>

            {/* Label */}
            <div style={{ height: '20px', marginBottom: '24px' }}>
              {selectedStar > 0 && (
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                  {selectedStar === 1 && 'Not helpful at all'}
                  {selectedStar === 2 && 'Slightly helpful'}
                  {selectedStar === 3 && 'Moderately helpful'}
                  {selectedStar === 4 && 'Very helpful'}
                  {selectedStar === 5 && 'Excellent guidance!'}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedStar}
              onClick={handleWorkerSubmit}
              style={{
                width: '100%', padding: '14px',
                background: selectedStar ? '#1D4ED8' : '#E2E8F0',
                color: selectedStar ? '#FFFFFF' : '#94A3B8',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 700,
                cursor: selectedStar ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              Submit Rating
            </button>

            <button
              type="button"
              onClick={() => { onAnswer(false); setWorkerStage('thankyou'); }}
              style={{
                marginTop: '10px', background: 'none', border: 'none',
                cursor: 'pointer', color: '#94A3B8', fontSize: '13px',
              }}
            >
              Skip
            </button>
          </>
        )}

        {role === 'worker' && workerStage === 'thankyou' && (
          <>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#DCFCE7', color: '#15803D',
                padding: '6px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: 700, marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={15} />
              Session Recorded
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 10px' }}>
              Thank you for your feedback!
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 28px', lineHeight: 1.5 }}>
              Your rating helps us improve expert matching.
              The full session — markers, instructions and voice — has been saved to your call history.
            </p>
            <button
              type="button"
              onClick={onDone}
              style={{
                width: '100%', padding: '14px',
                background: '#1D4ED8', color: '#FFFFFF',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </>
        )}

        {/* ═══════════════ EXPERT FLOW ═══════════════ */}

        {role === 'expert' && expertStage === 'question' && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>📋</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Session Ended
            </h2>
            <p style={{ fontSize: '15px', color: '#64748B', margin: '0 0 32px', lineHeight: 1.5 }}>
              Was the issue resolved successfully?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => handleExpertAnswer(true)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: '#16A34A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '14px 20px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <CheckCircle size={18} /> Yes — Resolved
              </button>
              <button type="button" onClick={() => handleExpertAnswer(false)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '14px 20px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <XCircle size={18} /> No — Not Resolved
              </button>
            </div>
          </>
        )}

        {role === 'expert' && expertStage === 'saving' && (
          <>
            <Loader2 size={40} color="#1D4ED8" style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Saving session…
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Recording markers, instructions and transcript
            </p>
          </>
        )}

        {role === 'expert' && expertStage === 'confirmation' && (
          <>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#DCFCE7', color: '#15803D',
                padding: '6px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: 700, marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={15} />
              Session Recorded
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Call saved successfully
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 24px', lineHeight: 1.5 }}>
              Markers, instructions, and voice transcript stored. The AI summary will appear in the worker&apos;s call history.
            </p>

            {/* AI status card */}
            <div
              style={{
                border: `1px solid ${aiStatus === 'failed' ? '#FCA5A5' : aiStatus === 'ready' ? '#86EFAC' : '#E2E8F0'}`,
                borderRadius: '10px', padding: '14px 16px', marginBottom: '24px',
                background: aiStatus === 'failed' ? '#FEF2F2' : aiStatus === 'ready' ? '#F0FDF4' : '#F8FAFC',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flexShrink: 0, marginTop: '1px' }}>
                  {aiStatus === 'polling' && <Loader2 size={16} color="#1D4ED8" style={{ animation: 'spin 1s linear infinite' }} />}
                  {aiStatus === 'ready'   && <CheckCircle2 size={16} color="#16A34A" />}
                  {aiStatus === 'failed'  && <AlertTriangle size={16} color="#DC2626" />}
                  {aiStatus === 'timeout' && <AlertTriangle size={16} color="#D97706" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                    {aiStatus === 'polling' && 'AI summary generating…'}
                    {aiStatus === 'ready'   && 'AI summary ready'}
                    {aiStatus === 'failed'  && 'AI summary failed'}
                    {aiStatus === 'timeout' && 'AI summary still generating'}
                  </div>
                  {aiStatus === 'polling' && (
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: 1.4 }}>
                      Claude is analysing the session — usually 5–10 seconds.
                    </p>
                  )}
                  {aiStatus === 'ready' && aiSummary && (
                    <p style={{
                      margin: 0, fontSize: '11px', color: '#166534', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {aiSummary}
                    </p>
                  )}
                  {aiStatus === 'failed' && (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#991B1B', lineHeight: 1.4 }}>
                        The AI summary could not be generated. Session data is saved — only the summary is missing.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleRegenerate()}
                        disabled={regenerating}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: 'none', border: 'none', cursor: regenerating ? 'not-allowed' : 'pointer',
                          color: '#DC2626', fontSize: '11px', fontWeight: 700, padding: 0,
                          opacity: regenerating ? 0.6 : 1,
                        }}
                      >
                        <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
                        Retry AI summary
                      </button>
                    </>
                  )}
                  {aiStatus === 'timeout' && (
                    <p style={{ margin: 0, fontSize: '11px', color: '#92400E', lineHeight: 1.4 }}>
                      Still generating — it will appear in the worker&apos;s call history shortly.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" onClick={onDone}
                style={{
                  width: '100%', padding: '14px',
                  background: '#1D4ED8', color: '#FFFFFF',
                  border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Done
              </button>
              <button type="button" onClick={onViewHistory ?? onDone}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  width: '100%', padding: '10px',
                  background: 'transparent', color: '#64748B',
                  border: '1px solid #E2E8F0', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                <History size={13} />
                View call history
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
