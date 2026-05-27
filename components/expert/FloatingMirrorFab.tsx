'use client';

import { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Tv2, Check, X, ChevronDown } from 'lucide-react';

interface Props {
  driver: 'expert' | 'worker' | null;
  controlRequested: boolean;
  onExpertDrive: () => void;
  onWorkerDrive: () => void;
  onStopMirror: () => void;
  onGrant: () => void;
  onDeny: () => void;
}

type MirrorMode = 'expert' | 'worker' | null;

const MODE_META: Record<
  string,
  { label: string; Icon: typeof Video; color: string; bg: string; ring: string }
> = {
  expert: { label: 'My View',      Icon: Video,    color: '#1D4ED8', bg: '#DBEAFE', ring: 'rgba(29,78,216,0.35)'  },
  worker: { label: "Worker's View", Icon: Tv2,      color: '#7C3AED', bg: '#EDE9FE', ring: 'rgba(124,58,237,0.35)' },
  off:    { label: 'Free Nav',      Icon: VideoOff, color: '#475569', bg: '#F1F5F9', ring: 'rgba(71,85,105,0.25)'  },
};

function modeKey(driver: MirrorMode): string {
  return driver ?? 'off';
}

/**
 * Floating Mirror View button — positioned top-left of the Matterport viewer.
 *
 * - Single compact pill button showing the current mode icon + label.
 * - Click → opens an inline popover with three mode options.
 * - controlRequested=true → amber pulse ring + notification dot on the FAB;
 *   popover shows a prominent Grant / Deny row.
 * - Click outside the popover to close it.
 */
export default function FloatingMirrorFab({
  driver,
  controlRequested,
  onExpertDrive,
  onWorkerDrive,
  onStopMirror,
  onGrant,
  onDeny,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-open when worker requests control so the expert sees options immediately
  useEffect(() => {
    if (controlRequested) setOpen(true);
  }, [controlRequested]);

  const current = MODE_META[modeKey(driver)]!;
  const { Icon: CurrentIcon } = current;

  const handleSelect = (next: MirrorMode) => {
    if (next === 'expert') onExpertDrive();
    else if (next === 'worker') onWorkerDrive();
    else onStopMirror();
    setOpen(false);
  };

  const handleGrant = () => { onGrant(); setOpen(false); };
  const handleDeny  = () => { onDeny();  };

  return (
    <>
      <style>{`
        @keyframes mirror-request-pulse {
          0%, 100% { box-shadow: 0 0 0 0px rgba(217,119,6,0.6), 0 4px 14px rgba(0,0,0,0.14); }
          50%       { box-shadow: 0 0 0 7px rgba(217,119,6,0.0), 0 4px 14px rgba(0,0,0,0.14); }
        }
        @keyframes mirror-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.3); }
        }
      `}</style>

      <div
        ref={wrapRef}
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
        }}
      >
        {/* ── FAB trigger ──────────────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px 7px 10px',
              borderRadius: '20px',
              border: 'none',
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: current.color,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: controlRequested
                ? 'none'
                : '0 4px 14px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: controlRequested ? 'mirror-request-pulse 1s ease-in-out infinite' : 'none',
              transition: 'background 0.15s',
            }}
          >
            <CurrentIcon size={14} />
            {current.label}
            <ChevronDown
              size={12}
              style={{
                transition: 'transform 0.2s',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                color: '#94A3B8',
              }}
            />
          </button>

          {/* Notification dot — amber, pulses when worker requests */}
          {controlRequested && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#D97706',
                border: '2px solid #FFFFFF',
                animation: 'mirror-dot-pulse 0.8s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* ── Popover ───────────────────────────────────────────────────────── */}
        {open && (
          <div
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.07)',
              padding: '6px',
              minWidth: '180px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            {/* Section label */}
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', padding: '4px 8px 2px' }}>
              Mirror View
            </div>

            {/* Mode options */}
            {(
              [
                { key: 'expert', next: 'expert' as MirrorMode,  label: 'My Control',      Icon: Video,    color: '#1D4ED8' },
                { key: 'worker', next: 'worker' as MirrorMode,  label: "Worker's View",    Icon: Tv2,      color: '#7C3AED' },
                { key: 'off',    next: null      as MirrorMode,  label: 'Free Navigation',  Icon: VideoOff, color: '#475569' },
              ] as const
            ).map(({ key, next, label, Icon, color }) => {
              const active = modeKey(driver) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(next)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '9px',
                    border: 'none',
                    background: active ? `${color}14` : 'transparent',
                    color: active ? color : '#475569',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 500,
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s',
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0, color }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && <Check size={13} style={{ color }} />}
                </button>
              );
            })}

            {/* Worker control-request row */}
            {controlRequested && (
              <div
                style={{
                  marginTop: '4px',
                  borderTop: '1px solid #FCD34D',
                  paddingTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#92400E', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '13px' }}>⚠</span>
                  Worker wants control
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '0 2px' }}>
                  <button
                    type="button"
                    onClick={handleGrant}
                    style={{
                      flex: 1,
                      background: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Grant
                  </button>
                  <button
                    type="button"
                    onClick={handleDeny}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: '#64748B',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    Deny
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
