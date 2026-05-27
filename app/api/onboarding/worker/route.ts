import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const ROLE_LEVELS = ['junior_operator', 'maintenance', 'senior_operator'] as const;

const Schema = z.object({
  id:        z.string().uuid(),
  name:      z.string().min(1).max(100),
  factory:   z.string().min(1).max(200),
  roleLevel: z.enum(ROLE_LEVELS),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Demo IDs (e.g. "demo-worker-1") are not UUIDs — skip DB, return 201 immediately
  const { isDemoId } = await import('@/lib/demo-data');
  if (isDemoId((body as Record<string, unknown>)?.id as string)) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id, name, factory, roleLevel } = parsed.data;

  await prisma.worker.upsert({
    where:  { id },
    update: { name, factory, roleLevel },
    create: { id, name, factory, roleLevel },
  });

  return Response.json({ ok: true }, { status: 201 });
}
