/**
 * Canonical machine catalog — single source of truth for:
 *   - Prisma seed data
 *   - Expert certification multi-select
 *   - Worker SOS machine picker
 */

export interface MachineOption {
  id: string;
  label: string;
  vendor: string;
}

export const MACHINES: MachineOption[] = [
  { id: 'krones_filler',      label: 'Krones Filler',          vendor: 'Krones'  },
  { id: 'krones_labeler',     label: 'Krones Labeler',          vendor: 'Krones'  },
  { id: 'krones_conveyor',    label: 'Krones Conveyor System',  vendor: 'Krones'  },
  { id: 'siemens_s7_1500',    label: 'Siemens S7-1500 PLC',    vendor: 'Siemens' },
  { id: 'siemens_hmi_tp1200', label: 'Siemens HMI TP1200',     vendor: 'Siemens' },
  { id: 'siemens_et200sp',    label: 'Siemens ET 200SP',        vendor: 'Siemens' },
  { id: 'generic_compressor', label: 'Industrial Compressor',   vendor: 'Generic' },
  { id: 'generic_hvac',       label: 'HVAC System',             vendor: 'Generic' },
];

export const MACHINE_MAP = new Map<string, MachineOption>(
  MACHINES.map((m) => [m.id, m]),
);

export const VENDORS = Array.from(new Set(MACHINES.map((m) => m.vendor)));
