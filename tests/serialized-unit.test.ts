import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSerialIdentifiers,
  maskIdentifier,
  validateSerialIdentifiers,
} from '@server/modules/inventory/serialized-unit.service';
import type { SerialIdentifiersInput } from '@shared/types/serialized-unit';

describe('Serialized Unit - Normalization & Masking', () => {
  describe('normalizeSerialIdentifiers', () => {
    it('trims whitespace, converts serial to uppercase, and converts empty strings to null', () => {
      const input: SerialIdentifiersInput = {
        serialNumber: '  c02f1234abcd  ',
        imei1: '  352099101234567  ',
        imei2: '   ',
      };

      const normalized = normalizeSerialIdentifiers(input);
      assert.equal(normalized.serialNumber, 'C02F1234ABCD');
      assert.equal(normalized.imei1, '352099101234567');
      assert.equal(normalized.imei2, null);
    });

    it('cleans formatting punctuation (dashes/spaces) from IMEIs', () => {
      const input: SerialIdentifiersInput = {
        serialNumber: 'sn-999',
        imei1: '3520-9910-1234-567',
      };

      const normalized = normalizeSerialIdentifiers(input);
      assert.equal(normalized.imei1, '352099101234567');
    });

    it('returns nulls when no identifiers provided', () => {
      const normalized = normalizeSerialIdentifiers({});
      assert.equal(normalized.serialNumber, null);
      assert.equal(normalized.imei1, null);
      assert.equal(normalized.imei2, null);
    });
  });

  describe('validateSerialIdentifiers', () => {
    it('validates 15-digit standard IMEI format', () => {
      assert.equal(validateSerialIdentifiers({ imei1: '352099101234567' }).valid, true);
      assert.equal(validateSerialIdentifiers({ imei1: '123' }).valid, false);
      assert.equal(validateSerialIdentifiers({ imei1: '35209910123456A' }).valid, false);
    });

    it('rejects duplicate imei1 and imei2', () => {
      const res = validateSerialIdentifiers({
        imei1: '352099101234567',
        imei2: '352099101234567',
      });
      assert.equal(res.valid, false);
      assert.match(res.error || '', /duplicate/i);
    });
  });

  describe('maskIdentifier', () => {
    it('masks serial numbers preserving prefix and suffix', () => {
      assert.equal(maskIdentifier('C02F1234ABCD'), 'C02F****ABCD');
      assert.equal(maskIdentifier('352099101234567'), '3520*******4567');
    });

    it('handles short identifiers safely', () => {
      assert.equal(maskIdentifier('ABCD'), '****');
      assert.equal(maskIdentifier(''), '');
      assert.equal(maskIdentifier(null), null);
    });
  });
});
