/**
 * AI Summarization — post-session background worker
 *
 * Uses claude-3-5-haiku-20241022 to generate structured summaries of
 * completed support sessions. Called fire-and-forget from the socket server
 * immediately after session:end persists to DB.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Instruction, PttChunk } from '../types/socket';

const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

const MODEL = 'claude-3-5-haiku-20241022';

// ── Context window guard ───────────────────────────────────────────────────
// Keep combined log under ~40,000 chars (~10k tokens) to avoid waste on
// extremely long sessions while staying well within the 200k context window.
const MAX_CHARS = 40_000;
const MAX_TRANSCRIPT_CHUNKS = 60;
const MAX_INSTRUCTIONS = 80;

function truncateLogs(
  instructions: Instruction[],
  transcript: PttChunk[],
): { instructions: Instruction[]; transcript: PttChunk[]; wasTruncated: boolean } {
  let inst = instructions;
  let trans = transcript;
  let wasTruncated = false;

  // Truncate transcript first (lower signal than instructions)
  if (trans.length > MAX_TRANSCRIPT_CHUNKS) {
    trans = trans.slice(-MAX_TRANSCRIPT_CHUNKS);
    wasTruncated = true;
  }

  // If still too large, truncate instructions
  const totalChars =
    inst.reduce((s, i) => s + i.text.length, 0) +
    trans.reduce((s, c) => s + c.text.length, 0);

  if (totalChars > MAX_CHARS) {
    inst = inst.slice(-MAX_INSTRUCTIONS);
    wasTruncated = true;
  }

  return { instructions: inst, transcript: trans, wasTruncated };
}

// ── Merge + sort event log ─────────────────────────────────────────────────
interface LogEntry {
  ts:   number;
  role: string;
  type: 'instruction' | 'ptt';
  text: string;
}

function buildChronologicalLog(
  instructions: Instruction[],
  transcript: PttChunk[],
): LogEntry[] {
  const entries: LogEntry[] = [
    ...instructions.map((i) => ({
      ts:   i.timestamp,
      role: 'expert',
      type: 'instruction' as const,
      text: i.text,
    })),
    ...transcript.map((c) => ({
      ts:   c.startTs,
      role: c.speakerId, // userId — treated as opaque identifier
      type: 'ptt' as const,
      text: c.text,
    })),
  ];
  entries.sort((a, b) => a.ts - b.ts);
  return entries;
}

// ── Main export ────────────────────────────────────────────────────────────

export interface SummarizeParams {
  machineLabel:    string;
  instructionLog:  Instruction[];
  transcriptLog:   PttChunk[];
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;
}

export async function generateSessionSummary(params: SummarizeParams): Promise<string> {
  const { machineLabel, resolvedExpert, resolvedWorker, safetyTriggered } = params;

  const { instructions, transcript, wasTruncated } = truncateLogs(
    params.instructionLog,
    params.transcriptLog,
  );

  const log = buildChronologicalLog(instructions, transcript);

  const isResolved = resolvedExpert === true || resolvedWorker === true;

  // ── System prompt ──────────────────────────────────────────────────────
  const systemPrompt = `You are a technical documentation assistant for an industrial remote-support platform.
Your task is to generate a concise, structured summary of a completed support session for a factory machine.

Output format (always follow this exactly):
1. If the session was NOT resolved by either party, start with exactly this line:
   "❗ Note: This historical session did not fully resolve the issue, but is provided to show context on previously attempted steps."
   Then a blank line.
2. If the emergency/safety freeze button was activated at any point, start with (or insert after the unresolved note):
   "⚠️ Safety Warning: [1-2 sentence description of the specific hazard inferred from the session context. Be specific about the component or area involved.]"
   Then a blank line.
3. Problem Statement: One concise paragraph (2-3 sentences) describing what the issue was.
4. Execution Steps: A numbered list of the key steps taken, in chronological order.
   - Keep each step brief (1 sentence max)
   - Include only meaningful actions, not filler phrases
   - Maximum 10 steps

Do NOT include timestamps, user IDs, or raw socket event data in the output.
Write in clear, professional English suitable for a factory technician.`;

  // ── User message ───────────────────────────────────────────────────────
  const truncationNote = wasTruncated
    ? '[Note: session log was truncated to most recent entries due to session length]\n\n'
    : '';

  const logText = log.length > 0
    ? log
        .map((e) => `[${e.type === 'instruction' ? 'INSTRUCTION' : 'VOICE'}] ${e.text}`)
        .join('\n')
    : '(No events logged)';

  const resolutionLine = isResolved
    ? 'Resolution: RESOLVED (at least one party confirmed the issue was solved)'
    : 'Resolution: NOT RESOLVED (neither party confirmed resolution)';

  const safetyLine = safetyTriggered
    ? 'Safety Override: YES — the emergency freeze button was activated during this session'
    : 'Safety Override: No';

  const userMessage = `Machine: ${machineLabel}
${resolutionLine}
${safetyLine}

${truncationNote}Chronological event log:
${logText}`;

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 512,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected non-text response from Claude');
  return content.text.trim();
}
