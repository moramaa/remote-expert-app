'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, MessageSquare, Square, Camera } from 'lucide-react';

export type ActivityKind = 'marker' | 'instruction' | 'zone' | 'camera' | 'clear';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  text: string;
  timestamp: number;
}

interface Props {
  entries: ActivityEntry[];
}

const ICONS: Record<ActivityKind, typeof MapPin> = {
  marker: MapPin,
  instruction: MessageSquare,
  zone: Square,
  camera: Camera,
  clear: Square,
};

const COLORS: Record<ActivityKind, string> = {
  marker: '#f97316',
  instruction: '#fbbf24',
  zone: '#f97316',
  camera: '#64748b',
  clear: '#64748b',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityFeed({ entries }: Props) {
  return (
    <div className="flex flex-1 flex-col border-t border-zinc-800 bg-[#0d1b2a]">
      <div className="border-b border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-500">
        Activity
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-600">
            Waiting for expert actions…
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {entries.map((e) => {
              const Icon = ICONS[e.kind];
              return (
                <motion.div
                  key={e.id}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 border-b border-zinc-900 px-3 py-2 text-xs last:border-b-0"
                >
                  <Icon size={14} style={{ color: COLORS[e.kind], marginTop: 2, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-zinc-200">{e.text}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{formatTime(e.timestamp)}</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
