import { serializeMoneyVnd, parseMoneyVnd } from '@shared/utils/money';
import type { MoneyVnd } from '@shared/types/money';

export { serializeMoneyVnd, parseMoneyVnd, type MoneyVnd };

/**
 * Safely converts a bigint, number, or string to a MoneyVnd string.
 * Returns null or undefined if the input is null or undefined.
 */
export function toMoneyVnd(
  value: bigint | number | string | null | undefined,
  field = 'amount'
): MoneyVnd | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'bigint') {
    return serializeMoneyVnd(value);
  }
  return serializeMoneyVnd(parseMoneyVnd(value, field));
}

/**
 * JSON replacer function to serialize any BigInt value as decimal string.
 * Useful for JSON.stringify(data, bigIntJsonReplacer).
 */
export function bigIntJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
