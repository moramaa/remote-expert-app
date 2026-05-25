'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  start(): void;
  stop(): void;
  reset(): void;
}

// Minimal type declarations for the Web Speech API (not yet in all TS DOM libs)
interface SpeechRecognitionResultItem {
  readonly transcript: string;
}

interface SpeechRecognitionResultEntry {
  readonly [index: number]: SpeechRecognitionResultItem;
  readonly length: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResultEntry;
  readonly length: number;
}

interface SpeechRecognitionResultEvent {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

// Extend Window for browser-prefixed SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setIsSupported(!!SR);
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i]![0]!.transcript;
      }
      setTranscript(full);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      rec.abort();
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript('');
    recognitionRef.current.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    setTranscript('');
    setIsListening(false);
  }, []);

  return { transcript, isListening, isSupported, start, stop, reset };
}
