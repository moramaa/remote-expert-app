/**
 * server.ts — Production custom server for Railway deployment.
 *
 * Runs Next.js and Socket.IO on the same HTTP server / single port so that
 * Railway only needs to expose one URL.  The Socket.IO client in the browser
 * connects to window.location.origin (no separate port required).
 *
 * Usage:
 *   npm run start          # triggered by Railway after `npm run build`
 *
 * Local dev still uses `npm run dev` (concurrently: next dev + tsx server/index.ts).
 */

// Load env files before anything else (same order as server/index.ts)
import dotenv from 'dotenv';
dotenv.config({ path: '.env',       override: true });
dotenv.config({ path: '.env.local', override: false });

import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket';
import { registerHandlers } from './server/index';

const PORT    = parseInt(process.env['PORT'] ?? '3000', 10);
const dev     = process.env['NODE_ENV'] !== 'production';

// CORS: in production accept all origins (the Railway URL is the same host).
// Set ALLOWED_ORIGINS to a comma-separated list to restrict.
const corsOrigin: string | string[] = process.env['ALLOWED_ORIGINS']
  ? process.env['ALLOWED_ORIGINS'].split(',').map((s) => s.trim())
  : '*';

async function main(): Promise<void> {
  const app    = next({ dev, port: PORT });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    // Use the same path as the default so existing clients need no changes
    path: '/socket.io/',
  });

  registerHandlers(io);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`> FieldSync ready on http://0.0.0.0:${PORT} (${dev ? 'dev' : 'production'})`);
  });
}

main().catch((err) => {
  console.error('Fatal: server failed to start', err);
  process.exit(1);
});
