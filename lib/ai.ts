/**
 * AI Summarization — post-session background worker
 *
 * Uses claude-3-5-haiku-20241022 to generate structured, actionable
 * troubleshooting guides from completed support sessions.
 * Called fire-and-forget from the socket server after session:end.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Instruction, PttChunk, PositionPing, Marker } from '../types/socket';

export const AI_FAILED_MARKER = '__AI_FAILED__';

const MODEL = 'claude-3-5-haiku-20241022';

// Lazy client construction — env vars may not be loaded at module-eval time
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — check .env and restart the dev server');
  }
  if (!apiKey.startsWith('sk-ant-')) {
    throw new Error(`ANTHROPIC_API_KEY looks malformed (starts with "${apiKey.slice(0, 8)}…")`);
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// ── Context window guard ───────────────────────────────────────────────────
const MAX_TRANSCRIPT_CHUNKS = 60;
const MAX_INSTRUCTIONS      = 80;
const MAX_POSITIONS         = 20;   // keep breadcrumb concise for the model

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert an absolute ms epoch to a human-readable offset string (+1m 15s) */
export function relativeTimestamp(tsMs: number, startMs: number): string {
  const diff = Math.max(0, Math.round((tsMs - startMs) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `+${m}m ${s}s` : `+${s}s`;
}

/**
 * Build a minimal JSON payload for the AI model.
 * Keeps token count low while preserving all semantically relevant detail.
 */
function buildAiPayload(
  params: SummarizeParams,
  startMs: number,
): object {
  const { instructions, transcript, wasTruncated } = truncateLogs(
    params.instructionLog,
    params.transcriptLog,
  );

  // Chronological event log (instructions + PTT merged and sorted)
  type EventEntry = { t: string; role: 'expert' | 'worker'; kind: 'instruction' | 'voice'; text: string };
  const events: EventEntry[] = [];
  for (const i of instructions) {
    events.push({ t: relativeTimestamp(i.timestamp, startMs), role: 'expert', kind: 'instruction', text: i.text });
  }
  for (const c of transcript) {
    events.push({ t: relativeTimestamp(c.startTs, startMs), role: 'worker', kind: 'voice', text: c.text });
  }
  events.sort((a, b) => {
    // re-sort by original ms (approximation via startMs — enough for ordering)
    return 0; // already sorted via pre-merge; preserve insertion order
  });
  // Re-sort properly: map back to ms
  const instByText = new Map(instructions.map((i) => [i.text, i.timestamp]));
  const transcrByText = new Map(transcript.map((c) => [c.text, c.startTs]));
  events.sort((a, b) => {
    const aMs = (a.kind === 'instruction' ? instByText.get(a.text) : transcrByText.get(a.text)) ?? 0;
    const bMs = (b.kind === 'instruction' ? instByText.get(b.text) : transcrByText.get(b.text)) ?? 0;
    return aMs - bMs;
  });

  // Markers (only label + location context)
  const markerList = (params.markers ?? []).map((m, i) => {
    const loc = [
      m.floor !== undefined ? `floor ${m.floor}` : null,
      m.sweepId ? `zone ${m.sweepId.slice(0, 6)}` : null,
    ].filter(Boolean).join(', ');
    return { n: i + 1, label: m.label ?? 'Unlabeled', ...(loc ? { location: loc } : {}) };
  });

  // Movement waypoints (sparse — show first, middle samples, last)
  const positions = (params.positionLog ?? []).slice(0, MAX_POSITIONS);
  const waypoints = positions.map((p) => ({
    t: relativeTimestamp(p.ts, startMs),
    zone: p.sweepId.slice(0, 8),
    ...(p.floor !== undefined ? { floor: p.floor } : {}),
  }));

  const locationStr = [params.locationDept, params.locationLine, params.locationStation]
    .filter(Boolean).join(' > ');

  return {
    machine:       params.machineLabel,
    location:      locationStr || undefined,
    resolved:      params.resolvedExpert === true || params.resolvedWorker === true,
    safetyStop:    params.safetyTriggered,
    truncated:     wasTruncated,
    events,
    markers:       markerList.length > 0 ? markerList : undefined,
    movement:      waypoints.length > 0 ? waypoints : undefined,
  };
}

// ── Truncation ─────────────────────────────────────────────────────────────

function truncateLogs(
  instructions: Instruction[],
  transcript: PttChunk[],
): { instructions: Instruction[]; transcript: PttChunk[]; wasTruncated: boolean } {
  let inst  = instructions;
  let trans = transcript;
  let wasTruncated = false;

  if (trans.length > MAX_TRANSCRIPT_CHUNKS) {
    trans = trans.slice(-MAX_TRANSCRIPT_CHUNKS);
    wasTruncated = true;
  }
  if (inst.length > MAX_INSTRUCTIONS) {
    inst = inst.slice(-MAX_INSTRUCTIONS);
    wasTruncated = true;
  }
  return { instructions: inst, transcript: trans, wasTruncated };
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a technical expert creating precise, actionable troubleshooting guides for industrial machinery support sessions.

Your job: turn raw session logs into a clear guide a factory technician can follow to reproduce or continue the repair.

GOLDEN RULE — never write narrative about the session. Translate everything into direct, operative steps:
  ❌ "The expert told the worker to check the pressure gauge."
  ✅ "1. Check the pressure gauge on the cooling tank."

OUTPUT FORMAT — always use exactly this structure (no extra sections):

[If the issue was NOT resolved, start with this exact line:]
❗ Note: This session did not fully resolve the issue. Use these steps as a starting point.

[If an emergency stop was triggered, include:]
⚠️ Safety Warning: [specific hazard and component involved, 1–2 sentences]

Problem: [1–2 sentences describing the root issue as a technician would describe it]

Steps:
1. [Imperative action — be specific about the component, location, or reading]
2. [Next step]
...
[Maximum 10 steps. Each step = 1 sentence. Include component names and physical locations from markers/movement when available.]

Rules:
- Use imperative verbs: Check, Replace, Verify, Tighten, Reset, Inspect
- Reference marker labels and zone names when they add precision
- No timestamps, no user IDs, no socket event language
- Write for a technician who was not present — make it self-contained
- Maximum 10 steps`;

// ── Main export ────────────────────────────────────────────────────────────

export interface SummarizeParams {
  machineLabel:    string;
  instructionLog:  Instruction[];
  transcriptLog:   PttChunk[];
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;
  // ── Epic 6: enriched context ────────────────────────────────────────────
  locationDept?:    string | null;
  locationLine?:    string | null;
  locationStation?: string | null;
  markers?:         Pick<Marker, 'id' | 'label' | 'sweepId' | 'floor'>[];
  positionLog?:     Pick<PositionPing, 'ts' | 'sweepId' | 'floor'>[];
  sessionStartMs?:  number;  // ms epoch — used to compute relative times
}

export async function generateSessionSummary(params: SummarizeParams): Promise<string> {
  const startMs = params.sessionStartMs ?? 0;
  const payload = buildAiPayload(params, startMs);

  const userMessage = `Session data (JSON):\n${JSON.stringify(payload, null, 2)}`;

  const response = await getClient().messages.create({
    model:      MODEL,
    max_tokens: 600,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected non-text response from Claude');
  return content.text.trim();
}
