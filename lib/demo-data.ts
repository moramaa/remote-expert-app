/**
 * lib/demo-data.ts — Static demo dataset for Vercel / no-database deployments.
 *
 * When a request comes in for a user whose ID starts with "demo-",
 * every API route returns data from this file instead of hitting SQLite.
 * This makes the app fully presentable on Vercel without any backend.
 *
 * Pre-defined personas
 * ─────────────────────
 *  Worker   → id: "demo-worker-1"   name: "Yossi Cohen"
 *  Expert   → id: "demo-expert-1"   name: "Dr. Sarah Levi"
 *  Admin    → id: "demo-admin-1"    name: "Admin"
 */

import type { WorkerSessionDTO } from '@/app/api/sessions/worker-history/route';
import type { AdminSessionDTO }  from '@/app/api/sessions/all/route';

// ── Identity ──────────────────────────────────────────────────────────────────

export const DEMO_WORKER_ID    = 'demo-worker-1';
export const DEMO_EXPERT_ID    = 'demo-expert-1';
export const DEMO_ADMIN_ID     = 'demo-admin-1';
export const DEMO_WORKER_NAME  = 'Yossi Cohen';
export const DEMO_EXPERT_NAME  = 'Dr. Sarah Levi';

/** True for any ID that belongs to the static demo dataset. */
export function isDemoId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('demo-');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number, offsetMinutes = 0): string {
  const d = new Date(Date.now() - n * 86_400_000 - offsetMinutes * 60_000);
  return d.toISOString();
}

// ── Session fixtures ──────────────────────────────────────────────────────────

export const DEMO_SESSIONS: WorkerSessionDTO[] = [
  // ── 1 ── Krones Filler — valve actuator fault (resolved, recent) ─────────
  {
    sessionId:       'demo-session-1',
    machineId:       'krones_filler',
    machineName:     'Krones Filler',
    summary:         null,
    durationSeconds: 487,
    startedAt:       daysAgo(1, 10),
    endedAt:         daysAgo(1),
    resolvedExpert:  true,
    resolvedWorker:  true,
    safetyTriggered: false,
    locationDept:    'Filling',
    locationLine:    'Line B',
    locationStation: 'Station 3',
    markers: [
      { id: 'dm1-a', label: 'Valve Actuator Block B', timestamp: Date.now() - 86_400_000 - 480_000 },
      { id: 'dm1-b', label: 'O-Ring Seal on Valve 4', timestamp: Date.now() - 86_400_000 - 360_000 },
      { id: 'dm1-c', label: 'Pressure Gauge P-07',    timestamp: Date.now() - 86_400_000 - 240_000 },
    ],
    instructions: [
      { id: 'di1-1', text: 'Shut off the feed line upstream of valve 4 before proceeding.',        timestamp: Date.now() - 86_400_000 - 460_000 },
      { id: 'di1-2', text: 'Remove the actuator cap and inspect the O-ring for cracking or wear.', timestamp: Date.now() - 86_400_000 - 350_000 },
      { id: 'di1-3', text: 'Replace the O-ring with a size-22 from the spares cabinet.',           timestamp: Date.now() - 86_400_000 - 300_000 },
      { id: 'di1-4', text: 'Re-pressurize slowly and confirm no leak at the base of the actuator.', timestamp: Date.now() - 86_400_000 - 120_000 },
    ],
    pttCount:   6,
    positionLog: [
      { ts: Date.now() - 86_400_000 - 480_000, sweepId: 'sweep-fill-1', floor: 0 },
      { ts: Date.now() - 86_400_000 - 400_000, sweepId: 'sweep-fill-2', floor: 0 },
    ],
  },

  // ── 2 ── Siemens S7-1500 PLC — comm fault (safety triggered, resolved) ───
  {
    sessionId:       'demo-session-2',
    machineId:       'siemens_s7_1500',
    machineName:     'Siemens S7-1500 PLC',
    summary:         null,
    durationSeconds: 723,
    startedAt:       daysAgo(3, 15),
    endedAt:         daysAgo(3),
    resolvedExpert:  false,
    resolvedWorker:  true,
    safetyTriggered: true,
    locationDept:    'Control Room',
    locationLine:    'Line A',
    locationStation: 'PLC Cabinet 2',
    markers: [
      { id: 'dm2-a', label: 'CM 1542-1 Communication Module', timestamp: Date.now() - 3 * 86_400_000 - 700_000 },
      { id: 'dm2-b', label: 'Profinet Cable Port X1P1',        timestamp: Date.now() - 3 * 86_400_000 - 600_000 },
    ],
    instructions: [
      { id: 'di2-1', text: 'Open TIA Portal and check the Device Diagnostics for CM 1542-1.', timestamp: Date.now() - 3 * 86_400_000 - 680_000 },
      { id: 'di2-2', text: 'Confirm the Profinet cable on port X1P1 is firmly seated — re-seat if necessary.', timestamp: Date.now() - 3 * 86_400_000 - 580_000 },
      { id: 'di2-3', text: 'If fault persists, replace the CM module from the spare rack.', timestamp: Date.now() - 3 * 86_400_000 - 300_000 },
    ],
    pttCount:   9,
    positionLog: [
      { ts: Date.now() - 3 * 86_400_000 - 700_000, sweepId: 'sweep-plc-1', floor: 1 },
    ],
  },

  // ── 3 ── Krones Conveyor — jam sensor (unresolved) ───────────────────────
  {
    sessionId:       'demo-session-3',
    machineId:       'krones_conveyor',
    machineName:     'Krones Conveyor System',
    summary:         null,
    durationSeconds: 312,
    startedAt:       daysAgo(5, 8),
    endedAt:         daysAgo(5),
    resolvedExpert:  false,
    resolvedWorker:  false,
    safetyTriggered: false,
    locationDept:    'Packaging',
    locationLine:    'Line C',
    locationStation: null,
    markers: [
      { id: 'dm3-a', label: 'Jam Sensor J-04', timestamp: Date.now() - 5 * 86_400_000 - 300_000 },
    ],
    instructions: [
      { id: 'di3-1', text: 'Check sensor J-04 for physical obstruction or coating from spilled product.', timestamp: Date.now() - 5 * 86_400_000 - 290_000 },
      { id: 'di3-2', text: 'Clean the sensor face with isopropyl alcohol and re-test.', timestamp: Date.now() - 5 * 86_400_000 - 200_000 },
    ],
    pttCount:   4,
    positionLog: [],
  },

  // ── 4 ── Krones Labeler — label misalignment (resolved) ─────────────────
  {
    sessionId:       'demo-session-4',
    machineId:       'krones_labeler',
    machineName:     'Krones Labeler',
    summary:         null,
    durationSeconds: 391,
    startedAt:       daysAgo(8, 7),
    endedAt:         daysAgo(8),
    resolvedExpert:  true,
    resolvedWorker:  null,
    safetyTriggered: false,
    locationDept:    'Labeling',
    locationLine:    'Line B',
    locationStation: 'Station 1',
    markers: [
      { id: 'dm4-a', label: 'Label Web Guide Sensor', timestamp: Date.now() - 8 * 86_400_000 - 380_000 },
      { id: 'dm4-b', label: 'Pitch Adjustment Knob',  timestamp: Date.now() - 8 * 86_400_000 - 280_000 },
    ],
    instructions: [
      { id: 'di4-1', text: 'Jog the machine slowly and observe the label feed at the web guide sensor.',    timestamp: Date.now() - 8 * 86_400_000 - 370_000 },
      { id: 'di4-2', text: 'Adjust the pitch knob clockwise by 2 clicks until the leading edge aligns.',    timestamp: Date.now() - 8 * 86_400_000 - 270_000 },
    ],
    pttCount:   3,
    positionLog: [],
  },

  // ── 5 ── Industrial Compressor — pressure drop (resolved, older) ─────────
  {
    sessionId:       'demo-session-5',
    machineId:       'generic_compressor',
    machineName:     'Industrial Compressor',
    summary:         null,
    durationSeconds: 921,
    startedAt:       daysAgo(14, 20),
    endedAt:         daysAgo(14),
    resolvedExpert:  true,
    resolvedWorker:  true,
    safetyTriggered: false,
    locationDept:    'Utilities',
    locationLine:    null,
    locationStation: 'Compressor Room',
    markers: [
      { id: 'dm5-a', label: 'Air Filter Assembly', timestamp: Date.now() - 14 * 86_400_000 - 900_000 },
    ],
    instructions: [
      { id: 'di5-1', text: 'Shut down the compressor and lock out / tag out per procedure UT-003.', timestamp: Date.now() - 14 * 86_400_000 - 890_000 },
      { id: 'di5-2', text: 'Remove and inspect the air filter — replace if the pressure drop indicator is in the red zone.', timestamp: Date.now() - 14 * 86_400_000 - 750_000 },
    ],
    pttCount:   11,
    positionLog: [
      { ts: Date.now() - 14 * 86_400_000 - 900_000, sweepId: 'sweep-util-1', floor: 0 },
      { ts: Date.now() - 14 * 86_400_000 - 800_000, sweepId: 'sweep-util-2', floor: 0 },
      { ts: Date.now() - 14 * 86_400_000 - 600_000, sweepId: 'sweep-util-3', floor: 0 },
    ],
  },
];

