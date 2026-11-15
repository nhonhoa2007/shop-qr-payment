import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLocationAccuracy, getAddressAutofillLevel, getLocationAreaCandidate } from '../src/client/lib/geolocation.ts';

test('coordinates below one kilometer auto-fill the matched address without downgrading the ward', () => {
  for (const accuracy of [0, 200, 201, 500, 999.99]) {
    const quality = classifyLocationAccuracy(accuracy);
    assert.equal(getAddressAutofillLevel(quality, 'WARD'), 'WARD');
    assert.equal(getAddressAutofillLevel(quality, 'DISTRICT'), 'DISTRICT');
    assert.equal(getAddressAutofillLevel(quality, 'PROVINCE'), 'PROVINCE');
    assert.equal(getAddressAutofillLevel(quality, 'NONE'), 'NONE');
  }
});

test('coordinates at or above one kilometer require confirmation before auto-filling', () => {
  for (const accuracy of [1000, 1000.01, 2000]) {
    assert.equal(getAddressAutofillLevel(classifyLocationAccuracy(accuracy), 'WARD'), 'NONE');
  }
  assert.equal(getAddressAutofillLevel('UNRELIABLE', 'WARD'), 'NONE');
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
