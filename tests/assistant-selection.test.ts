import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toggleAssistantSelection } from '../src/client/lib/assistant-selection.ts';
const card = (productId: string, categoryId = 'laptop', variantId?: string) => ({ productId, categoryId, variantId, name: productId });
describe('Assistant comparison selection', () => {
  it('toggles references, accepts exactly two and keeps the selection when a third is clicked', () => {
    const a = toggleAssistantSelection([], card('a'));
    assert.equal(a.selected.length, 1);
    const b = toggleAssistantSelection(a.selected, card('b'));
    assert.equal(b.selected.length, 2);
    const third = toggleAssistantSelection(b.selected, card('c'));
    assert.equal(third.selected.length, 2); assert.ok(third.error);
    assert.equal(toggleAssistantSelection(b.selected, card('a')).selected.length, 1);
  });
  it('rejects mismatched categories and preserves distinct variant identity', () => {
    assert.ok(toggleAssistantSelection([card('a')], card('phone','phone')).error);
    const variants = toggleAssistantSelection([card('a','laptop','v1')], card('a','laptop','v2'));
    assert.equal(variants.selected.length, 2);
  });
});
