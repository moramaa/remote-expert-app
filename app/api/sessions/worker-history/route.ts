import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MACHINE_MAP } from '@/lib/machines';
import type { Marker, Instruction, PttChunk, PositionPing } from '@/types/socket';

export interface WorkerSessionDTO {
  sessionId:       string;
  machineId:       string;
  machineName:     string;
  summary:         string | null;
  durationSeconds: number;
  endedAt:         string;        // ISO date string
  startedAt:       string;        // ISO date string — needed for relative timestamps
  resolvedExpert:  boolean | null;
  resolvedWorker:  boolean | null;
  safetyTriggered: boolean;

  // ── Captured session content (regardless of AI status) ────────────────────
  locationDept:    string | null;
  locationLine:    string | null;
  locationStation: string | null;
  markers:         Array<{ id: string; label: string; sweepId?: string; floor?: number; timestamp: number }>;
  instructions:    Array<{ id: string; text: string; timestamp: number }>;
  pttCount:        number;
  // Stage 1: worker breadcrumb trail through 3D space
  positionLog:     Array<{ ts: number; sweepId: string; floor?: number }>;
}

function safeParseArray<T>(json: string | null): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

/**
 * GET /api/sessions/worker-history?workerId=...&limit=20
 *
 * Returns ALL ended sessions for a given worker, sorted newest-first.
 * Each entry includes the FULL captured content — markers, instructions,
 * location, and PTT count — even when the AI summary failed or is missing.
 * This guarantees the worker always sees their session data.
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
  });

  const dto: WorkerSessionDTO[] = sessions.map((s) => {
    const markers      = safeParseArray<Marker>(s.markerLog);
    const instructions = safeParseArray<Instruction>(s.instructionLog);
    const transcript   = safeParseArray<PttChunk>(s.transcriptLog);
    const positions    = safeParseArray<PositionPing>(s.positionLog);

    return {
      sessionId:       s.id,
      machineId:       s.machineId,
      machineName:     MACHINE_MAP.get(s.machineId)?.label ?? s.machineId,
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
