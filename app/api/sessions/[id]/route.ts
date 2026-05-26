import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/sessions/:id
 *
 * Permanently removes a session record. Called by the Administrator dashboard.
 *
 * NOTE: No auth gate (honor-system, matches rest of app). Real auth is
 * deferred to a future iteration — anyone who knows the URL can call this.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  try {
    await prisma.session.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      // Record not found — return 404
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }
    console.error('[api] DELETE session failed', id, err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}
