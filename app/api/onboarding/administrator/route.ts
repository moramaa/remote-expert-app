import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const Schema = z.object({
  id:   z.string().uuid(),
  name: z.string().min(1).max(100),
});

/**
 * POST /api/onboarding/administrator
 *
 * Upsert an Administrator profile. Identical pattern to /api/onboarding/worker —
 * the id is the client's localStorage UUID.
 *
 * NOTE: No server-side auth gates exist anywhere on this app (honor system).
 * Anyone can call this. Real auth is deferred to a future iteration.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id, name } = parsed.data;

  await prisma.administrator.upsert({
    where:  { id },
    update: { name },
    create: { id, name },
  });

  return Response.json({ ok: true }, { status: 201 });
}
