// tests/chat-reviews-operator.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Chat and Reviews Operator Guards', () => {
  it('should authorize staff with chat permission to access chat features', () => {
    const user = { role: 'STAFF', permissions: ['chat'] };
    assert.equal(resolveOperatorAccess(user, 'chat'), true);
    assert.equal(resolveOperatorAccess(user, 'reviews'), false);
  });

  it('should authorize staff with reviews permission to moderate reviews', () => {
    const user = { role: 'STAFF', permissions: ['reviews'] };
    assert.equal(resolveOperatorAccess(user, 'reviews'), true);
    assert.equal(resolveOperatorAccess(user, 'chat'), false);
  });
});
