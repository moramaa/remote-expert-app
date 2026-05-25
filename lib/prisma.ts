/**
 * Singleton Prisma Client for Next.js.
 *
 * Prisma 7 uses the WASM query engine and requires a driver adapter.
 * We use @prisma/adapter-better-sqlite3 for local SQLite.
 *
 * The singleton pattern prevents connection pool exhaustion during HMR in dev.
 */
import path from 'path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../app/generated/prisma/client';

const DB_URL: string =
  process.env['DATABASE_URL'] ??
  `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`;

function makePrisma(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: DB_URL });
  return new PrismaClient({ adapter });
}

// Keep one instance in development to survive HMR reloads.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ?? makePrisma();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}
