/**
 * Seed the Machine table with the factory equipment catalog.
 * Run via: DATABASE_URL="file:./prisma/dev.db" npx tsx prisma/seed.ts
 */
import path from 'path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../app/generated/prisma/client';

const DB_URL: string =
  process.env['DATABASE_URL'] ??
  `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`;

const adapter = new PrismaBetterSqlite3({ url: DB_URL });
const prisma = new PrismaClient({ adapter });

const MACHINES = [
  { id: 'krones_filler',      label: 'Krones Filler',          vendor: 'Krones'  },
  { id: 'krones_labeler',     label: 'Krones Labeler',          vendor: 'Krones'  },
  { id: 'krones_conveyor',    label: 'Krones Conveyor System',  vendor: 'Krones'  },
  { id: 'siemens_s7_1500',    label: 'Siemens S7-1500 PLC',    vendor: 'Siemens' },
  { id: 'siemens_hmi_tp1200', label: 'Siemens HMI TP1200',     vendor: 'Siemens' },
  { id: 'siemens_et200sp',    label: 'Siemens ET 200SP',        vendor: 'Siemens' },
  { id: 'generic_compressor', label: 'Industrial Compressor',   vendor: 'Generic' },
  { id: 'generic_hvac',       label: 'HVAC System',             vendor: 'Generic' },
] as const;

async function main(): Promise<void> {
  console.log('[seed] Upserting machines…');
  for (const m of MACHINES) {
    await prisma.machine.upsert({
      where:  { id: m.id },
      update: { label: m.label, vendor: m.vendor },
      create: m,
    });
    console.log(`  ✓ ${m.label}`);
  }
  console.log('[seed] Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
