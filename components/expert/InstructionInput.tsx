'use client';

import { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import type { Instruction } from '@/types/socket';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface Props {
  recent: Instruction[];
  onSend: (text: string) => void;
}

export default function InstructionInput({ recent, onSend }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { transcript, isListening, isSupported, start, stop } = useSpeechRecognition();

  // Sync speech transcript into the text field
  useEffect(() => {
    if (isListening && transcript) {
      setText(transcript);
    }
  }, [transcript, isListening]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (isListening) stop();
    taRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const toggleMic = (): void => {
    if (isListening) { stop(); } else { start(); }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #E2E8F0',
          fontSize: '11px',
          fontWeight: 700,
          color: '#1D4ED8',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: '#F8FAFC',
        }}
      >
        Send Instruction
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 12px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type instruction for the worker… (⌘+Enter to send)"
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              border: `1px solid ${isListening ? '#DC2626' : '#E2E8F0'}`,
              borderRadius: '6px',
              background: isListening ? '#FFF5F5' : '#FFFFFF',
              padding: '8px 10px',
              fontSize: '13px',
              color: '#0F172A',
              outline: 'none',
              transition: 'border-color 0.15s',
              boxSizing: 'border-box',
            }}
          />
          {isListening && (
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#DC2626',
                animation: 'mic-pulse 1s ease-in-out infinite',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: text.trim() ? '#1D4ED8' : '#E2E8F0',
              color: text.trim() ? '#FFFFFF' : '#94A3B8',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={13} />
            Send
          </button>

          {isSupported && (
            <button
              type="button"
              onClick={toggleMic}
              title={isListening ? 'Stop recording' : 'Dictate instruction'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isListening ? '#FEE2E2' : '#F1F5F9',
                color: isListening ? '#DC2626' : '#64748B',
                border: `1px solid ${isListening ? '#DC2626' : '#E2E8F0'}`,
                borderRadius: '6px',
                padding: '8px',
                cursor: 'pointer',
              }}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            padding: '8px 12px',
            background: '#F8FAFC',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '4px',
            }}
          >
            Recent
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recent.slice(0, 3).map((ins) => (
              <li
                key={ins.id}
                style={{
                  fontSize: '12px',
                  color: '#64748B',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                ↳ {ins.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        @keyframes mic-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
