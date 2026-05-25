import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type SummaryStatus = 'pending' | 'ready' | 'failed';

export interface SummaryStatusDTO {
  status:  SummaryStatus;
  summary: string | null;  // populated when status === 'ready'
}

/**
 * GET /api/sessions/:id/summary-status
 *
 * Lightweight polling endpoint called by the post-call confirmation screen.
 * Returns whether the AI summary has been generated, is still pending, or failed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where:  { id },
    select: { summary: true, endedAt: true },
  });

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  let status: SummaryStatus;
  if (session.summary === '__AI_FAILED__') {
    status = 'failed';
  } else if (session.summary !== null) {
    status = 'ready';
  } else {
    status = 'pending';
  }

  const dto: SummaryStatusDTO = {
    status,
    summary: status === 'ready' ? session.summary : null,
  };

  return Response.json(dto);
}
