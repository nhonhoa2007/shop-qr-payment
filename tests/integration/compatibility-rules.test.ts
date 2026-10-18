import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftCompatibilityRule,
  activateCompatibilityRule,
  revokeCompatibilityRule,
  checkCompatibility,
  listCompatibleAccessories,
  getCompatibilityRule,
} from '../../src/server/modules/compatibility/compatibility.service.ts';
import { redis } from '../../src/server/infrastructure/redis.ts';

// In-memory mock database for isolated integration testing
function createMockDb() {
  const rules = new Map<string, any>();
  const products = new Map<string, any>();
  const variants = new Map<string, any>();
  const categories = new Map<string, any>();
  const users = new Map<string, any>();

  // Seed sample users & roles
  users.set('usr_staff_knowledge', {
    id: 'usr_staff_knowledge',
    email: 'staff_knowledge@shop.vn',
    role: 'STAFF',
    permissions: [{ permission: 'knowledge' }],
  });
  users.set('usr_staff_sales', {
    id: 'usr_staff_sales',
    email: 'staff_sales@shop.vn',
    role: 'STAFF',
    permissions: [{ permission: 'orders' }],
  });
  users.set('usr_admin', {
    id: 'usr_admin',
    email: 'admin@shop.vn',
    role: 'ADMIN',
    permissions: [],
  });

  // Seed sample categories
  categories.set('cat_laptop', {
    id: 'cat_laptop',
    name: 'Laptop',
    slug: 'laptop',
    kind: 'LAPTOP',
  });
  categories.set('cat_charger', {
    id: 'cat_charger',
    name: 'Charger',
    slug: 'charger',
    kind: 'ACCESSORY',
  });

  // Seed sample laptop and charger products & variants
  const macbook = {
    id: 'prod_macbook_pro',
    name: 'MacBook Pro 14 M3',
    categoryId: 'cat_laptop',
    categoryRef: { id: 'cat_laptop', slug: 'laptop' },
    category: 'laptop',
    isActive: true,
    specs: {
      schemaVersion: 1,
      values: {
        charging_port: { state: 'KNOWN', value: 'USB-C' },
        fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
        charging_power_watt: { state: 'KNOWN', value: 70, unit: 'W' },
      },
    },
  };
  products.set('prod_macbook_pro', macbook);

  const macbookVar = {
    id: 'var_macbook_pro',
    productId: 'prod_macbook_pro',
    sku: 'MBP14-M3-512',
    title: 'Space Gray 512GB',
    price: 39990000n,
    stock: 10,
    isActive: true,
    product: macbook,
  };
  variants.set('var_macbook_pro', macbookVar);

  const charger = {
    id: 'prod_gan_100w',
    name: 'UGREEN 100W GaN Fast Charger',
    categoryId: 'cat_charger',
    categoryRef: { id: 'cat_charger', slug: 'charger' },
    category: 'charger',
    isActive: true,
    specs: {
      schemaVersion: 1,
      values: {
        connector_type: { state: 'KNOWN', value: 'USB-C' },
        fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
        charging_power_watt: { state: 'KNOWN', value: 100, unit: 'W' },
      },
    },
  };
  products.set('prod_gan_100w', charger);

  const chargerVar = {
    id: 'var_gan_100w',
    productId: 'prod_gan_100w',
    sku: 'UGREEN-GAN-100W',
    title: 'Black 100W',
    price: 890000n,
    stock: 25,
    isActive: true,
    product: charger,
  };
  variants.set('var_gan_100w', chargerVar);

  return {
    rules,
    products,
    variants,
    categories,
    users,
    compatibilityRule: {
      create: async ({ data }: { data: any }) => {
        const id = data.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const rule = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        rules.set(id, rule);
        return rule;
      },
      update: async ({ where, data }: { where: { id?: string; ruleCode?: string }; data: any }) => {
        const id = where.id || Array.from(rules.values()).find((r) => r.ruleCode === where.ruleCode)?.id;
        if (!id || !rules.has(id)) throw new Error('Rule not found');
        const existing = rules.get(id);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        rules.set(id, updated);
        return updated;
      },
      findUnique: async ({ where }: { where: { id?: string; ruleCode?: string } }) => {
        if (where.id) return rules.get(where.id) || null;
        if (where.ruleCode) {
          return Array.from(rules.values()).find((r) => r.ruleCode === where.ruleCode) || null;
        }
        return null;
      },
      findMany: async ({ where = {} }: { where?: any } = {}) => {
        let list = Array.from(rules.values());
        if (where.status) {
          list = list.filter((r) => r.status === where.status);
        }
        if (where.market) {
          list = list.filter((r) => !r.market || r.market === where.market);
        }
        return list;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return users.get(where.id) || null;
      },
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = products.get(where.id);
        if (!p) return null;
        return { ...p };
      },
      findMany: async ({ where = {} }: { where?: any } = {}) => {
        let list = Array.from(products.values());
        if (where.isActive !== undefined) {
          list = list.filter((p) => p.isActive === where.isActive);
        }
        if (where.categoryId) {
          list = list.filter((p) => p.categoryId === where.categoryId);
        }
        return list;
      },
    },
    productVariant: {
      findUnique: async ({ where, include }: { where: { id?: string; sku?: string }; include?: any }) => {
        let v: any = null;
        if (where.id) v = variants.get(where.id);
        if (where.sku) v = Array.from(variants.values()).find((item) => item.sku === where.sku);
        if (!v) return null;
        if (include?.product) {
          return { ...v, product: products.get(v.productId) };
        }
        return { ...v };
      },
      findMany: async ({ where = {}, include }: { where?: any; include?: any } = {}) => {
        let list = Array.from(variants.values());
        if (where.productId) {
          list = list.filter((v) => v.productId === where.productId);
        }
        if (where.isActive !== undefined) {
          list = list.filter((v) => v.isActive === where.isActive);
        }
        return list.map((v) => (include?.product ? { ...v, product: products.get(v.productId) } : { ...v }));
      },
    },
  };
}

