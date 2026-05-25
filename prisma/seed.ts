/**
 * Seed the Machine table with the factory equipment catalog,
 * and Playbook table with pre-defined step-by-step resolution scripts.
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

const PLAYBOOKS: Array<{ machineId: string; name: string; steps: string[] }> = [
  {
    machineId: 'krones_filler',
    name: 'Filler Not Starting — Standard Restart',
    steps: [
      'Verify inlet valve is fully open (green indicator on panel)',
      'Check inlet pressure gauge — must read ≥ 2.5 bar',
      'Press RESET on the filler HMI touch panel',
      'Confirm all safety guards are closed and latched',
      'Press START and observe the fill cycle begins within 10 seconds',
    ],
  },
  {
    machineId: 'krones_filler',
    name: 'Overfill Alarm — Level Sensor Check',
    steps: [
      'Press STOP to halt the filler immediately',
      'Navigate to HMI → Diagnostics → Level Sensors',
      'Confirm sensor S3 reading matches physical fill level in bowl',
      'If sensor reads HIGH while bowl is empty, clean the sensor head with isopropyl alcohol',
      'Recalibrate sensor via HMI → Calibration → Bowl Level → Auto-Cal',
      'Press START and monitor for 3 fill cycles',
    ],
  },
  {
    machineId: 'krones_labeler',
    name: 'Label Misalignment — Roller Tension Reset',
    steps: [
      'Stop the labeler and clear any jammed labels from the label path',
      'Open the tension arm cover on the left side of the machine',
      'Loosen the tension knob (2 turns counter-clockwise) on roller R2',
      'Re-thread the label web through guides G1 → G2 → application roller',
      'Re-tighten tension knob until label web is taut but not stretched',
      'Run 10 test bottles and check label position (tolerance ±1 mm)',
    ],
  },
  {
    machineId: 'siemens_s7_1500',
    name: 'PLC Fault Reset — STOP Mode Recovery',
    steps: [
      'Note the current fault code shown on the PLC display',
      'Open TIA Portal on the engineering workstation',
      'Connect online: Online → Connect to PLC (select S7-1500 in list)',
      'Navigate to Online & Diagnostics → Diagnostics → Diagnostic buffer',
      'Review the top fault entry and take note of memory address',
      'Clear fault via PLC → RUN/STOP → Clear faults → Confirm',
      'Switch PLC to RUN mode and verify output modules show green status',
    ],
  },
  {
    machineId: 'siemens_s7_1500',
    name: 'PROFINET Communication Failure',
    steps: [
      'Check the PROFINET cable connection on port X1 P1 of the S7-1500',
      'Verify the switch/router port linked to the PLC shows link LED green',
      'In TIA Portal: Online → Accessible Devices — confirm PLC appears',
      'If not visible, ping 192.168.1.10 from engineering workstation',
      'If ping fails, check IP address on PLC front display (X1 P1 LED)',
      'Re-seat the PROFINET cable on both the PLC and switch ends',
      'Restart the PLC network interface via Online → PLC → Reset network interface',
    ],
  },
  {
    machineId: 'siemens_hmi_tp1200',
    name: 'HMI Touch Panel Freeze — Restart Procedure',
    steps: [
      'Hold the HMI power button for 5 seconds until screen goes dark',
      'Wait 10 seconds for full shutdown',
      'Power the HMI back on using the power button',
      'If HMI does not boot to main screen within 60 seconds, proceed to next step',
      'Access the WinCC Runtime configuration via Siemens Service menu (hold top-right corner for 3 seconds)',
      'Select Restart Runtime and confirm',
    ],
  },
  {
    machineId: 'generic_compressor',
    name: 'Compressor Won\'t Start — Safety Interlock Check',
    steps: [
      'Verify the oil level in the sight glass is between MIN and MAX marks',
      'Check the temperature gauge — must be below 85°C before starting',
      'Confirm the pressure relief valve is in the closed (horizontal) position',
      'Check for any fault indicator lights on the control panel',
      'Press the RESET button on the motor overload relay (red button, right side)',
      'Turn the selector key to ON position and press START',
      'Monitor oil pressure gauge for 5 seconds — must reach 4 bar within 10 seconds',
    ],
  },
  {
    machineId: 'generic_hvac',
    name: 'HVAC Not Cooling — Filter & Coil Check',
    steps: [
      'Check the return air filter — if visibly grey/blocked, replace immediately',
      'Inspect the evaporator coil for ice buildup (visible frost on the indoor unit)',
      'If coil is iced: switch to FAN ONLY mode for 30 minutes to defrost',
      'After defrost, check refrigerant sight glass (should show clear green, not bubbling)',
      'Confirm the outdoor condenser unit is running and fan is spinning',
      'Set thermostat 4°C below current room temperature and verify compressor starts',
    ],
  },
];

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

  console.log('[seed] Upserting playbooks…');
  for (const pb of PLAYBOOKS) {
    const existing = await prisma.playbook.findFirst({
      where: { machineId: pb.machineId, name: pb.name },
    });
    if (existing) {
      await prisma.playbook.update({
        where: { id: existing.id },
        data: { steps: JSON.stringify(pb.steps) },
      });
    } else {
      await prisma.playbook.create({
        data: {
          machineId: pb.machineId,
          name: pb.name,
          steps: JSON.stringify(pb.steps),
        },
      });
    }
    console.log(`  ✓ [${pb.machineId}] ${pb.name}`);
  }

  console.log('[seed] Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
