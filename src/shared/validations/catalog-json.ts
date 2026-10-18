/**
 * Catalog JSON Validators & Pure Canonical Serialization (Shared Kernel).
 * Strict discriminated JSON DSL, zero dependencies, layer-boundary compliant.
 */

import type {
  CategorySpecSchema,
  SpecDefinition,
  SpecValueType,
  ProductSpecs,
  SpecValue,
  VariantOptionItem,
  VariantOptions,
  CatalogImage,
} from '@shared/types/catalog';
import {
  areUnitsCompatible,
  convertMeasurement,
  isFiniteNumber,
} from '@shared/utils/measurements';

const ALLOWED_SPEC_VALUE_TYPES: Set<SpecValueType> = new Set([
  'TEXT',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'ENUM',
]);

const ALLOWED_SCHEMA_KEYS = new Set(['schemaVersion', 'definitions', 'variantOptions']);

const ALLOWED_DEFINITION_KEYS = new Set([
  'code',
  'label',
  'valueType',
  'unit',
  'required',
  'filterable',
  'comparable',
  'allowUnsupported',
  'enumValues',
  'sortOrder',
  'isOption',
]);

const ALLOWED_PRODUCT_SPECS_KEYS = new Set(['schemaVersion', 'values']);

const ALLOWED_SPEC_VALUE_KEYS_KNOWN = new Set(['state', 'value', 'unit']);
const ALLOWED_SPEC_VALUE_KEYS_OTHER = new Set(['state']);

const ALLOWED_VARIANT_OPTION_KEYS = new Set(['code', 'value', 'unit']);

