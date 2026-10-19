/**
 * Pure measurement normalization & conversion utility (Shared Kernel).
 * Zero dependencies, safe for both Node.js and browser environments.
 */

export interface UnitSpec {
  canonical: string;
  factorToCanonical: number;
}

const UNIT_FAMILIES: Record<string, Record<string, number>> = {
  length: {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
    inch: 25.4,
  },
  digital_storage: {
    B: 1 / (1024 * 1024 * 1024),
    KB: 1 / (1024 * 1024),
    MB: 1 / 1024,
    GB: 1,
    TB: 1024,
  },
  mass: {
    mg: 0.001,
    g: 1,
    kg: 1000,
  },
  power: {
    mW: 0.001,
    W: 1,
    kW: 1000,
  },
  frequency: {
    Hz: 1,
    kHz: 1000,
    MHz: 1_000_000,
    GHz: 1_000_000_000,
  },
  electric_charge: {
    mah: 1,
    ah: 1000,
  },
  energy: {
    mwh: 1,
    wh: 1000,
    kwh: 1_000_000,
  },
};

const CANONICAL_UNITS: Record<string, string> = {
  length: 'mm',
  digital_storage: 'GB',
  mass: 'g',
  power: 'W',
  frequency: 'Hz',
  electric_charge: 'mAh',
  energy: 'Wh',
};

// Map each normalized unit string to its family and canonical info
const UNIT_LOOKUP: Map<string, { family: string; canonical: string; factor: number }> = new Map();

for (const [family, units] of Object.entries(UNIT_FAMILIES)) {
  const canonical = CANONICAL_UNITS[family];
  for (const [unitName, factor] of Object.entries(units)) {
    UNIT_LOOKUP.set(unitName.toLowerCase(), { family, canonical, factor });
  }
}

function resolveUnit(unit: string): { family: string; canonical: string; factor: number } | null {
  if (!unit || typeof unit !== 'string') return null;
  return UNIT_LOOKUP.get(unit.trim().toLowerCase()) ?? null;
}

/**
 * Returns whether value is a finite number.
 */
export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Gets the canonical unit for a given unit string.
 * E.g., 'cm' -> 'mm', 'TB' -> 'GB'.
 */
export function getCanonicalUnit(unit: string): string {
  const resolved = resolveUnit(unit);
  if (!resolved) {
    throw new Error(`Unsupported unit: "${unit}"`);
  }
  return resolved.canonical;
}

/**
 * Checks whether two units are compatible for conversion.
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (typeof unitA === 'string' && typeof unitB === 'string') {
    if (unitA.trim().toLowerCase() === unitB.trim().toLowerCase()) return true;
  }
  const resA = resolveUnit(unitA);
  const resB = resolveUnit(unitB);
  if (!resA || !resB) return false;
  return resA.family === resB.family;
}

/**
 * Convert a measurement value from one unit to another.
 * Throws if value is not finite or units are incompatible/unsupported.
 */
export function convertMeasurement(value: number, fromUnit: string, toUnit: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`Measurement value must be a finite number: received ${value}`);
  }

  if (typeof fromUnit === 'string' && typeof toUnit === 'string') {
    if (fromUnit.trim().toLowerCase() === toUnit.trim().toLowerCase()) {
      return value;
    }
  }

  const resFrom = resolveUnit(fromUnit);
  if (!resFrom) {
    throw new Error(`Unsupported unit: "${fromUnit}"`);
  }

  const resTo = resolveUnit(toUnit);
  if (!resTo) {
    throw new Error(`Unsupported unit: "${toUnit}"`);
  }

  if (resFrom.family !== resTo.family) {
    throw new Error(`Incompatible units conversion from "${fromUnit}" to "${toUnit}"`);
  }

  if (resFrom === resTo || fromUnit.trim().toLowerCase() === toUnit.trim().toLowerCase()) {
    return value;
  }

  // Convert to canonical unit first, then to target unit
  const canonicalValue = value * resFrom.factor;
  const converted = canonicalValue / resTo.factor;

  // Round small floating-point artifacts: e.g. 10 / 10 = 1.0000000000000002
  const factor = 1e10;
  return Math.round(converted * factor) / factor;
}

/**
 * Normalizes a measurement to its canonical unit representation.
 */
export function normalizeToCanonical(
  value: number,
  unit: string
): { value: number; unit: string } {
  const canonical = getCanonicalUnit(unit);
  const normalizedValue = convertMeasurement(value, unit, canonical);
  return { value: normalizedValue, unit: canonical };
}

/**
 * Checks whether two measurements are equal across compatible units.
 */
export function areMeasurementsEqual(
  valueA: number,
  unitA: string,
  valueB: number,
  unitB: string,
  tolerance = 1e-9
): boolean {
  if (!isFiniteNumber(valueA) || !isFiniteNumber(valueB)) {
    return false;
  }
  if (!areUnitsCompatible(unitA, unitB)) {
    return false;
  }
  try {
    const valBConverted = convertMeasurement(valueB, unitB, unitA);
    return Math.abs(valueA - valBConverted) <= tolerance;
  } catch {
    return false;
  }
}
