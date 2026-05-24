'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import type { Instruction } from '@/types/socket';

interface Props {
  recent: Instruction[];
  onSend: (text: string) => void;
}

export default function InstructionInput({ recent, onSend }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = (): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    taRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col border border-zinc-800 bg-[#0d1b2a]">
      <div className="border-b border-zinc-800 px-3 py-2 text-xs uppercase tracking-widest text-zinc-500">
        Instruction
      </div>
      <div className="flex gap-2 p-3">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type instruction for the worker… (⌘+Enter to send)"
          rows={3}
          className="flex-1 resize-none border border-zinc-800 bg-[#0a0f1e] px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-orange-500"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="flex items-center gap-1 self-start border border-orange-500 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-500 transition-colors hover:bg-orange-500 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-orange-500/10 disabled:hover:text-orange-500"
        >
          <Send size={14} />
          Send
        </button>
      </div>
      {recent.length > 0 && (
        <div className="border-t border-zinc-900 px-3 py-2 text-xs text-zinc-500">
          <div className="mb-1 uppercase tracking-widest text-[10px]">Recent</div>
          <ul className="space-y-1">
            {recent.slice(0, 3).map((ins) => (
              <li key={ins.id} className="truncate">
                ↳ {ins.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
