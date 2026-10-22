import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAddressAutofillLevel, getLocationAreaCandidate } from '../src/client/lib/geolocation.ts';

test('coarse coordinates never auto-fill a street or ward', () => {
  assert.equal(getAddressAutofillLevel('UNRELIABLE', 'WARD'), 'NONE');
  assert.equal(getAddressAutofillLevel('APPROXIMATE', 'WARD'), 'DISTRICT');
  assert.equal(getAddressAutofillLevel('PRECISE', 'WARD'), 'WARD');
});

test('recognized coarse location offers a confirmable province and district', () => {
  assert.deepEqual(getLocationAreaCandidate({ provinceId: 'dn', districtId: 1529 }), {
    provinceId: 'dn',
    provinceName: 'Đà Nẵng',
    districtId: 1529,
    districtName: 'Quận Ngũ Hành Sơn',
  });
});

test('unrecognized district cannot be offered as a confirmed delivery district', () => {
  assert.deepEqual(getLocationAreaCandidate({ provinceId: 'dn', districtId: 999999 }), {
    provinceId: 'dn',
    provinceName: 'Đà Nẵng',
    districtId: null,
    districtName: null,
  });
  assert.equal(getLocationAreaCandidate({ provinceId: null, districtId: 1529 }), null);
});
