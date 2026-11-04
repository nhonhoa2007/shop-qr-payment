import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertVariantRemovalAllowed } from '@server/modules/products/variant-removal-policy';

describe('variant removal policy', () => {
  const existing = [{ id: 'v1' }, { id: 'v2' }];

  it('rejects omitted existing variants for STAFF', () => {
    assert.throws(
      () => assertVariantRemovalAllowed('STAFF', existing, [{ id: 'v1' }]),
      /Unauthorized:/
    );
  });

  it('allows STAFF to update and add variants without removing one', () => {
    assert.doesNotThrow(() => assertVariantRemovalAllowed('STAFF', existing, [{ id: 'v1' }, { id: 'v2' }, {}]));
  });

  it('allows ADMIN to remove a variant', () => {
    assert.doesNotThrow(() => assertVariantRemovalAllowed('ADMIN', existing, [{ id: 'v1' }]));
  });
});
