// tests/schema-permission.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema StaffPermission Model', () => {
  it('should define StaffPermission model with required relations and indexes', () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf8');

    assert.ok(content.includes('model StaffPermission {'), 'Missing StaffPermission model');
    assert.ok(content.includes('userId     String'), 'Missing userId in StaffPermission');
    assert.ok(content.includes('permission String'), 'Missing permission in StaffPermission');
    assert.ok(content.includes('grantedBy  String'), 'Missing grantedBy in StaffPermission');
    assert.ok(content.includes('@@unique([userId, permission])'), 'Missing composite unique constraint');
    assert.ok(content.includes('staffPermissions   StaffPermission[]'), 'Missing relation in User model');
  });
});