describe('Compatibility Rules - Lifecycle, Governance & Cache Invalidation', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();
    // Clear redis / in-memory cache namespace
    await redis.flushall();
  });

  it('allows knowledge STAFF to draft a rule, but forbids unauthorized users', async () => {
    // 1. Unauthorized staff (sales role without knowledge permission)
    await assert.rejects(
      async () => {
        await draftCompatibilityRule(
          {
            ruleCode: 'RULE-USBC-PD',
            name: 'USB-C PD Laptop Charging',
            direction: 'HOST_TO_ACCESSORY',
            sourceCategoryId: 'cat_laptop',
            targetCategoryId: 'cat_charger',
            conditions: {
              schemaVersion: 1,
              connectors: [{ requiredConnector: 'USB-C' }],
              protocols: [{ requiredProtocol: 'PD_3_0' }],
              power: { minPowerWatt: 45 },
            },
            version: 1,
          },
          'usr_staff_sales',
          mockDb as any
        );
      },
      /forbidden|permission/i
    );

    // 2. Authorized knowledge STAFF can draft
    const draft = await draftCompatibilityRule(
      {
        ruleCode: 'RULE-USBC-PD',
        name: 'USB-C PD Laptop Charging',
        direction: 'HOST_TO_ACCESSORY',
        sourceCategoryId: 'cat_laptop',
        targetCategoryId: 'cat_charger',
        categoryScope: {
          sourceCategories: ['laptop'],
          targetCategories: ['charger'],
        },
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
          protocols: [{ requiredProtocol: 'PD_3_0' }],
          power: { minPowerWatt: 45, strictPowerMatch: true },
        },
        version: 1,
      },
      'usr_staff_knowledge',
      mockDb as any
    );

    assert.equal(draft.status, 'DRAFT');
    assert.equal(draft.createdById, 'usr_staff_knowledge');
    assert.equal(draft.ruleCode, 'RULE-USBC-PD');
  });

  it('requires ADMIN to activate a drafted rule', async () => {
    // Draft the rule first
    const draft = await draftCompatibilityRule(
      {
        ruleCode: 'RULE-USBC-PD',
        name: 'USB-C PD Laptop Charging',
        direction: 'HOST_TO_ACCESSORY',
        sourceCategoryId: 'cat_laptop',
        targetCategoryId: 'cat_charger',
        categoryScope: {
          sourceCategories: ['laptop'],
          targetCategories: ['charger'],
        },
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
          protocols: [{ requiredProtocol: 'PD_3_0' }],
          power: { minPowerWatt: 45, strictPowerMatch: true },
        },
        version: 1,
      },
      'usr_staff_knowledge',
      mockDb as any
    );

    // Staff cannot activate
    await assert.rejects(
      async () => {
        await activateCompatibilityRule(draft.id, 'usr_staff_knowledge', mockDb as any);
      },
      /admin/i
    );

    // Admin can activate
    const activated = await activateCompatibilityRule(draft.id, 'usr_admin', mockDb as any);
    assert.equal(activated.status, 'ACTIVE');
    assert.equal(activated.approvedById, 'usr_admin');
    assert.ok(activated.approvedAt instanceof Date || typeof activated.approvedAt === 'string');
  });

  it('evaluates, caches positive result in Redis, and immediately invalidates cache upon rule revocation', async () => {
    // 1. Create and activate rule
    const draft = await draftCompatibilityRule(
      {
        ruleCode: 'RULE-USBC-PD-100W',
        name: 'High Power USB-C PD Charging',
        direction: 'HOST_TO_ACCESSORY',
        sourceCategoryId: 'cat_laptop',
        targetCategoryId: 'cat_charger',
        categoryScope: {
          sourceCategories: ['laptop'],
          targetCategories: ['charger'],
        },
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
          protocols: [{ requiredProtocol: 'PD_3_0' }],
          power: { strictPowerMatch: true },
        },
        version: 1,
      },
      'usr_staff_knowledge',
      mockDb as any
    );

    await activateCompatibilityRule(draft.id, 'usr_admin', mockDb as any);

    // 2. Perform checkCompatibility -> should be COMPATIBLE and populate cache
    const firstCheck = await checkCompatibility(
      {
        deviceVariantId: 'var_macbook_pro',
        accessoryVariantId: 'var_gan_100w',
      },
      mockDb as any
    );

    assert.equal(firstCheck.status, 'COMPATIBLE');
    assert.equal(firstCheck.matchedRuleCode, 'RULE-USBC-PD-100W');

    // 3. Second check hits cache
    const secondCheck = await checkCompatibility(
      {
        deviceVariantId: 'var_macbook_pro',
        accessoryVariantId: 'var_gan_100w',
      },
      mockDb as any
    );
    assert.equal(secondCheck.status, 'COMPATIBLE');
    assert.equal(secondCheck.cacheHit, true);

    // 4. Revoke the rule with reason
    await revokeCompatibilityRule(
      draft.id,
      'usr_admin',
      'Safety recall: protocol mismatch observed in field',
      mockDb as any
    );

    const revokedRule = await getCompatibilityRule(draft.id, mockDb as any);
    assert.equal(revokedRule.status, 'REVOKED');
    assert.equal(revokedRule.revocationReason, 'Safety recall: protocol mismatch observed in field');

    // 5. Subsequent checkCompatibility MUST NOT return stale COMPATIBLE
    const checkAfterRevoke = await checkCompatibility(
      {
        deviceVariantId: 'var_macbook_pro',
        accessoryVariantId: 'var_gan_100w',
      },
      mockDb as any
    );

    assert.equal(
      checkAfterRevoke.status,
      'UNKNOWN',
      'Revoked rule must immediately invalidate cache and abstain to UNKNOWN'
    );
    assert.equal(checkAfterRevoke.cacheHit, false);
  });

  it('lists compatible accessories for a given device variant', async () => {
    // 1. Setup active rule
    const draft = await draftCompatibilityRule(
      {
        ruleCode: 'RULE-USBC-PD-LIST',
        name: 'USB-C PD Charging List',
        direction: 'HOST_TO_ACCESSORY',
        sourceCategoryId: 'cat_laptop',
        targetCategoryId: 'cat_charger',
        categoryScope: {
          sourceCategories: ['laptop'],
          targetCategories: ['charger'],
        },
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
          protocols: [{ requiredProtocol: 'PD_3_0' }],
          power: { strictPowerMatch: true },
        },
        version: 1,
      },
      'usr_staff_knowledge',
      mockDb as any
    );
    await activateCompatibilityRule(draft.id, 'usr_admin', mockDb as any);

    // 2. Query listCompatibleAccessories
    const accessories = await listCompatibleAccessories('var_macbook_pro', mockDb as any);
    assert.ok(Array.isArray(accessories));
    assert.equal(accessories.length, 1);
    assert.equal(accessories[0].status, 'COMPATIBLE');
    assert.equal(accessories[0].accessory.productId, 'prod_gan_100w');
  });
});
