import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface SuggestionDTO {
  sessionId: string;
  machineId: string;
  summary: string;
  durationSeconds: number;
  resolvedAt: string; // ISO date string
}

/**
 * GET /api/suggestions?machineId=krones_filler&limit=3
 *
 * Returns the most recent successfully-resolved sessions for a machine,
 * filtered to those that have a non-empty summary (usable for deflection).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const machineId = req.nextUrl.searchParams.get('machineId');
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '3', 10),
    5,
  );

  if (!machineId) {
    return Response.json({ error: 'machineId is required' }, { status: 400 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      machineId,
      endedAt:      { not: null },
      summary:      { not: null },
      // At least one party confirmed the issue was resolved
      OR: [
        { resolvedExpert: true },
        { resolvedWorker: true },
      ],
    },
    orderBy: { endedAt: 'desc' },
    take: limit,
    select: {
      id:              true,
      machineId:       true,
      summary:         true,
      durationSeconds: true,
      endedAt:         true,
    },
  });

  const dto: SuggestionDTO[] = sessions.map((s) => ({
    sessionId:       s.id,
    machineId:       s.machineId,
    summary:         s.summary ?? '',
    durationSeconds: s.durationSeconds ?? 0,
    resolvedAt:      (s.endedAt as Date).toISOString(),
  }));

  return Response.json(dto);
}
