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
}

export default function PttButton({ onChunk, speakerId, label = 'Hold to Talk' }: Props) {
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