const ALLOWED_CATALOG_IMAGE_KEYS = new Set(['url', 'alt', 'sortOrder', 'sourceId']);

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowedKeys: Set<string>,
  entityName: string
): void {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown key in ${entityName}: "${key}"`);
    }
  }
}

/**
 * Validates CategorySpecSchema against strict DSL rules.
 */
export function validateCategorySpecSchema(input: unknown): CategorySpecSchema {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('CategorySpecSchema must be a non-null object');
  }

  const raw = input as Record<string, unknown>;
  rejectUnknownKeys(raw, ALLOWED_SCHEMA_KEYS, 'CategorySpecSchema');

  const { schemaVersion, definitions } = raw;

  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion <= 0
  ) {
    throw new Error(
      `schemaVersion must be a positive integer, received: ${String(schemaVersion)}`
    );
  }

  if (!Array.isArray(definitions)) {
    throw new Error('definitions must be an array of SpecDefinition');
  }

  const seenCodes = new Set<string>();
  const validatedDefs: SpecDefinition[] = [];

  for (let i = 0; i < definitions.length; i++) {
    const rawDef = definitions[i];
    if (!rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef)) {
      throw new Error(`SpecDefinition at index ${i} must be a non-null object`);
    }

    const defObj = rawDef as Record<string, unknown>;
    rejectUnknownKeys(defObj, ALLOWED_DEFINITION_KEYS, `SpecDefinition (index ${i})`);

    const {
      code,
      label,
      valueType,
      unit,
      required,
      filterable,
      comparable,
      allowUnsupported,
      enumValues,
      sortOrder,
      isOption,
    } = defObj;

    if (typeof code !== 'string' || !code.trim() || !/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
      throw new Error(
        `Invalid or missing code at definition index ${i}: "${String(code)}"`
      );
    }
    const cleanCode = code.trim();
    if (seenCodes.has(cleanCode)) {
      throw new Error(`Duplicate definition code: "${cleanCode}"`);
    }
    seenCodes.add(cleanCode);

    if (typeof label !== 'string' || !label.trim()) {
      throw new Error(`Invalid or missing label for definition "${cleanCode}"`);
    }

    if (typeof valueType !== 'string' || !ALLOWED_SPEC_VALUE_TYPES.has(valueType as SpecValueType)) {
      throw new Error(
        `Invalid valueType "${String(valueType)}" for definition "${cleanCode}". Allowed: ${Array.from(ALLOWED_SPEC_VALUE_TYPES).join(', ')}`
      );
    }

    let cleanUnit: string | null = null;
    if (unit !== undefined && unit !== null) {
      if (typeof unit !== 'string' || !unit.trim()) {
        throw new Error(`Invalid unit for definition "${cleanCode}"`);
      }
      cleanUnit = unit.trim();
    }

    let cleanEnumValues: string[] | undefined = undefined;
    if (valueType === 'ENUM') {
      if (!Array.isArray(enumValues) || enumValues.length === 0) {
        throw new Error(
          `enumValues must be a non-empty array of strings for ENUM definition "${cleanCode}"`
        );
      }
      const seenEnums = new Set<string>();
      cleanEnumValues = [];
      for (const ev of enumValues) {
        if (typeof ev !== 'string' || !ev.trim()) {
          throw new Error(`Invalid enum value in definition "${cleanCode}": "${String(ev)}"`);
        }
        const cleanEv = ev.trim();
        if (seenEnums.has(cleanEv)) {
          throw new Error(`Duplicate enum value "${cleanEv}" in definition "${cleanCode}"`);
        }
        seenEnums.add(cleanEv);
        cleanEnumValues.push(cleanEv);
      }
    } else if (enumValues !== undefined && enumValues !== null) {
      if (Array.isArray(enumValues) && enumValues.length > 0) {
        throw new Error(
          `enumValues are not allowed for non-ENUM definition "${cleanCode}" (type: ${valueType})`
        );
      }
    }

    let cleanSortOrder = i;
    if (sortOrder !== undefined && sortOrder !== null) {
      if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) {
        throw new Error(`Invalid sortOrder for definition "${cleanCode}"`);
      }
      cleanSortOrder = sortOrder;
    }

    validatedDefs.push({
      code: cleanCode,
      label: label.trim(),
      valueType: valueType as SpecValueType,
      unit: cleanUnit,
      required: required === true,
      filterable: filterable === true,
      comparable: comparable === true,
      allowUnsupported: allowUnsupported === true,
      ...(cleanEnumValues ? { enumValues: cleanEnumValues } : {}),
      sortOrder: cleanSortOrder,
      isOption: isOption === true,
    });
  }

  // Deterministically sort definitions by sortOrder, then code
  validatedDefs.sort((a, b) => {
    const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return diff !== 0 ? diff : a.code.localeCompare(b.code);
  });

  return {
    schemaVersion,
    definitions: validatedDefs,
  };
}

/**
 * Validates ProductSpecs against CategorySpecSchema.
 */
export function validateProductSpecs(
  input: unknown,
  schema: CategorySpecSchema
): ProductSpecs {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ProductSpecs must be a non-null object');
  }

  const raw = input as Record<string, unknown>;
  rejectUnknownKeys(raw, ALLOWED_PRODUCT_SPECS_KEYS, 'ProductSpecs');

  const { schemaVersion, values } = raw;

  if (schemaVersion !== schema.schemaVersion) {
    throw new Error(
      `Schema version mismatch: expected ${schema.schemaVersion}, received ${String(schemaVersion)}`
    );
  }

  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('ProductSpecs.values must be an object keyed by spec code');
  }

  const defsByCode = new Map<string, SpecDefinition>(
    schema.definitions.map((d) => [d.code, d])
  );

  const rawValues = values as Record<string, unknown>;

  // Reject unknown spec codes not present in schema
  for (const code of Object.keys(rawValues)) {
    if (!defsByCode.has(code)) {
      throw new Error(`Unknown specification code: "${code}"`);
    }
  }

  const validatedValues: Record<string, SpecValue> = {};

  // Check required specs and validate each spec
  for (const def of schema.definitions) {
    const rawSpec = rawValues[def.code];

    if (rawSpec === undefined) {
      if (def.required) {
        throw new Error(`Missing required specification: "${def.code}"`);
      }
      continue;
    }

    if (!rawSpec || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
      throw new Error(`Specification value for "${def.code}" must be an object`);
    }

    const specObj = rawSpec as Record<string, unknown>;
    const state = specObj.state;

    if (state !== 'KNOWN' && state !== 'UNKNOWN' && state !== 'UNSUPPORTED') {
      throw new Error(
        `Invalid KnowledgeState "${String(state)}" for "${def.code}". Allowed: KNOWN, UNKNOWN, UNSUPPORTED`
      );
    }

    if (def.required && state !== 'KNOWN') {
      throw new Error(
        `Required specification "${def.code}" cannot be ${state}; it requires a KNOWN value`
      );
    }

    if (state === 'UNKNOWN') {
      if ('value' in specObj && specObj.value !== undefined) {
        throw new Error(`UNKNOWN specification "${def.code}" carries no value`);
      }
      rejectUnknownKeys(specObj, ALLOWED_SPEC_VALUE_KEYS_OTHER, `SpecValue (${def.code})`);
      validatedValues[def.code] = { state: 'UNKNOWN' };
      continue;
    }

    if (state === 'UNSUPPORTED') {
      if (!def.allowUnsupported) {
        throw new Error(
          `UNSUPPORTED state is not allowed for specification "${def.code}" (allowUnsupported is false)`
        );
      }
      if ('value' in specObj && specObj.value !== undefined) {
        throw new Error(`UNSUPPORTED specification "${def.code}" carries no value`);
      }
      rejectUnknownKeys(specObj, ALLOWED_SPEC_VALUE_KEYS_OTHER, `SpecValue (${def.code})`);
      validatedValues[def.code] = { state: 'UNSUPPORTED' };
      continue;
    }

    // state === 'KNOWN'
    rejectUnknownKeys(specObj, ALLOWED_SPEC_VALUE_KEYS_KNOWN, `SpecValue (${def.code})`);
    const val = specObj.value;
    if (val === undefined || val === null) {
      throw new Error(`KNOWN specification "${def.code}" must carry a value`);
    }

    let normalizedValue: string | number | boolean = val as string | number | boolean;
    let normalizedUnit: string | null = def.unit ?? null;

    // Validate type
    switch (def.valueType) {
      case 'TEXT': {
        if (typeof val !== 'string') {
          throw new Error(
            `Specification "${def.code}" expects TEXT (string), received ${typeof val}`
          );
        }
        if (specObj.unit !== undefined && specObj.unit !== null) {
          throw new Error(`Unit is not allowed for TEXT specification "${def.code}"`);
        }
        normalizedValue = val;
        break;
      }
      case 'INTEGER': {
        if (typeof val !== 'number' || !Number.isInteger(val) || !Number.isFinite(val)) {
          throw new Error(
            `Specification "${def.code}" expects INTEGER, received ${String(val)}`
          );
        }
        if (specObj.unit !== undefined && specObj.unit !== null) {
          const providedUnit = String(specObj.unit).trim();
          if (!def.unit) {
            throw new Error(
              `Unit "${providedUnit}" provided for "${def.code}", but definition has no unit`
            );
          }
          if (!areUnitsCompatible(providedUnit, def.unit)) {
            throw new Error(
              `Incompatible unit "${providedUnit}" for "${def.code}" (definition unit: "${def.unit}")`
            );
          }
          normalizedValue = convertMeasurement(val, providedUnit, def.unit);
          normalizedUnit = def.unit;
        }
        break;
      }
      case 'DECIMAL': {
        if (!isFiniteNumber(val)) {
          throw new Error(
            `Specification "${def.code}" expects DECIMAL (finite number), received ${String(val)}`
          );
        }
        if (specObj.unit !== undefined && specObj.unit !== null) {
          const providedUnit = String(specObj.unit).trim();
          if (!def.unit) {
            throw new Error(
              `Unit "${providedUnit}" provided for "${def.code}", but definition has no unit`
            );
          }
          if (!areUnitsCompatible(providedUnit, def.unit)) {
            throw new Error(
              `Incompatible unit "${providedUnit}" for "${def.code}" (definition unit: "${def.unit}")`
            );
          }
          normalizedValue = convertMeasurement(val, providedUnit, def.unit);
          normalizedUnit = def.unit;
        }
        break;
      }
      case 'BOOLEAN': {
        if (typeof val !== 'boolean') {
          throw new Error(
            `Specification "${def.code}" expects BOOLEAN, received ${typeof val}`
          );
        }
        if (specObj.unit !== undefined && specObj.unit !== null) {
          throw new Error(`Unit is not allowed for BOOLEAN specification "${def.code}"`);
        }
        normalizedValue = val;
        break;
      }
      case 'ENUM': {
        if (typeof val !== 'string' || !def.enumValues?.includes(val)) {
          throw new Error(
            `Invalid ENUM value "${String(val)}" for "${def.code}". Allowed: ${(def.enumValues ?? []).join(', ')}`
          );
        }
        if (specObj.unit !== undefined && specObj.unit !== null) {
          throw new Error(`Unit is not allowed for ENUM specification "${def.code}"`);
        }
        normalizedValue = val;
        break;
      }
    }

    validatedValues[def.code] = {
      state: 'KNOWN',
      value: normalizedValue,
      ...(normalizedUnit ? { unit: normalizedUnit } : {}),
    };
  }

  return {
    schemaVersion: schema.schemaVersion,
    values: validatedValues,
  };
}

/**
 * Validates variant options against definitions marked with `isOption: true`.
 * Generates deterministic ordering and canonical optionHash.
 */
export function validateVariantOptions(
  input: unknown,
  schema: CategorySpecSchema
): VariantOptions {
  if (!input || (typeof input !== 'object' && !Array.isArray(input))) {
    throw new Error('Variant options input must be an object or array');
  }

  const allDefs = new Map<string, SpecDefinition>(
    schema.definitions.map((d) => [d.code, d])
  );
  const optionDefs = new Map<string, SpecDefinition>(
    schema.definitions.filter((d) => d.isOption === true).map((d) => [d.code, d])
  );

  if (Array.isArray(schema.variantOptions)) {
    for (const optDef of schema.variantOptions) {
      allDefs.set(optDef.code, optDef);
      optionDefs.set(optDef.code, optDef);
    }
  }

  interface RawOption {
    code: string;
    value: unknown;
    unit?: unknown;
  }

  const rawList: RawOption[] = [];

  if (Array.isArray(input)) {
    const seen = new Set<string>();
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`Variant option at index ${i} must be an object`);
      }
      const itemObj = item as Record<string, unknown>;
      rejectUnknownKeys(itemObj, ALLOWED_VARIANT_OPTION_KEYS, `VariantOption item (${i})`);
      const code = itemObj.code;
      if (typeof code !== 'string' || !code.trim()) {
        throw new Error(`Variant option at index ${i} is missing code`);
      }
      const cleanCode = code.trim();
      if (seen.has(cleanCode)) {
        throw new Error(`Duplicate option code: "${cleanCode}"`);
      }
      seen.add(cleanCode);
      rawList.push({
        code: cleanCode,
        value: itemObj.value,
        unit: itemObj.unit,
      });
    }
  } else {
    // Map/record format
    const obj = input as Record<string, unknown>;
    // Check if wrapped in { options: [...] }
    if (Array.isArray(obj.options)) {
      return validateVariantOptions(obj.options, schema);
    }
    for (const [code, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
        const nested = val as Record<string, unknown>;
        rawList.push({ code, value: nested.value, unit: nested.unit });
      } else {
        rawList.push({ code, value: val });
      }
    }
  }

  const validatedOptions: VariantOptionItem[] = [];
  const valuesMap: Record<string, string | number | boolean> = {};

  for (const item of rawList) {
    const def = allDefs.get(item.code);
    if (!def) {
      throw new Error(`Unknown option code: "${item.code}"`);
    }

    if (!optionDefs.has(item.code)) {
      throw new Error(
        `Specification "${item.code}" is not marked as an option in the schema (isOption is false)`
      );
    }

    if (item.value === undefined || item.value === null) {
      throw new Error(`Option "${item.code}" must carry a value`);
    }

    let normalizedValue = item.value as string | number | boolean;
    let normalizedUnit = def.unit ?? null;

    switch (def.valueType) {
      case 'TEXT': {
        if (typeof item.value !== 'string') {
          throw new Error(`Option "${item.code}" expects TEXT value`);
        }
        normalizedValue = item.value;
        break;
      }
      case 'INTEGER': {
        if (typeof item.value !== 'number' || !Number.isInteger(item.value) || !Number.isFinite(item.value)) {
          throw new Error(`Option "${item.code}" expects INTEGER value`);
        }
        if (item.unit !== undefined && item.unit !== null) {
          const u = String(item.unit).trim();
          if (def.unit && areUnitsCompatible(u, def.unit)) {
            normalizedValue = convertMeasurement(item.value, u, def.unit);
            normalizedUnit = def.unit;
          }
        }
        break;
      }
      case 'DECIMAL': {
        if (!isFiniteNumber(item.value)) {
          throw new Error(`Option "${item.code}" expects DECIMAL value`);
        }
        if (item.unit !== undefined && item.unit !== null) {
          const u = String(item.unit).trim();
          if (def.unit && areUnitsCompatible(u, def.unit)) {
            normalizedValue = convertMeasurement(item.value, u, def.unit);
            normalizedUnit = def.unit;
          }
        }
        break;
      }
      case 'BOOLEAN': {
        if (typeof item.value !== 'boolean') {
          throw new Error(`Option "${item.code}" expects BOOLEAN value`);
        }
        normalizedValue = item.value;
        break;
      }
      case 'ENUM': {
        if (typeof item.value !== 'string' || !def.enumValues?.includes(item.value)) {
          throw new Error(
            `Option "${item.code}" expects valid ENUM value from: ${(def.enumValues ?? []).join(', ')}`
          );
        }
        normalizedValue = item.value;
        break;
      }
    }

    validatedOptions.push({
      code: item.code,
      value: normalizedValue,
      ...(normalizedUnit ? { unit: normalizedUnit } : {}),
    });
    valuesMap[item.code] = normalizedValue;
  }

  // Deterministically sort options by definition sortOrder, then code
  validatedOptions.sort((a, b) => {
    const defA = optionDefs.get(a.code);
    const defB = optionDefs.get(b.code);
    const orderA = defA?.sortOrder ?? 0;
    const orderB = defB?.sortOrder ?? 0;
    const diff = orderA - orderB;
    return diff !== 0 ? diff : a.code.localeCompare(b.code);
  });

  const optionHash = canonicalJsonHash(validatedOptions);

  return {
    options: validatedOptions,
    values: valuesMap,
    optionHash,
  };
}

/**
 * Validates CatalogImage array with bounded size, valid URLs, and unique sort orders.
 */
export function validateCatalogImages(
  input: unknown,
  maxCount = 20
): CatalogImage[] {
  if (!Array.isArray(input)) {
    throw new Error('Catalog images must be an array');
  }

  if (input.length > maxCount) {
    throw new Error(
      `Catalog images count (${input.length}) exceeds maximum allowed (${maxCount})`
    );
  }

  const seenUrls = new Set<string>();
  const seenSortOrders = new Set<number>();
  const validatedImages: CatalogImage[] = [];

  for (let i = 0; i < input.length; i++) {
    const rawImg = input[i];
    if (!rawImg || typeof rawImg !== 'object' || Array.isArray(rawImg)) {
      throw new Error(`CatalogImage at index ${i} must be a non-null object`);
    }

    const imgObj = rawImg as Record<string, unknown>;
    rejectUnknownKeys(imgObj, ALLOWED_CATALOG_IMAGE_KEYS, `CatalogImage (index ${i})`);

    const { url, alt, sortOrder, sourceId } = imgObj;

    if (typeof url !== 'string' || !url.trim()) {
      throw new Error(`CatalogImage at index ${i} must have a valid URL`);
    }
    const cleanUrl = url.trim();

    // Verify valid HTTP/HTTPS URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl);
    } catch {
      throw new Error(`CatalogImage at index ${i} has invalid URL format: "${cleanUrl}"`);
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `CatalogImage URL must use http or https protocol: "${cleanUrl}"`
      );
    }

    if (seenUrls.has(cleanUrl)) {
      throw new Error(`Duplicate image URL: "${cleanUrl}"`);
    }
    seenUrls.add(cleanUrl);

    if (typeof alt !== 'string') {
      throw new Error(`CatalogImage at index ${i} must have an alt string`);
    }

    if (
      typeof sortOrder !== 'number' ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      throw new Error(
        `CatalogImage at index ${i} must have a non-negative integer sortOrder`
      );
    }

    if (seenSortOrders.has(sortOrder)) {
      throw new Error(`Duplicate image sortOrder: ${sortOrder}`);
    }
    seenSortOrders.add(sortOrder);

    let cleanSourceId: string | null = null;
    if (sourceId !== undefined && sourceId !== null) {
      if (typeof sourceId !== 'string' || !sourceId.trim()) {
        throw new Error(`Invalid sourceId for image at index ${i}`);
      }
      cleanSourceId = sourceId.trim();
    }

    validatedImages.push({
      url: cleanUrl,
      alt: alt.trim(),
      sortOrder,
      ...(cleanSourceId ? { sourceId: cleanSourceId } : {}),
    });
  }

  // Sort images deterministically by sortOrder
  validatedImages.sort((a, b) => a.sortOrder - b.sortOrder);

  return validatedImages;
}

// =========================================================================
// Pure Deterministic Canonical JSON Stringify & SHA-256 Hash Implementation
// =========================================================================

/**
 * Deterministically serializes value to JSON string:
 * - Object keys sorted lexicographically
 * - Array order strictly preserved
 * - Primitives formatted stably
 */
export function canonicalJsonStringify(input: unknown): string {
  if (input === null) return 'null';
  if (input === undefined) return 'null';

  const type = typeof input;
  if (type === 'boolean') return input ? 'true' : 'false';
  if (type === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Cannot serialize non-finite number: ${String(input)}`);
    }
    return String(input);
  }
  if (type === 'string') return JSON.stringify(input);
  if (type === 'bigint') return JSON.stringify(input.toString());

  if (Array.isArray(input)) {
    const elements = input.map((item) => canonicalJsonStringify(item));
    return `[${elements.join(',')}]`;
  }

  if (type === 'object') {
    const obj = input as Record<string, unknown>;
    const sortedKeys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const entries = sortedKeys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`
    );
    return `{${entries.join(',')}}`;
  }

  throw new Error(`Unsupported type for canonical JSON: ${type}`);
}

// Pure SHA-256 implementation (zero dependencies, fully portable)
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, b: number): number {
  return (n >>> b) | (n << (32 - b));
}

function sha256Pure(asciiStr: string): string {
  // UTF-8 encode string to byte array
  const bytes: number[] = [];
  for (let i = 0; i < asciiStr.length; i++) {
    let code = asciiStr.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      // surrogate pair
      i++;
      const nextCode = asciiStr.charCodeAt(i);
      code = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  const bitLength = bytes.length * 8;

  // Append single 1 bit (0x80)
  bytes.push(0x80);

  // Pad with zeros until length is congruent to 56 mod 64
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  // Append 64-bit length as big-endian (high 32 bits, then low 32 bits)
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  bytes.push(
    (highBits >>> 24) & 0xff,
    (highBits >>> 16) & 0xff,
    (highBits >>> 8) & 0xff,
    highBits & 0xff,
    (lowBits >>> 24) & 0xff,
    (lowBits >>> 16) & 0xff,
    (lowBits >>> 8) & 0xff,
    lowBits & 0xff
  );

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      w[i] =
        (bytes[idx] << 24) |
        (bytes[idx + 1] << 16) |
        (bytes[idx + 2] << 8) |
        bytes[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Computes deterministic SHA-256 hex hash from any input using canonical JSON serialization.
 */
export function canonicalJsonHash(input: unknown): string {
  const canonicalString = canonicalJsonStringify(input);
  return sha256Pure(canonicalString);
}

/**
 * Computes deterministic SHA-256 hash for variant option items.
 */
export function computeVariantOptionHash(
  options: Array<{ code: string; value: unknown; unit?: string | null }> | Record<string, unknown>
): string {
  const items: Array<{ code: string; value: unknown; unit?: string | null }> = [];
  if (Array.isArray(options)) {
    for (const opt of options) {
      if (opt && typeof opt === 'object' && opt.code) {
        items.push({
          code: opt.code,
          value: opt.value,
          ...(opt.unit ? { unit: opt.unit } : {}),
        });
      }
    }
  } else if (options && typeof options === 'object') {
    for (const [code, val] of Object.entries(options)) {
      items.push({ code, value: val });
    }
  }
  items.sort((a, b) => a.code.localeCompare(b.code));
  return canonicalJsonHash(items);
}
