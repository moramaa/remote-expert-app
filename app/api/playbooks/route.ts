import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface PlaybookDTO {
  id: string;
  machineId: string;
  machineName: string;
  name: string;
  steps: string[];
}

export async function GET(req: NextRequest): Promise<Response> {
  const machineId = req.nextUrl.searchParams.get('machineId') ?? undefined;

  const rows = await prisma.playbook.findMany({
    where: machineId ? { machineId } : undefined,
    include: { machine: { select: { label: true } } },
    orderBy: [{ machineId: 'asc' }, { name: 'asc' }],
  });

  const playbooks: PlaybookDTO[] = rows.map((r) => ({
    id: r.id,
    machineId: r.machineId,
    machineName: r.machine.label,
    name: r.name,
    steps: JSON.parse(r.steps) as string[],
  }));

  return Response.json(playbooks);
}
