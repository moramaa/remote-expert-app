import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MACHINE_MAP } from '@/lib/machines';
import type { Marker } from '@/types/socket';

/**
 * GET /api/sessions/:id/markers
 *
 * Returns the marker snapshot captured at session end, used by the worker
 * "Show on 3D" preview mode to render historical annotations on the model.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id:        true,
      machineId: true,
      markerLog: true,
    },
  });

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const markers: Marker[] = session.markerLog
    ? (JSON.parse(session.markerLog) as Marker[])
    : [];

  const machine = MACHINE_MAP.get(session.machineId);

  return Response.json({
    sessionId:   session.id,
    machineId:   session.machineId,
    machineName: machine?.label ?? session.machineId,
    markers,
  });
}
