/**
 * Mock data seed — inserts 3 realistic Krones Filler sessions.
 * Run with:  npx tsx prisma/seed-mock.ts
 */

import path from 'path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../app/generated/prisma/client';

const adapter = new PrismaBetterSqlite3({
  url: `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`,
});
const prisma = new PrismaClient({ adapter });

const WORKER_ID = 'demo-worker-0000-0000-000000000001';
const EXPERT_ID = 'demo-expert-0000-0000-000000000001';
const MACHINE_ID = 'krones_filler';

const NOW = Date.now();
const DAY = 86_400_000;

async function main() {
  // ── Session 1: Resolved with safety trigger (3 days ago) ──────────────────
  await prisma.session.upsert({
    where:  { id: 'mock-session-krones-001' },
    update: {},
    create: {
      id:              'mock-session-krones-001',
      ticketId:        'mock-ticket-krones-001',
      expertId:        EXPERT_ID,
      workerId:        WORKER_ID,
      machineId:       MACHINE_ID,
      startedAt:       new Date(NOW - 3 * DAY - 900_000),
      endedAt:         new Date(NOW - 3 * DAY),
      durationSeconds: 847,
      resolvedExpert:  true,
      resolvedWorker:  true,
      safetyTriggered: true,
      locationDept:    'Filling Hall',
      locationLine:    'Line 2',
      locationStation: 'Station 4',
      summary: `⚠️ Safety Warning: The filler head carousel exhibited unexpected rotation during a manual override attempt, posing a risk of entanglement near the starwheel assembly. All personnel were cleared from the zone before proceeding.

Problem Statement: The Krones Filler on Line 2 stopped mid-cycle with error code F-1042 (filler valve actuator fault) after a container jam at station 4. The machine refused to restart due to a locked safety interlock on the starwheel entry sensor.

Execution Steps:
1. Expert confirmed machine was in E-Stop state and cleared the container jam at starwheel entry.
2. Emergency freeze activated while clearing debris from valve actuator block B.
3. Actuator block B manually reset using maintenance mode; fault code F-1042 cleared.
4. Expert guided worker to inspect O-ring seal on valve 4 — seal was visibly degraded.
5. Worker replaced O-ring seal from maintenance kit (part #KR-4401-OR).
6. Machine restarted in single-cycle test mode; all 8 filling heads confirmed operational.
7. Production resumed at reduced speed (70%) for 15 minutes before returning to full rate.`,
      markerLog: JSON.stringify([
        {
          id: 'mock-marker-001', label: 'Valve Actuator Block B',
          x: 1.24, y: 0.91, z: -0.33,
          nx: 0, ny: 1, nz: 0,
          timestamp: NOW - 3 * DAY - 780_000,
        },
        {
          id: 'mock-marker-002', label: 'Starwheel Entry Sensor',
          x: 0.82, y: 1.15, z: 0.11,
          nx: -1, ny: 0, nz: 0,
          timestamp: NOW - 3 * DAY - 720_000,
        },
        {
          id: 'mock-marker-003', label: 'O-Ring on Valve 4',
          x: 1.56, y: 0.78, z: -0.44,
          nx: 0, ny: 0, nz: 1,
          timestamp: NOW - 3 * DAY - 560_000,
        },
      ]),
      instructionLog: JSON.stringify([
        { id: 'mock-instr-001', text: 'First, confirm the machine is in full E-Stop and the HMI shows fault F-1042.', timestamp: NOW - 3 * DAY - 820_000 },
        { id: 'mock-instr-002', text: 'Open the starwheel guard and manually remove the jammed container. Do NOT power up yet.', timestamp: NOW - 3 * DAY - 790_000 },
        { id: 'mock-instr-003', text: 'Navigate to maintenance mode on the HMI — code 1-1-3 — and trigger actuator reset on block B.', timestamp: NOW - 3 * DAY - 680_000 },
        { id: 'mock-instr-004', text: 'Inspect the O-ring on valve 4. If it looks flat or cracked, replace it from the on-site spare kit.', timestamp: NOW - 3 * DAY - 590_000 },
        { id: 'mock-instr-005', text: 'Run a single-cycle test before returning to full production speed.', timestamp: NOW - 3 * DAY - 310_000 },
      ]),
      transcriptLog: JSON.stringify([
        { id: 'mock-ptt-001', speakerId: WORKER_ID, text: 'I can see the jam — there is a crushed bottle stuck between the starwheel and the conveyor belt.', startTs: NOW - 3 * DAY - 800_000, endTs: NOW - 3 * DAY - 796_000 },
        { id: 'mock-ptt-002', speakerId: EXPERT_ID, text: 'Good. Clear it out and tell me what the sensor light shows once you close the guard.', startTs: NOW - 3 * DAY - 760_000, endTs: NOW - 3 * DAY - 755_000 },
        { id: 'mock-ptt-003', speakerId: WORKER_ID, text: 'The O-ring is definitely cracked — it is almost flat. I have a spare in the kit.', startTs: NOW - 3 * DAY - 600_000, endTs: NOW - 3 * DAY - 596_000 },
        { id: 'mock-ptt-004', speakerId: EXPERT_ID, text: 'Perfect. Replace it now and re-run the single cycle test before ramping speed back up.', startTs: NOW - 3 * DAY - 560_000, endTs: NOW - 3 * DAY - 556_000 },
      ]),
    },
  });
  console.log('✅  Session 1 inserted: Krones Filler — Resolved (safety)');

  // ── Session 2: Unresolved (6 days ago) ────────────────────────────────────
  await prisma.session.upsert({
    where:  { id: 'mock-session-krones-002' },
    update: {},
    create: {
      id:              'mock-session-krones-002',
      ticketId:        'mock-ticket-krones-002',
      expertId:        EXPERT_ID,
      workerId:        WORKER_ID,
      machineId:       MACHINE_ID,
      startedAt:       new Date(NOW - 6 * DAY - 234_000),
      endedAt:         new Date(NOW - 6 * DAY),
      durationSeconds: 234,
      resolvedExpert:  false,
      resolvedWorker:  false,
      safetyTriggered: false,
      locationDept:    'Filling Hall',
      locationLine:    'Line 2',
      locationStation: 'Station 4',
      summary: `❗ Note: This historical session did not fully resolve the issue, but is provided to show context on previously attempted steps.

Problem Statement: The Krones Filler displayed intermittent communication errors (code C-0091) between the filler PLC and the central SCADA system. The errors caused random 2–3 second pauses during filling cycles, reducing throughput by approximately 12%.

Execution Steps:
1. Expert checked the Ethernet cable connection at the PLC cabinet — cable appeared intact.
2. Worker power-cycled the PLC communication module (CM 1542-1) without effect.
3. Expert remotely reviewed SCADA logs; found repeated CRC errors on port 4.
4. Attempted to switch to the backup network port — errors persisted on backup port.
5. Session ended without resolution; issue requires on-site network engineer inspection of the patch panel.`,
      markerLog: JSON.stringify([
        {
          id: 'mock-marker-004', label: 'PLC Communication Module CM 1542-1',
          x: -0.45, y: 1.30, z: 0.22,
          nx: 0, ny: 0, nz: -1,
          timestamp: NOW - 6 * DAY - 200_000,
        },
      ]),
      instructionLog: JSON.stringify([
        { id: 'mock-instr-006', text: 'Check the Ethernet cable on the PLC cabinet door — look for bends or crimps near the connector.', timestamp: NOW - 6 * DAY - 220_000 },
        { id: 'mock-instr-007', text: 'Power-cycle the CM 1542-1 module by toggling the switch on its left side.', timestamp: NOW - 6 * DAY - 180_000 },
        { id: 'mock-instr-008', text: 'Switch the active port selector from Port 1 to Port 2 on the patch panel.', timestamp: NOW - 6 * DAY - 90_000 },
      ]),
      transcriptLog: JSON.stringify([
        { id: 'mock-ptt-005', speakerId: WORKER_ID, text: 'The cable looks fine from here, no visible damage. Still getting the C-0091 every few seconds.', startTs: NOW - 6 * DAY - 210_000, endTs: NOW - 6 * DAY - 206_000 },
        { id: 'mock-ptt-006', speakerId: EXPERT_ID, text: 'The SCADA log shows CRC errors on port 4 specifically. We will need a network engineer to check the patch panel physically.', startTs: NOW - 6 * DAY - 70_000, endTs: NOW - 6 * DAY - 66_000 },
      ]),
    },
  });
  console.log('✅  Session 2 inserted: Krones Filler — Unresolved (network fault)');

  // ── Session 3: Resolved, recent (yesterday) ────────────────────────────────
  await prisma.session.upsert({
    where:  { id: 'mock-session-krones-003' },
    update: {},
    create: {
      id:              'mock-session-krones-003',
      ticketId:        'mock-ticket-krones-003',
      expertId:        EXPERT_ID,
      workerId:        WORKER_ID,
      machineId:       MACHINE_ID,
      startedAt:       new Date(NOW - DAY - 1_205_000),
      endedAt:         new Date(NOW - DAY),
      durationSeconds: 1205,
      resolvedExpert:  true,
      resolvedWorker:  true,
      safetyTriggered: false,
      locationDept:    'Filling Hall',
      locationLine:    'Line 2',
      locationStation: 'Station 4',
      summary: `Problem Statement: The Krones Filler began over-filling bottles by 4–6 ml consistently after a scheduled preventive maintenance shift, indicating a miscalibration of the filling volume setpoint on heads 3 and 7.

Execution Steps:
1. Expert identified the deviation via the HMI fill-volume trend chart — heads 3 and 7 showed systematic overshoot.
2. Worker accessed the Volume Calibration menu (HMI → Machine Settings → Volume Cal.).
3. Expert guided worker to run a 10-bottle test fill and weigh a sample using the inline checkweigher.
4. Confirmed 5 ml overfill on head 3 and 4 ml overfill on head 7; adjusted setpoints down accordingly.
5. Ran a second 10-bottle verification fill — checkweigher readings within ±0.5 ml tolerance.
6. Worker documented the new setpoints in the maintenance log as per SOP-F-04.`,
      markerLog: JSON.stringify([
        {
          id: 'mock-marker-005', label: 'Filling Head 3',
          x: 0.60, y: 1.05, z: -0.10,
          nx: 0, ny: 1, nz: 0,
          timestamp: NOW - DAY - 1_100_000,
        },
        {
          id: 'mock-marker-006', label: 'Filling Head 7',
          x: 1.40, y: 1.05, z: -0.10,
          nx: 0, ny: 1, nz: 0,
          timestamp: NOW - DAY - 1_050_000,
        },
        {
          id: 'mock-marker-007', label: 'Volume Calibration HMI Panel',
          x: -0.20, y: 1.60, z: 0.30,
          nx: 1, ny: 0, nz: 0,
          timestamp: NOW - DAY - 980_000,
        },
      ]),
      instructionLog: JSON.stringify([
        { id: 'mock-instr-009', text: 'Open the HMI trend chart for fill volume. Look for heads consistently above the 330 ml setpoint.', timestamp: NOW - DAY - 1_150_000 },
        { id: 'mock-instr-010', text: 'Navigate to: Machine Settings → Volume Calibration → Head Selection.', timestamp: NOW - DAY - 1_050_000 },
        { id: 'mock-instr-011', text: 'Run a 10-bottle test sequence and bring the first 3 samples to the inline checkweigher.', timestamp: NOW - DAY - 950_000 },
        { id: 'mock-instr-012', text: 'For head 3: reduce setpoint by 5.0 ml. For head 7: reduce by 4.0 ml. Confirm on screen.', timestamp: NOW - DAY - 700_000 },
        { id: 'mock-instr-013', text: 'Run a second 10-bottle verification run. All readings should be within ±0.5 ml.', timestamp: NOW - DAY - 450_000 },
        { id: 'mock-instr-014', text: 'Record the new setpoints in the maintenance log under SOP-F-04 before leaving the station.', timestamp: NOW - DAY - 120_000 },
      ]),
      transcriptLog: JSON.stringify([
        { id: 'mock-ptt-007', speakerId: WORKER_ID, text: 'The trend shows heads 3 and 7 are definitely filling more — the line is a bit above the others.', startTs: NOW - DAY - 1_140_000, endTs: NOW - DAY - 1_136_000 },
        { id: 'mock-ptt-008', speakerId: EXPERT_ID, text: 'That matches what I suspected after the PM shift. Let us go into Volume Calibration and run a test batch.', startTs: NOW - DAY - 1_100_000, endTs: NOW - DAY - 1_096_000 },
        { id: 'mock-ptt-009', speakerId: WORKER_ID, text: 'Checkweigher shows 335.2 on head 3, and 334.1 on head 7. Both supposed to be 330.', startTs: NOW - DAY - 900_000, endTs: NOW - DAY - 896_000 },
        { id: 'mock-ptt-010', speakerId: EXPERT_ID, text: 'Good numbers. Drop head 3 by 5 ml and head 7 by 4 ml in the setpoint fields.', startTs: NOW - DAY - 720_000, endTs: NOW - DAY - 716_000 },
        { id: 'mock-ptt-011', speakerId: WORKER_ID, text: 'Second run looks great — 330.4, 330.1, and 329.9. All well within tolerance.', startTs: NOW - DAY - 400_000, endTs: NOW - DAY - 396_000 },
      ]),
    },
  });
  console.log('✅  Session 3 inserted: Krones Filler — Resolved (volume calibration)');

  console.log('\n🎉  Mock seed complete. 3 Krones Filler sessions ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
