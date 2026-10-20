import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationType } from '@prisma/client';

describe('System alert notification contract', () => {
  it('exposes SYSTEM_ALERT through the generated Prisma notification enum', () => {
    assert.equal(NotificationType.SYSTEM_ALERT, 'SYSTEM_ALERT');
  });
});
