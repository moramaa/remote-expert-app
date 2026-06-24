/**
 * lib/measurement-units.ts — MEAS-2: dynamic display units.
 *
 * The measurement engine always stores the raw distance in METERS (the
 * Matterport model unit). Conversion + formatting happens only at the display
 * layer, so switching units never accumulates rounding error.
 */

export type MeasurementUnit = 'm' | 'cm' | 'mm' | 'ft' | 'ft_in' | 'in';

export interface UnitOption {
  value: MeasurementUnit;
  label: string;   // short selector label
  system: 'metric' | 'imperial';
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: 'm',     label: 'Meters',          system: 'metric'   },
  { value: 'cm',    label: 'Centimeters',     system: 'metric'   },
  { value: 'mm',    label: 'Millimeters',     system: 'metric'   },
  { value: 'ft',    label: 'Feet',            system: 'imperial' },
  { value: 'ft_in', label: 'Feet + Inches',   system: 'imperial' },
  { value: 'in',    label: 'Inches',          system: 'imperial' },
];

const METERS_TO_FEET   = 3.280839895;
const METERS_TO_INCHES = 39.37007874;

/**
 * Convert a raw meter distance into a numeric value in the target unit.
 * For 'ft_in' the returned number is total feet (fractional) — use format()
 * for the feet+inches string representation.
 */
export function convert(meters: number, unit: MeasurementUnit): number {
  switch (unit) {
    case 'm':     return meters;
    case 'cm':    return meters * 100;
    case 'mm':    return meters * 1000;
    case 'ft':    return meters * METERS_TO_FEET;
    case 'ft_in': return meters * METERS_TO_FEET;
    case 'in':    return meters * METERS_TO_INCHES;
  }
}

/**
 * Format a raw meter distance for display in the chosen unit.
 *
 * @param meters   raw distance (model units)
 * @param unit     target display unit
 * @param decimals decimal places for non-compound units (default 2)
 */
export function format(meters: number, unit: MeasurementUnit, decimals = 2): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';

  if (unit === 'ft_in') {
    const totalInches = meters * METERS_TO_INCHES;
    let feet   = Math.floor(totalInches / 12);
    let inches = totalInches - feet * 12;
    // Round inches, carrying over to feet at 12"
    inches = Math.round(inches * 10) / 10;
    if (inches >= 12) { feet += 1; inches -= 12; }
    // Trim trailing ".0"
    const inchStr = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
    return `${feet}′ ${inchStr}″`;
  }

  const value  = convert(meters, unit);
  const suffix = unit === 'cm' ? 'cm' : unit === 'mm' ? 'mm' : unit === 'ft' ? 'ft' : unit === 'in' ? 'in' : 'm';
  // mm/cm read better with fewer decimals
  const dp = unit === 'mm' ? 0 : unit === 'cm' ? 1 : decimals;
  return `${value.toFixed(dp)} ${suffix}`;
}

// ── User preference (per-browser, restored across sessions) ───────────────────

const PREF_KEY = 'fieldsync:measurementUnit';
const DEFAULT_UNIT: MeasurementUnit = 'm';

export function getPreferredUnit(): MeasurementUnit {
  if (typeof window === 'undefined') return DEFAULT_UNIT;
  const v = localStorage.getItem(PREF_KEY);
  return UNIT_OPTIONS.some((o) => o.value === v) ? (v as MeasurementUnit) : DEFAULT_UNIT;
}

export function storePreferredUnit(unit: MeasurementUnit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREF_KEY, unit);
}

// ── Geometry ──────────────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number; }

/** Euclidean distance between two 3D points (model units = meters). */
export function distance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
