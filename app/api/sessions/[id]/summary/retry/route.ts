import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSessionSummary, AI_FAILED_MARKER } from '@/lib/ai';
import { MACHINE_MAP } from '@/lib/machines';
import type { Instruction, PttChunk, Marker, PositionPing } from '@/types/socket';

/**
 * POST /api/sessions/:id/summary/retry
 *
 * Re-triggers AI summarization. Accepts sessions whose summary is null,
 * missing, or the __AI_FAILED__ sentinel. Returns the newly generated summary.
 *
 * NOTE: No auth gate — honor-system pattern used across this app.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || !session.endedAt) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const machine = MACHINE_MAP.get(session.machineId);
    const machineLabel = machine?.label ?? session.machineId;

    const instructionLog: Instruction[]  = session.instructionLog ? (JSON.parse(session.instructionLog) as Instruction[])  : [];
    const transcriptLog:  PttChunk[]     = session.transcriptLog  ? (JSON.parse(session.transcriptLog)  as PttChunk[])     : [];
    const markerLog:      Marker[]       = session.markerLog      ? (JSON.parse(session.markerLog)      as Marker[])       : [];
    const positionLog:    PositionPing[] = session.positionLog    ? (JSON.parse(session.positionLog)    as PositionPing[]) : [];

    const summary = await generateSessionSummary({
      machineLabel,
      instructionLog,
      transcriptLog,
      resolvedExpert:  session.resolvedExpert ?? null,
      resolvedWorker:  session.resolvedWorker ?? null,
      safetyTriggered: session.safetyTriggered,
      locationDept:    session.locationDept,
      locationLine:    session.locationLine,
      locationStation: session.locationStation,
      markers:         markerLog,
      positionLog:     positionLog,
      sessionStartMs:  session.startedAt.getTime(),
    });

    await prisma.session.update({ where: { id }, data: { summary } });

    return Response.json({ summary });
  } catch (err) {
    console.error('[api] summary/retry failed for session', id, err);
    // Write the failed sentinel so callers can detect the failure
    await prisma.session.update({
      where: { id },
      data:  { summary: AI_FAILED_MARKER },
    }).catch(() => { /* best-effort */ });
    return Response.json({ error: 'AI summarization failed' }, { status: 500 });
  }
}