// ── Admin view (same sessions, with worker + expert identity) ─────────────────

export const DEMO_ADMIN_SESSIONS: AdminSessionDTO[] = DEMO_SESSIONS.map((s) => ({
  ...s,
  workerId:   DEMO_WORKER_ID,
  workerName: DEMO_WORKER_NAME,
  expertId:   DEMO_EXPERT_ID,
}));

// ── Single-session lookup ─────────────────────────────────────────────────────

export function getDemoSession(sessionId: string): WorkerSessionDTO | undefined {
  return DEMO_SESSIONS.find((s) => s.sessionId === sessionId);
}

// ── /api/me response shapes ───────────────────────────────────────────────────

export const DEMO_WORKER_PROFILE = {
  id:          DEMO_WORKER_ID,
  name:        DEMO_WORKER_NAME,
  factoryName: 'AutoPlant Tel Aviv',
  createdAt:   new Date(Date.now() - 90 * 86_400_000).toISOString(),
};

export const DEMO_EXPERT_PROFILE = {
  id:        DEMO_EXPERT_ID,
  name:      DEMO_EXPERT_NAME,
  createdAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
  certifications: [
    { machine: { id: 'krones_filler',      label: 'Krones Filler',         vendor: 'Krones'  } },
    { machine: { id: 'krones_labeler',     label: 'Krones Labeler',        vendor: 'Krones'  } },
    { machine: { id: 'krones_conveyor',    label: 'Krones Conveyor System',vendor: 'Krones'  } },
    { machine: { id: 'siemens_s7_1500',    label: 'Siemens S7-1500 PLC',  vendor: 'Siemens' } },
    { machine: { id: 'generic_compressor', label: 'Industrial Compressor', vendor: 'Generic' } },
  ],
};

export const DEMO_ADMIN_PROFILE = {
  id:        DEMO_ADMIN_ID,
  name:      'Admin',
  createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
};
