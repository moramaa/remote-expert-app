import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const id   = searchParams.get('id');
  const role = searchParams.get('role');

  if (!id || !role) {
    return Response.json({ error: 'Missing id or role' }, { status: 400 });
  }

  if (role === 'expert') {
    const expert = await prisma.expert.findUnique({
      where: { id },
      include: { certifications: { include: { machine: true } } },
    });
    if (!expert) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(expert);
  }

  if (role === 'worker') {
    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(worker);
  }

  return Response.json({ error: 'Invalid role' }, { status: 400 });
}
