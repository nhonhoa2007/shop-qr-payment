import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canDismissConfirmDialog } from '@client/components/ui/confirm-dialog-policy';

describe('confirmation dismissal policy', () => {
  it('allows closing with Escape, overlay, or Cancel while idle', () => {
    assert.equal(canDismissConfirmDialog(false), true);
  });

  it('keeps a pending confirmation open while its action is processing', () => {
    assert.equal(canDismissConfirmDialog(true), false);
  });
});
