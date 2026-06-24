import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MACHINE_MAP } from '@/lib/machines';
import type { Marker, Instruction, PositionPing } from '@/types/socket';

/**
 * GET /api/sessions/:id
 *
 * Returns a rich session DTO used by the summary-status polling and retry
 * flows. Includes markers, instructions, pttCount, positionLog, and summary.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // ── Demo mode: serve static session data, no DB needed ──────────────────
  const { isDemoId, getDemoSession } = await import('@/lib/demo-data');
  if (isDemoId(id)) {
    const d = getDemoSession(id);
    if (!d) return Response.json({ error: 'Demo session not found' }, { status: 404 });
    return Response.json({
      sessionId:       d.sessionId,   machineId:       d.machineId,
      machineName:     d.machineName, startedAt:       d.startedAt,
      endedAt:         d.endedAt,     durationSeconds: d.durationSeconds,
      resolvedExpert:  d.resolvedExpert,  resolvedWorker:  d.resolvedWorker,
      safetyTriggered: d.safetyTriggered, locationDept:    d.locationDept,
      locationLine:    d.locationLine,    locationStation: d.locationStation,
      summary:         d.summary,    markers:         d.markers,
      instructions:    d.instructions,   pttCount:        d.pttCount,
      positionLog:     d.positionLog,
    });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || !session.endedAt) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const machine = MACHINE_MAP.get(session.machineId);
  const markerLog: Marker[]       = session.markerLog      ? (JSON.parse(session.markerLog)      as Marker[])       : [];
  const instrLog:  Instruction[]  = session.instructionLog ? (JSON.parse(session.instructionLog) as Instruction[])  : [];
  const posLog:    PositionPing[] = session.positionLog    ? (JSON.parse(session.positionLog)    as PositionPing[]) : [];
  const pttCount   = session.transcriptLog ? (JSON.parse(session.transcriptLog) as unknown[]).length : 0;

  return Response.json({
    sessionId:       session.id,
    machineId:       session.machineId,
    machineName:     machine?.label ?? session.machineId,
    startedAt:       session.startedAt.toISOString(),
    endedAt:         session.endedAt.toISOString(),
    durationSeconds: Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000),
    resolvedExpert:  session.resolvedExpert,
    resolvedWorker:  session.resolvedWorker,
    safetyTriggered: session.safetyTriggered,
    locationDept:    session.locationDept,
    locationLine:    session.locationLine,
    locationStation: session.locationStation,
    summary:         session.summary,
    markers:         markerLog,
    instructions:    instrLog,
    pttCount,
    positionLog:     posLog,
  });
}

/**
 * DELETE /api/sessions/:id
 *
 * Permanently removes a session record. Called by the Administrator dashboard.
 *
 * NOTE: No auth gate (honor-system, matches rest of app). Real auth is
 * deferred to a future iteration — anyone who knows the URL can call this.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  try {
    await prisma.session.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      // Record not found — return 404
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }
    console.error('[api] DELETE session failed', id, err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}
