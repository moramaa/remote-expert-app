import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const id   = searchParams.get('id');
  const role = searchParams.get('role');

  if (!id || !role) {
    return Response.json({ error: 'Missing id or role' }, { status: 400 });
  }

  // ── Demo mode: return static profile, no DB needed ───────────────────────
  const {
    isDemoId, DEMO_WORKER_PROFILE, DEMO_EXPERT_PROFILE, DEMO_ADMIN_PROFILE,
  } = await import('@/lib/demo-data');
  if (isDemoId(id)) {
    if (role === 'worker')        return Response.json(DEMO_WORKER_PROFILE);
    if (role === 'expert')        return Response.json(DEMO_EXPERT_PROFILE);
    if (role === 'administrator') return Response.json(DEMO_ADMIN_PROFILE);
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

  if (role === 'administrator') {
    const admin = await prisma.administrator.findUnique({ where: { id } });
    if (!admin) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(admin);
  }

  return Response.json({ error: 'Invalid role' }, { status: 400 });
}
