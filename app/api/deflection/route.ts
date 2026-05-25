import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

interface DeflectionPayload {
  workerId:           string;
  machineId:          string;
  suggestedSessionId: string | null;
  outcome:            'solved' | 'unsolved';
}

/**
 * POST /api/deflection
 *
 * Logs a deflection event — whether a past-session suggestion resolved the
 * worker's issue ("solved") or they still needed a live expert ("unsolved").
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: DeflectionPayload;
  try {
    body = (await req.json()) as DeflectionPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workerId, machineId, suggestedSessionId, outcome } = body;

  if (!workerId || !machineId || !outcome) {
    return Response.json({ error: 'workerId, machineId, and outcome are required' }, { status: 400 });
  }
  if (outcome !== 'solved' && outcome !== 'unsolved') {
    return Response.json({ error: 'outcome must be "solved" or "unsolved"' }, { status: 400 });
  }

  const event = await prisma.deflectionEvent.create({
    data: {
      workerId,
      machineId,
      suggestedSessionId: suggestedSessionId ?? null,
      outcome,
    },
  });

  return Response.json({ id: event.id, outcome: event.outcome });
}
