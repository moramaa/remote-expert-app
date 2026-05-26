import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSessionSummary } from '@/lib/ai';
import { MACHINE_MAP } from '@/lib/machines';
import type { Instruction, PttChunk } from '@/types/socket';

/**
 * POST /api/sessions/:id/regenerate-summary
 *
 * Re-triggers AI summarization for a session whose previous attempt failed
 * (summary === "__AI_FAILED__"). Returns the new summary on success.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const machine = MACHINE_MAP.get(session.machineId);
    const machineLabel = machine?.label ?? session.machineId;

    const instructionLog: Instruction[] = session.instructionLog
      ? (JSON.parse(session.instructionLog) as Instruction[])
      : [];
    const transcriptLog: PttChunk[] = session.transcriptLog
      ? (JSON.parse(session.transcriptLog) as PttChunk[])
      : [];

    const summary = await generateSessionSummary({
      machineLabel,
      instructionLog,
      transcriptLog,
      resolvedExpert:  session.resolvedExpert ?? null,
      resolvedWorker:  session.resolvedWorker ?? null,
      safetyTriggered: session.safetyTriggered,
    });

    await prisma.session.update({
      where: { id },
      data:  { summary },
    });

    return Response.json({ summary });
  } catch (err) {
    console.error('[api] regenerate-summary failed for session', id, err);
    return Response.json({ error: 'AI summarization failed' }, { status: 500 });
  }
}
