import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface SuggestionDTO {
  sessionId:       string;
  machineId:       string;
  summary:         string;
  durationSeconds: number;
  resolvedAt:      string; // ISO date string
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;
}

/**
 * GET /api/suggestions?machineId=krones_filler&limit=5
 *
 * Returns past sessions for a machine that have an AI-generated summary.
 * Includes both resolved AND unresolved sessions (worker UI applies visual
 * distinction). Resolved sessions are returned first.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const machineId = req.nextUrl.searchParams.get('machineId');
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '5', 10),
    10,
  );

  if (!machineId) {
    return Response.json({ error: 'machineId is required' }, { status: 400 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      machineId,
      endedAt: { not: null },
      summary: { not: null },
      // Exclude AI-failed stubs from worker-facing suggestions
      NOT: { summary: '__AI_FAILED__' },
    },
    orderBy: [
      // Resolved sessions first, then by most recent
      { resolvedExpert: 'desc' },
      { endedAt: 'desc' },
    ],
    take: limit,
    select: {
      id:              true,
      machineId:       true,
      summary:         true,
      durationSeconds: true,
      endedAt:         true,
      resolvedExpert:  true,
      resolvedWorker:  true,
      safetyTriggered: true,
    },
  });

  const dto: SuggestionDTO[] = sessions.map((s) => ({
    sessionId:       s.id,
    machineId:       s.machineId,
    summary:         s.summary ?? '',
    durationSeconds: s.durationSeconds ?? 0,
    resolvedAt:      (s.endedAt as Date).toISOString(),
    resolvedExpert:  s.resolvedExpert ?? null,
    resolvedWorker:  s.resolvedWorker ?? null,
    safetyTriggered: s.safetyTriggered,
  }));

  return Response.json(dto);
}
