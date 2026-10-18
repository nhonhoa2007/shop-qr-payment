import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactAuditPayload,
  appendAdminAudit,
} from '@server/modules/admin/audit-log.service';
import type { AdminAuditInput } from '@shared/types/audit-log';

describe('Admin Audit Log - Privacy & Immutability', () => {
  describe('redactAuditPayload', () => {
    it('redacts sensitive fields: password, token, secret, otp, apiKey, rawWebhookData', () => {
      const payload = {
        userId: 'u1',
        email: 'admin@shop.vn',
        password: 'superSecretPassword123!',
        passwordHash: '$argon2id$v=19$m=19456...',
        token: 'eyJhGciOiJIUzI1Ni...',
        apiKey: 'sk-ant-api03-...',
        otpCode: '123456',
        secret: 'webhook_secret_xyz',
        rawWebhookData: { accountNo: '1234567890', amount: 50000 },
        allowedField: 'safeValue',
        price: 25000000,
      };

      const redacted: any = redactAuditPayload('USER_UPDATE', payload);

      assert.equal(redacted.allowedField, 'safeValue');
      assert.equal(redacted.price, 25000000);
      assert.equal(redacted.userId, 'u1');
      assert.equal(redacted.email, 'admin@shop.vn');

      // Sensitive fields must be redacted or removed
      assert.equal(redacted.password, '[REDACTED]');
      assert.equal(redacted.passwordHash, '[REDACTED]');
      assert.equal(redacted.token, '[REDACTED]');
      assert.equal(redacted.apiKey, '[REDACTED]');
      assert.equal(redacted.otpCode, '[REDACTED]');
      assert.equal(redacted.secret, '[REDACTED]');
      assert.equal(redacted.rawWebhookData, '[REDACTED]');
    });

    it('masks serial/IMEI identifiers in audit payloads', () => {
      const payload = {
        serialNumber: 'C02F1234ABCD',
        imei1: '352099101234567',
        imei2: '352099101234568',
        sku: 'LAPTOP-PRO',
      };

      const redacted: any = redactAuditPayload('SERIAL_ASSIGN', payload);
      assert.equal(redacted.sku, 'LAPTOP-PRO');
      assert.equal(redacted.serialNumber, 'C02F****ABCD');
      assert.equal(redacted.imei1, '3520*******4567');
      assert.equal(redacted.imei2, '3520*******4568');
    });

    it('handles nested objects recursively', () => {
      const payload = {
        config: {
          subToken: 'secret_nested',
          validConfig: 'active',
        },
      };

      const redacted: any = redactAuditPayload('CONFIG_UPDATE', payload);
      assert.equal(redacted.config.validConfig, 'active');
      assert.equal(redacted.config.subToken, '[REDACTED]');
    });
  });

  describe('appendAdminAudit & Immutability', () => {
    function createMockAuditDb() {
      const logs: any[] = [];
      const tx: any = {
        adminAuditLog: {
          findUnique: async ({ where }: any) => {
            return logs.find((l) => l.operationKey === where.operationKey) ?? null;
          },
          create: async ({ data }: any) => {
            const entry = { id: `log_${logs.length + 1}`, createdAt: new Date(), ...data };
            logs.push(entry);
            return entry;
          },
        },
        _getLogs: () => logs,
      };
      return tx;
    }

    it('appends audit log idempotently and applies redaction to beforeState/afterState', async () => {
      const db = createMockAuditDb();

      const input: AdminAuditInput = {
        operationKey: 'audit:product_price_change:100',
        actorId: 'admin_1',
        actorEmail: 'admin@shop.vn',
        actorRole: 'ADMIN',
        action: 'PRICE_UPDATE',
        entityType: 'Product',
        entityId: 'prod_999',
        beforeState: { price: 20000000, secretNote: 'secret_before' },
        afterState: { price: 22000000, secretNote: 'secret_after' },
        reason: 'Inflation price adjustment',
      };

      await appendAdminAudit(db, input);
      assert.equal(db._getLogs().length, 1);

      const entry = db._getLogs()[0];
      assert.equal(entry.action, 'PRICE_UPDATE');
      assert.equal(entry.beforeState.price, 20000000);
      assert.equal(entry.beforeState.secretNote, '[REDACTED]');
      assert.equal(entry.afterState.price, 22000000);
      assert.equal(entry.afterState.secretNote, '[REDACTED]');

      // Replay: same operationKey must not create duplicate log entry
      await appendAdminAudit(db, input);
      assert.equal(db._getLogs().length, 1);
    });

    it('proves audit log is immutable (no update or delete operations exported)', async () => {
      const auditModule = await import('@server/modules/admin/audit-log.service');
      assert.equal(typeof (auditModule as any).updateAdminAudit, 'undefined');
      assert.equal(typeof (auditModule as any).deleteAdminAudit, 'undefined');
      assert.equal(typeof (auditModule as any).removeAdminAudit, 'undefined');
    });
  });
});
