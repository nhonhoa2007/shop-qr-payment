import type { MoneyVnd } from '@shared/types/money';

export const BUSINESS_MAX_VND = BigInt('9000000000000000');
const ZERO_BIGINT = BigInt(0);
const ONE_BIGINT = BigInt(1);

const INTEGER_REGEX = /^\+?[0-9]+$/;

/**
 * Parses external input into a validated nonnegative bigint VND amount.
 * Enforces business upper bound of 9_000_000_000_000_000 VND (9 quadrillion VND).
 * Rejects negative values, decimals, exponent notation, whitespace, or invalid types.
 */
export function parseMoneyVnd(value: unknown, field: string): bigint {
  if (value === null || value === undefined) {
    throw new TypeError(`Invalid ${field}: value cannot be null or undefined`);
  }

  let bi: bigint;

  if (typeof value === 'bigint') {
    if (value < ZERO_BIGINT) {
      throw new RangeError(`Invalid ${field}: must be nonnegative`);
    }
    bi = value;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError(`Invalid ${field}: expected integer number, received ${value}`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`Invalid ${field}: number exceeds safe integer limit`);
    }
    if (value < 0 || Object.is(value, -0)) {
      throw new RangeError(`Invalid ${field}: must be nonnegative`);
    }
    bi = BigInt(value);
  } else if (typeof value === 'string') {
    if (!INTEGER_REGEX.test(value)) {
      throw new TypeError(`Invalid ${field}: expected decimal integer string, received "${value}"`);
    }
    bi = BigInt(value);
  } else {
    throw new TypeError(`Invalid ${field}: expected nonnegative integer string or number`);
  }

  if (bi > BUSINESS_MAX_VND) {
    throw new RangeError(
      `Invalid ${field}: amount exceeds business maximum of ${BUSINESS_MAX_VND.toString()} VND`
    );
  }

  return bi;
}

/**
 * Serializes a trusted nonnegative bigint to a MoneyVnd decimal string.
 * Accepts trusted nonnegative bigint even above the business cap.
 */
export function serializeMoneyVnd(value: bigint): MoneyVnd {
  if (typeof value !== 'bigint') {
    throw new TypeError(`Expected bigint, received ${typeof value}`);
  }
  if (value < ZERO_BIGINT) {
    throw new RangeError(`Expected nonnegative bigint, received ${value}`);
  }
  return value.toString();
}

/**
 * Safely sums multiple nonnegative bigint VND amounts.
 */
export function addMoney(...values: bigint[]): bigint {
  let sum = ZERO_BIGINT;
  for (const v of values) {
    if (typeof v !== 'bigint') {
      throw new TypeError(`Expected bigint, received ${typeof v}`);
    }
    if (v < ZERO_BIGINT) {
      throw new RangeError(`Expected nonnegative bigint, received ${v}`);
    }
    sum += v;
  }
  return sum;
}

/**
 * Proportionally allocates total across weights with exact conservation
 * and stable input-index tie break for remainders.
 */
export function allocateProportionally(total: bigint, weights: bigint[]): bigint[] {
  if (typeof total !== 'bigint') {
    throw new TypeError('Expected total to be bigint');
  }
  if (total < ZERO_BIGINT) {
    throw new RangeError('Expected total to be nonnegative bigint');
  }
  if (!Array.isArray(weights)) {
    throw new TypeError('Expected weights to be an array of bigints');
  }

  for (const w of weights) {
    if (typeof w !== 'bigint') {
      throw new TypeError('Expected weight to be bigint');
    }
    if (w < ZERO_BIGINT) {
      throw new RangeError('Expected weight to be nonnegative bigint');
    }
  }

  if (weights.length === 0) {
    if (total === ZERO_BIGINT) return [];
    throw new RangeError('Cannot allocate positive total across empty weights');
  }

  const sumWeights = weights.reduce((acc, w) => acc + w, ZERO_BIGINT);
  if (sumWeights === ZERO_BIGINT) {
    if (total === ZERO_BIGINT) return weights.map(() => ZERO_BIGINT);
    throw new RangeError('Cannot allocate positive total when sum of weights is zero');
  }

  const baseShares: bigint[] = new Array(weights.length);
  const remainders: bigint[] = new Array(weights.length);
  let allocated = ZERO_BIGINT;

  for (let i = 0; i < weights.length; i++) {
    const prod = total * weights[i];
    const base = prod / sumWeights;
    const rem = prod % sumWeights;
    baseShares[i] = base;
    remainders[i] = rem;
    allocated += base;
  }

  const leftover = total - allocated;

  const indices = weights.map((_, i) => i);
  indices.sort((a, b) => {
    if (remainders[b] > remainders[a]) return 1;
    if (remainders[b] < remainders[a]) return -1;
    return a - b;
  });

  for (let k = 0; k < Number(leftover); k++) {
    const idx = indices[k];
    baseShares[idx] += ONE_BIGINT;
  }

  return baseShares;
}
