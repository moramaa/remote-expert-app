import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MACHINE_MAP } from '@/lib/machines';
import type { Marker, Instruction, PttChunk, PositionPing } from '@/types/socket';

export interface AdminSessionDTO {
  sessionId:       string;
  machineId:       string;
  machineName:     string;
  workerId:        string;
  workerName:      string;
  expertId:        string;
  summary:         string | null;
  durationSeconds: number;
  endedAt:         string;
  startedAt:       string;
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;

  // Captured session content
  locationDept:    string | null;
  locationLine:    string | null;
  locationStation: string | null;
  markers:         Array<{ id: string; label: string; sweepId?: string; floor?: number; timestamp: number }>;
  instructions:    Array<{ id: string; text: string; timestamp: number }>;
  pttCount:        number;
  positionLog:     Array<{ ts: number; sweepId: string; floor?: number }>;
}

function safeParseArray<T>(json: string | null): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

/**
 * GET /api/sessions/all?limit=50
 *
 * Returns ALL ended sessions across all workers/experts/machines, sorted
 * newest-first. Used by the Administrator dashboard.
 *
 * NOTE: No auth gate. The honor-system pattern matches the rest of the app —
 * real auth is deferred to a future iteration.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10),
    200,
  );

  // ── Demo mode: return static fixture data, no DB needed ──────────────────
  const { DEMO_ADMIN_SESSIONS } = await import('@/lib/demo-data');
  const userId = req.nextUrl.searchParams.get('userId') ?? '';
  if (!userId || userId.startsWith('demo-')) {
    return Response.json(DEMO_ADMIN_SESSIONS);
  }

  const sessions = await prisma.session.findMany({
    where:   { endedAt: { not: null } },
    orderBy: { endedAt: 'desc' },
    take:    limit,
  });

  // Resolve worker names in one batch query
  const workerIds = Array.from(new Set(sessions.map((s) => s.workerId)));
  const workers = await prisma.worker.findMany({
    where:  { id: { in: workerIds } },
    select: { id: true, name: true },
  });
  const workerNameMap = new Map(workers.map((w) => [w.id, w.name]));

  const dto: AdminSessionDTO[] = sessions.map((s) => {
    const markers      = safeParseArray<Marker>(s.markerLog);
    const instructions = safeParseArray<Instruction>(s.instructionLog);
    const transcript   = safeParseArray<PttChunk>(s.transcriptLog);
    const positions    = safeParseArray<PositionPing>(s.positionLog);

    return {
      sessionId:       s.id,
      machineId:       s.machineId,
      machineName:     MACHINE_MAP.get(s.machineId)?.label ?? s.machineId,
      workerId:        s.workerId,
      workerName:      workerNameMap.get(s.workerId) ?? `Worker ${s.workerId.slice(0, 8)}`,
      expertId:        s.expertId,
      summary:         s.summary ?? null,
      durationSeconds: s.durationSeconds ?? 0,
      endedAt:         (s.endedAt as Date).toISOString(),
      startedAt:       s.startedAt.toISOString(),
      resolvedExpert:  s.resolvedExpert ?? null,
      resolvedWorker:  s.resolvedWorker ?? null,
      safetyTriggered: s.safetyTriggered,
      locationDept:    s.locationDept    ?? null,
      locationLine:    s.locationLine    ?? null,
      locationStation: s.locationStation ?? null,
      markers:         markers.map((m) => ({
        id: m.id, label: m.label ?? 'Unlabeled marker',
        sweepId: m.sweepId, floor: m.floor, timestamp: m.timestamp,
      })),
      instructions:    instructions.map((i) => ({ id: i.id, text: i.text, timestamp: i.timestamp })),
      pttCount:        transcript.length,
      positionLog:     positions.map((p) => ({ ts: p.ts, sweepId: p.sweepId, floor: p.floor })),
    };
  });

  return Response.json(dto);
}
