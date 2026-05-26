'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { PttChunk } from '@/types/socket';

// ── Minimal Web Speech API type declarations ──────────────────────────────────
// Use a local interface name to avoid conflicts with lib.dom.d.ts globals

interface PttRecognitionResult {
  readonly [index: number]: { readonly transcript: string };
}
interface PttRecognitionEvent {
  readonly results: { [index: number]: PttRecognitionResult; length: number };
}
interface PttRecognition {
  continuous:      boolean;
  interimResults:  boolean;
  maxAlternatives: number;
  lang:            string;
  onstart:  (() => void) | null;
  onresult: ((e: PttRecognitionEvent) => void) | null;
  onend:    (() => void) | null;
  onerror:  ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type PttRecognitionCtor = new() => PttRecognition;

// ── Component ─────────────────────────────────────────────────────────────────

type PttState = 'idle' | 'priming' | 'listening';

interface Props {
  onChunk:   (chunk: PttChunk) => void;
  speakerId: string;
  label?:    string;
  /** Render as a floating circular FAB overlaid on the viewer */
  floating?: boolean;
}

export default function PttButton({ onChunk, speakerId, label = 'Hold to Talk', floating = false }: Props) {
  const [pttState,   setPttState]   = useState<PttState>('idle');
  const [isSupported, setIsSupported] = useState(true);

  const recRef     = useRef<PttRecognition | null>(null);
  const startTsRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');

  useEffect(() => {
    const win = typeof window !== 'undefined'
      ? (window as unknown as Record<string, PttRecognitionCtor | undefined>)
      : undefined;
    const Ctor = win?.['SpeechRecognition'] ?? win?.['webkitSpeechRecognition'];
    if (!Ctor) { setIsSupported(false); return; }

    const rec: PttRecognition = new Ctor();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 3;  // better accuracy in noisy environments
    rec.lang            = 'en-US';

    rec.onstart = () => { setPttState('listening'); };

    rec.onresult = (e: PttRecognitionEvent) => {
      transcriptRef.current = e.results[0]?.[0]?.transcript ?? '';
    };

    rec.onend = () => {
      const text = transcriptRef.current.trim();
      if (text) {
        onChunk({
          id:        uuidv4(),
          text,
          startTs:   startTsRef.current,
          endTs:     Date.now(),
          speakerId,
        });
      }
      transcriptRef.current = '';
      setPttState('idle');
    };

    rec.onerror = () => {
      transcriptRef.current = '';
      setPttState('idle');
    };

    recRef.current = rec;
    return () => { recRef.current = null; };
  }, [onChunk, speakerId]);

  const handlePointerDown = useCallback(() => {
    if (!recRef.current || pttState !== 'idle') return;
    startTsRef.current = Date.now();
    transcriptRef.current = '';
    setPttState('priming');
    recRef.current.start();
  }, [pttState]);

  const handlePointerUp = useCallback(() => {
    if (!recRef.current || pttState === 'idle') return;
    recRef.current.stop();
    // pttState will reset to 'idle' via the onend callback
  }, [pttState]);

  if (!isSupported) return null;

  // ── Visual style by state ────────────────────────────────────────────────
  const styles: Record<PttState, React.CSSProperties> = {
    idle: {
      background: '#1D4ED8',
      color: '#fff',
      border: '2px solid transparent',
    },
    priming: {
      background: '#D97706',
      color: '#fff',
      border: '2px solid #B45309',
    },
    listening: {
      background: '#DC2626',
      color: '#fff',
      border: '2px solid #B91C1C',
      boxShadow: '0 0 0 4px rgba(220,38,38,0.3)',
      animation: 'ptt-pulse 1s ease-in-out infinite',
    },
  };

  const stateLabel: Record<PttState, string> = {
    idle:     label,
    priming:  'Preparing…',
    listening:'Listening…',
  };

  // ── Floating FAB variant ─────────────────────────────────────────────────
  if (floating) {
    const fabBg: Record<PttState, string> = {
      idle:      '#1D4ED8',
      priming:   '#D97706',
      listening: '#DC2626',
    };
    const fabShadow: Record<PttState, string> = {
      idle:      '0 4px 16px rgba(29,78,216,0.45)',
      priming:   '0 4px 16px rgba(217,119,6,0.45)',
      listening: '0 4px 16px rgba(220,38,38,0.45)',
    };
    const fabLabel: Record<PttState, string> = {
      idle:      'Hold to Talk',
      priming:   'Preparing…',
      listening: 'Listening…',
    };
    return (
      <>
        <style>{`
          @keyframes ptt-pulse {
            0%, 100% { box-shadow: 0 4px 16px rgba(220,38,38,0.45), 0 0 0 0px rgba(220,38,38,0.4); }
            50%       { box-shadow: 0 4px 16px rgba(220,38,38,0.45), 0 0 0 10px rgba(220,38,38,0.0); }
          }
          @keyframes ptt-ring {
            0%   { transform: scale(1);    opacity: 0.6; }
            100% { transform: scale(1.8);  opacity: 0; }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
          {/* Ring pulse when listening */}
          <div style={{ position: 'relative', width: '56px', height: '56px' }}>
            {pttState === 'listening' && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '2px solid #DC2626',
                  animation: 'ptt-ring 1s ease-out infinite',
                }}
              />
            )}
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: 'none',
                background: fabBg[pttState],
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: fabShadow[pttState],
                transition: 'background 0.15s, box-shadow 0.15s',
                animation: pttState === 'listening' ? 'ptt-pulse 1.2s ease-in-out infinite' : 'none',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Mic size={22} />
            </button>
          </div>
          {/* State label */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#FFFFFF',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {fabLabel[pttState]}
          </div>
        </div>
      </>
    );
  }

  // ── Default inline button ────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes ptt-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(220,38,38,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(220,38,38,0.15); }
        }
      `}</style>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '6px',
          padding:        '8px 14px',
          borderRadius:   '8px',
          fontSize:       '13px',
          fontWeight:     600,
          cursor:         'pointer',
          userSelect:     'none',
          transition:     'background 0.1s, box-shadow 0.1s',
          whiteSpace:     'nowrap',
          ...styles[pttState],
        }}
      >
        <Mic size={15} />
        {stateLabel[pttState]}
        {pttState === 'listening' && (
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#fff',
            animation: 'ptt-pulse 0.8s ease-in-out infinite',
          }} />
        )}
      </button>
    </>
  );
}
