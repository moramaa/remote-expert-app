import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MACHINE_MAP } from '@/lib/machines';

export interface WorkerSessionDTO {
  sessionId:       string;
  machineId:       string;
  machineName:     string;
  summary:         string | null;
  durationSeconds: number;
  endedAt:         string;        // ISO date string
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;
  hasMarkers:      boolean;
}

/**
 * GET /api/sessions/worker-history?workerId=...&limit=20
 *
 * Returns ALL ended sessions for a given worker, sorted by most-recent first.
 * Used by the worker's "Call History" page — shows every past session
 * regardless of whether an AI summary was generated.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const workerId = req.nextUrl.searchParams.get('workerId');
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10),
    50,
  );

  if (!workerId) {
    return Response.json({ error: 'workerId is required' }, { status: 400 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      workerId,
      endedAt: { not: null },
    },
    orderBy: { endedAt: 'desc' },
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
      markerLog:       true,
    },
  });

  const dto: WorkerSessionDTO[] = sessions.map((s) => ({
    sessionId:       s.id,
    machineId:       s.machineId,
    machineName:     MACHINE_MAP.get(s.machineId)?.label ?? s.machineId,
    summary:         s.summary ?? null,
    durationSeconds: s.durationSeconds ?? 0,
    endedAt:         (s.endedAt as Date).toISOString(),
    resolvedExpert:  s.resolvedExpert ?? null,
    resolvedWorker:  s.resolvedWorker ?? null,
    safetyTriggered: s.safetyTriggered,
    // Quick flag so UI can show "Show on 3D" without parsing JSON
    hasMarkers:      !!s.markerLog && s.markerLog !== '[]',
  }));

  return Response.json(dto);
}
