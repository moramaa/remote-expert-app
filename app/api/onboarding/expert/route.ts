import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const Schema = z.object({
  id:              z.string().uuid(),
  name:            z.string().min(1).max(100),
  yearsExperience: z.number().int().min(0).max(60),
  certifications:  z.array(z.string()).min(1),
  languages:       z.array(z.string().min(2).max(10)).min(1),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { isDemoId } = await import('@/lib/demo-data');
  if (isDemoId((body as Record<string, unknown>)?.id as string)) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id, name, yearsExperience, certifications, languages } = parsed.data;

  await prisma.expert.upsert({
    where:  { id },
    update: { name, yearsExperience, languages: JSON.stringify(languages) },
    create: { id, name, yearsExperience, languages: JSON.stringify(languages) },
  });

  // Replace certifications wholesale
  await prisma.expertCertification.deleteMany({ where: { expertId: id } });
  await prisma.expertCertification.createMany({
    data: certifications.map((machineId) => ({ expertId: id, machineId })),
  });

  return Response.json({ ok: true }, { status: 201 });
}
