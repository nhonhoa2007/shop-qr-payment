import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCategorySpecSchema,
  validateProductSpecs,
  validateVariantOptions,
  validateCatalogImages,
  canonicalJsonHash,
} from '@shared/validations/catalog-json';
import {
  convertMeasurement,
  areMeasurementsEqual,
  getCanonicalUnit,
  areUnitsCompatible,
  normalizeToCanonical,
} from '@shared/utils/measurements';
import type {
  CategorySpecSchema,
  CatalogImage,
  ProductKind,
  ProductSegment,
  KnowledgeState,
  SourceStatus,
  VersionedJson,
} from '@shared/types/catalog';

describe('Catalog JSON Contracts & Validation', () => {
  const sampleSchema: CategorySpecSchema = {
    schemaVersion: 1,
    definitions: [
      {
        code: 'display_size',
        label: 'Kích thước màn hình',
        valueType: 'DECIMAL',
        unit: 'cm',
        required: true,
        filterable: true,
        comparable: true,
        sortOrder: 1,
      },
      {
        code: 'ram',
        label: 'RAM',
        valueType: 'INTEGER',
        unit: 'GB',
        required: true,
        filterable: true,
        comparable: true,
        isOption: true,
        sortOrder: 2,
      },
      {
        code: 'storage',
        label: 'Bộ nhớ trong',
        valueType: 'INTEGER',
        unit: 'GB',
        required: true,
        filterable: true,
        comparable: true,
        isOption: true,
        sortOrder: 3,
      },
      {
        code: 'color',
        label: 'Màu sắc',
        valueType: 'TEXT',
        required: false,
        filterable: true,
        isOption: true,
        sortOrder: 4,
      },
      {
        code: 'os_family',
        label: 'Hệ điều hành',
        valueType: 'ENUM',
        enumValues: ['MACOS', 'WINDOWS', 'LINUX'],
        required: false,
        filterable: true,
        sortOrder: 5,
      },
      {
        code: 'has_cellular',
        label: 'Hỗ trợ mạng di động',
        valueType: 'BOOLEAN',
        allowUnsupported: true,
        required: false,
        sortOrder: 6,
      },
      {
        code: 'nfc_support',
        label: 'NFC',
        valueType: 'BOOLEAN',
        allowUnsupported: false,
        required: false,
        sortOrder: 7,
      },
    ],
  };

  describe('CategorySpecSchema validation', () => {
    it('validates a correct CategorySpecSchema', () => {
      const validated = validateCategorySpecSchema(sampleSchema);
      assert.equal(validated.schemaVersion, 1);
      assert.equal(validated.definitions.length, 7);
    });

    it('rejects schema missing schemaVersion or non-positive integer', () => {
      assert.throws(
        () => validateCategorySpecSchema({ definitions: [] }),
        /schemaVersion/i
      );
      assert.throws(
        () => validateCategorySpecSchema({ schemaVersion: 0, definitions: [] }),
        /schemaVersion/i
      );
      assert.throws(
        () => validateCategorySpecSchema({ schemaVersion: -1, definitions: [] }),
        /schemaVersion/i
      );
      assert.throws(
        () => validateCategorySpecSchema({ schemaVersion: 1.5, definitions: [] }),
        /schemaVersion/i
      );
    });

    it('rejects schema missing definitions or non-array', () => {
      assert.throws(
        () => validateCategorySpecSchema({ schemaVersion: 1 }),
        /definitions/i
      );
      assert.throws(
        () => validateCategorySpecSchema({ schemaVersion: 1, definitions: 'not-an-array' }),
        /definitions/i
      );
    });

    it('rejects duplicate definition codes', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [
              { code: 'ram', label: 'RAM', valueType: 'INTEGER' },
              { code: 'ram', label: 'Bộ nhớ RAM', valueType: 'INTEGER' },
            ],
          }),
        /duplicate.*ram/i
      );
    });

    it('rejects unknown keys on CategorySpecSchema', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [],
            extraKey: 'forbidden',
          }),
        /unknown key.*extraKey/i
      );
    });

    it('rejects unknown keys on SpecDefinition', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [
              { code: 'ram', label: 'RAM', valueType: 'INTEGER', unapprovedProperty: 123 },
            ],
          }),
        /unknown key.*unapprovedProperty/i
      );
    });

    it('rejects invalid valueType', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [{ code: 'ram', label: 'RAM', valueType: 'FLOAT' }],
          }),
        /valueType/i
      );
    });

    it('rejects ENUM valueType without enumValues or with empty enumValues', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [{ code: 'tier', label: 'Tier', valueType: 'ENUM' }],
          }),
        /enumValues/i
      );
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [{ code: 'tier', label: 'Tier', valueType: 'ENUM', enumValues: [] }],
          }),
        /enumValues/i
      );
    });

    it('rejects non-ENUM valueType specifying enumValues', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [
              { code: 'ram', label: 'RAM', valueType: 'INTEGER', enumValues: ['16'] },
            ],
          }),
        /enumValues/i
      );
    });

    it('rejects duplicate enum values within an ENUM definition', () => {
      assert.throws(
        () =>
          validateCategorySpecSchema({
            schemaVersion: 1,
            definitions: [
              { code: 'tier', label: 'Tier', valueType: 'ENUM', enumValues: ['PRO', 'PRO'] },
            ],
          }),
        /duplicate.*PRO/i
      );
    });
  });

  describe('ProductSpecs validation', () => {
    it('validates correct product specs with KNOWN, UNKNOWN, UNSUPPORTED states', () => {
      const input = {
        schemaVersion: 1,
        values: {
          display_size: { state: 'KNOWN', value: 35.5, unit: 'cm' },
          ram: { state: 'KNOWN', value: 16, unit: 'GB' },
          storage: { state: 'KNOWN', value: 512, unit: 'GB' },
          color: { state: 'KNOWN', value: 'Space Grey' },
          os_family: { state: 'UNKNOWN' },
          has_cellular: { state: 'UNSUPPORTED' },
        },
      };

      const validated = validateProductSpecs(input, sampleSchema);
      assert.equal(validated.schemaVersion, 1);
      assert.equal(validated.values.ram.state, 'KNOWN');
      if (validated.values.ram.state === 'KNOWN') {
        assert.equal(validated.values.ram.value, 16);
        assert.equal(validated.values.ram.unit, 'GB');
      }
      assert.equal(validated.values.os_family.state, 'UNKNOWN');
      assert.equal(validated.values.has_cellular.state, 'UNSUPPORTED');
    });

    it('rejects schemaVersion mismatch / stale version', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 2,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /version mismatch/i
      );
    });

    it('rejects unknown spec codes not present in schema', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                unknown_code: { state: 'KNOWN', value: 'bad' },
              },
            },
            sampleSchema
          ),
        /unknown.*unknown_code/i
      );
    });

    it('rejects missing required specs', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                // ram is missing but required
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /required.*ram/i
      );
    });

    it('rejects required spec when marked UNKNOWN', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'UNKNOWN' }, // required cannot be UNKNOWN
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /required.*ram/i
      );
    });

    it('rejects required spec when marked UNSUPPORTED', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'UNSUPPORTED' },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /required.*ram/i
      );
    });

    it('rejects UNSUPPORTED state when allowUnsupported is false or omitted', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                nfc_support: { state: 'UNSUPPORTED' }, // allowUnsupported is false
              },
            },
            sampleSchema
          ),
        /unsupported.*not allowed/i
      );
    });

    it('rejects UNKNOWN state carrying a value', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                os_family: { state: 'UNKNOWN', value: 'MACOS' },
              },
            },
            sampleSchema
          ),
        /UNKNOWN.*no value/i
      );
    });

    it('rejects UNSUPPORTED state carrying a value', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                has_cellular: { state: 'UNSUPPORTED', value: false },
              },
            },
            sampleSchema
          ),
        /UNSUPPORTED.*no value/i
      );
    });

    it('rejects KNOWN state missing value or carrying null/undefined', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN' },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /KNOWN.*value/i
      );
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: null },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /KNOWN.*value/i
      );
    });

    it('rejects type mismatches (INTEGER float, TEXT number, BOOLEAN string, ENUM invalid)', () => {
      // INTEGER with float
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16.5 },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /integer/i
      );

      // TEXT with number
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                color: { state: 'KNOWN', value: 123 },
              },
            },
            sampleSchema
          ),
        /string|text/i
      );

      // BOOLEAN with string
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                has_cellular: { state: 'KNOWN', value: 'true' },
              },
            },
            sampleSchema
          ),
        /boolean/i
      );

      // ENUM with invalid value
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35.5 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                os_family: { state: 'KNOWN', value: 'ANDROID' },
              },
            },
            sampleSchema
          ),
        /enum/i
      );
    });

    it('normalizes compatible units into definition unit (mm -> cm, TB -> GB)', () => {
      const validated = validateProductSpecs(
        {
          schemaVersion: 1,
          values: {
            display_size: { state: 'KNOWN', value: 350, unit: 'mm' }, // definition has cm -> 35 cm
            ram: { state: 'KNOWN', value: 16, unit: 'GB' },
            storage: { state: 'KNOWN', value: 1, unit: 'TB' }, // definition has GB -> 1024 GB
          },
        },
        sampleSchema
      );

      const display = validated.values.display_size;
      assert.equal(display.state, 'KNOWN');
      if (display.state === 'KNOWN') {
        assert.equal(display.value, 35);
        assert.equal(display.unit, 'cm');
      }

      const storage = validated.values.storage;
      assert.equal(storage.state, 'KNOWN');
      if (storage.state === 'KNOWN') {
        assert.equal(storage.value, 1024);
        assert.equal(storage.unit, 'GB');
      }
    });

    it('rejects incompatible units or units on non-numeric specs', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35, unit: 'GB' }, // display is cm
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
              },
            },
            sampleSchema
          ),
        /unit/i
      );

      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
                color: { state: 'KNOWN', value: 'Black', unit: 'mm' }, // TEXT cannot have unit
              },
            },
            sampleSchema
          ),
        /unit/i
      );
    });

    it('rejects unknown root keys in ProductSpecs', () => {
      assert.throws(
        () =>
          validateProductSpecs(
            {
              schemaVersion: 1,
              values: {
                display_size: { state: 'KNOWN', value: 35 },
                ram: { state: 'KNOWN', value: 16 },
                storage: { state: 'KNOWN', value: 512 },
              },
              unrecognizedField: true,
            },
            sampleSchema
          ),
        /unknown key.*unrecognizedField/i
      );
    });
  });

  describe('VariantOptions validation', () => {
    it('validates valid variant options and returns deterministic ordering and optionHash', () => {
      // Input in mixed order
      const input = [
        { code: 'storage', value: 512, unit: 'GB' },
        { code: 'ram', value: 16, unit: 'GB' },
        { code: 'color', value: 'Silver' },
      ];

      const validated = validateVariantOptions(input, sampleSchema);
      assert.equal(validated.options.length, 3);
      // Deterministic sortOrder: ram (sortOrder: 2), storage (3), color (4)
      assert.equal(validated.options[0].code, 'ram');
      assert.equal(validated.options[1].code, 'storage');
      assert.equal(validated.options[2].code, 'color');

      assert.ok(typeof validated.optionHash === 'string');
      assert.equal(validated.optionHash.length, 64);

      // Re-order input: same optionHash must be produced
      const reversedInput = [
        { code: 'color', value: 'Silver' },
        { code: 'ram', value: 16, unit: 'GB' },
        { code: 'storage', value: 512, unit: 'GB' },
      ];
      const validatedReversed = validateVariantOptions(reversedInput, sampleSchema);
      assert.equal(validatedReversed.optionHash, validated.optionHash);
    });

    it('also accepts map/record input for variant options', () => {
      const input = {
        storage: 512,
        ram: 16,
        color: 'Midnight',
      };
      const validated = validateVariantOptions(input, sampleSchema);
      assert.equal(validated.options.length, 3);
      assert.equal(validated.values.ram, 16);
      assert.equal(validated.values.storage, 512);
      assert.equal(validated.values.color, 'Midnight');
    });

    it('rejects duplicate option codes', () => {
      const duplicateInput = [
        { code: 'ram', value: 16 },
        { code: 'ram', value: 32 },
      ];
      assert.throws(
        () => validateVariantOptions(duplicateInput, sampleSchema),
        /duplicate.*ram/i
      );
    });

    it('rejects option code that is not marked as isOption in schema definitions', () => {
      // display_size has isOption: undefined / false
      const input = [{ code: 'display_size', value: 35.5 }];
      assert.throws(
        () => validateVariantOptions(input, sampleSchema),
        /not.*option|isOption/i
      );
    });

    it('rejects unknown option code not in schema', () => {
      const input = [{ code: 'nonexistent_option', value: 'bad' }];
      assert.throws(
        () => validateVariantOptions(input, sampleSchema),
        /unknown.*nonexistent_option/i
      );
    });

    it('normalizes units in variant options (TB -> GB)', () => {
      const input = [
        { code: 'ram', value: 16, unit: 'GB' },
        { code: 'storage', value: 1, unit: 'TB' },
      ];
      const validated = validateVariantOptions(input, sampleSchema);
      const storageOption = validated.options.find((o) => o.code === 'storage');
      assert.ok(storageOption);
      assert.equal(storageOption.value, 1024);
      assert.equal(storageOption.unit, 'GB');
    });

    it('rejects unknown keys in option items', () => {
      const input = [{ code: 'ram', value: 16, extraField: 'nope' }];
      assert.throws(
        () => validateVariantOptions(input, sampleSchema),
        /unknown key.*extraField/i
      );
    });
  });

  describe('CatalogImage validation', () => {
    const validImages: CatalogImage[] = [
      {
        url: 'https://images.example.com/macbook-front.jpg',
        alt: 'MacBook Pro Mặt Trước',
        sortOrder: 0,
        sourceId: 'src_apple_01',
      },
      {
        url: 'https://images.example.com/macbook-side.jpg',
        alt: 'MacBook Pro Cạnh Bên',
        sortOrder: 1,
      },
    ];

    it('validates a bounded, valid list of catalog images', () => {
      const validated = validateCatalogImages(validImages, 10);
      assert.equal(validated.length, 2);
      assert.equal(validated[0].sortOrder, 0);
      assert.equal(validated[1].sortOrder, 1);
    });

    it('rejects non-array input', () => {
      assert.throws(() => validateCatalogImages('not-an-array'), /array/i);
      assert.throws(() => validateCatalogImages(null), /array/i);
    });

    it('rejects images exceeding maxCount', () => {
      assert.throws(
        () => validateCatalogImages(validImages, 1),
        /max|exceed/i
      );
    });

    it('rejects non-http/https URLs', () => {
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'javascript:alert(1)', alt: 'XSS', sortOrder: 0 },
          ]),
        /http|url/i
      );
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'ftp://ftp.example.com/pic.png', alt: 'FTP', sortOrder: 0 },
          ]),
        /http|url/i
      );
    });

    it('rejects duplicate image URLs', () => {
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'https://example.com/img.jpg', alt: 'Img 1', sortOrder: 0 },
            { url: 'https://example.com/img.jpg', alt: 'Img 2', sortOrder: 1 },
          ]),
        /duplicate.*url/i
      );
    });

    it('rejects duplicate sortOrder in images', () => {
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'https://example.com/img1.jpg', alt: 'Img 1', sortOrder: 0 },
            { url: 'https://example.com/img2.jpg', alt: 'Img 2', sortOrder: 0 },
          ]),
        /duplicate.*sortOrder/i
      );
    });

    it('rejects invalid sortOrder (negative or float)', () => {
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'https://example.com/img1.jpg', alt: 'Img 1', sortOrder: -1 },
          ]),
        /sortOrder/i
      );
      assert.throws(
        () =>
          validateCatalogImages([
            { url: 'https://example.com/img1.jpg', alt: 'Img 1', sortOrder: 1.5 },
          ]),
        /sortOrder/i
      );
    });

    it('rejects unknown keys on CatalogImage item', () => {
      assert.throws(
        () =>
          validateCatalogImages([
            {
              url: 'https://example.com/img1.jpg',
              alt: 'Img 1',
              sortOrder: 0,
              unsupportedProp: true,
            },
          ]),
        /unknown key.*unsupportedProp/i
      );
    });
  });

  describe('Measurement normalization & equality', () => {
    it('converts mm <-> cm correctly', () => {
      assert.equal(convertMeasurement(10, 'mm', 'cm'), 1);
      assert.equal(convertMeasurement(2.5, 'cm', 'mm'), 25);
    });

    it('converts GB <-> TB correctly', () => {
      assert.equal(convertMeasurement(1024, 'GB', 'TB'), 1);
      assert.equal(convertMeasurement(2, 'TB', 'GB'), 2048);
    });

    it('handles identity conversion', () => {
      assert.equal(convertMeasurement(16, 'GB', 'GB'), 16);
      assert.equal(convertMeasurement(150, 'mm', 'mm'), 150);
    });

    it('rejects non-finite values (NaN, Infinity)', () => {
      assert.throws(() => convertMeasurement(NaN, 'mm', 'cm'), /finite/i);
      assert.throws(() => convertMeasurement(Infinity, 'GB', 'TB'), /finite/i);
    });

    it('rejects incompatible units conversion', () => {
      assert.throws(() => convertMeasurement(10, 'mm', 'GB'), /incompatible|unsupported/i);
      assert.throws(() => convertMeasurement(500, 'W', 'cm'), /incompatible|unsupported/i);
    });

    it('rejects unknown units', () => {
      assert.throws(() => convertMeasurement(10, 'unknown_unit', 'cm'), /unsupported unit/i);
    });

    it('checks measurement equality across units', () => {
      assert.equal(areMeasurementsEqual(10, 'mm', 1, 'cm'), true);
      assert.equal(areMeasurementsEqual(1, 'TB', 1024, 'GB'), true);
      assert.equal(areMeasurementsEqual(10, 'mm', 2, 'cm'), false);
      assert.equal(areMeasurementsEqual(10, 'mm', 10, 'GB'), false);
    });

    it('identifies compatible units and canonical unit', () => {
      assert.equal(areUnitsCompatible('mm', 'cm'), true);
      assert.equal(areUnitsCompatible('GB', 'TB'), true);
      assert.equal(areUnitsCompatible('mm', 'GB'), false);

      assert.equal(getCanonicalUnit('cm'), 'mm');
      assert.equal(getCanonicalUnit('mm'), 'mm');
      assert.equal(getCanonicalUnit('TB'), 'GB');
      assert.equal(getCanonicalUnit('GB'), 'GB');

      const normCm = normalizeToCanonical(1.5, 'cm');
      assert.equal(normCm.value, 15);
      assert.equal(normCm.unit, 'mm');

      const normTb = normalizeToCanonical(1, 'TB');
      assert.equal(normTb.value, 1024);
      assert.equal(normTb.unit, 'GB');
    });
  });

  describe('canonicalJsonHash', () => {
    it('is deterministic across object key insertion order', () => {
      const obj1 = { b: 2, a: 1, c: { y: 'hello', x: 42 } };
      const obj2 = { c: { x: 42, y: 'hello' }, a: 1, b: 2 };
      assert.equal(canonicalJsonHash(obj1), canonicalJsonHash(obj2));
    });

    it('preserves array order (different array order yields different hash)', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];
      assert.notEqual(canonicalJsonHash(arr1), canonicalJsonHash(arr2));
    });

    it('returns a standard 64-character hex hash', () => {
      const hash = canonicalJsonHash({ test: true });
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it('handles primitives, booleans, and nulls', () => {
      assert.equal(canonicalJsonHash(null), canonicalJsonHash(null));
      assert.notEqual(canonicalJsonHash(null), canonicalJsonHash(0));
      assert.notEqual(canonicalJsonHash(true), canonicalJsonHash('true'));
    });
  });

  describe('Type exports verify', () => {
    it('supports VersionedJson type contract', () => {
      const versioned: VersionedJson<{ name: string }> = {
        schemaVersion: 1,
        value: { name: 'MacBook' },
      };
      assert.equal(versioned.schemaVersion, 1);
      assert.equal(versioned.value.name, 'MacBook');
    });

    it('exports ProductKind and ProductSegment values cleanly', () => {
      const kinds: ProductKind[] = ['LAPTOP', 'PHONE', 'ACCESSORY', 'LEGACY'];
      const segments: ProductSegment[] = ['BUDGET', 'MID_RANGE', 'PREMIUM', 'FLAGSHIP'];
      const knowledgeStates: KnowledgeState[] = ['KNOWN', 'UNKNOWN', 'UNSUPPORTED'];
      const sourceStatuses: SourceStatus[] = [
        'DISCOVERED',
        'LICENSE_REVIEW',
        'MAPPING_REVIEW',
        'APPROVED',
        'ACTIVE',
        'REJECTED',
        'REVOKED',
      ];
      assert.equal(kinds.length, 4);
      assert.equal(segments.length, 4);
      assert.equal(knowledgeStates.length, 3);
      assert.equal(sourceStatuses.length, 7);
    });
  });
});
