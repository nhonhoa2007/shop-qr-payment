import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCheckCompatibility,
  handleListCompatibleAccessories,
  handleDraftRule,
  handleActivateRule,
  handleRevokeRule,
} from '../src/server/modules/compatibility/compatibility.controller.ts';
import { revalidateCartCompatibility } from '../src/server/modules/compatibility/compatibility-cart.service.ts';
import { buildEvidenceBundle } from '../src/server/modules/assistant/evidence.service.ts';
import { useCartStore } from '../src/client/stores/cart-store.ts';

// Mock DB for API controller tests
function createApiMockDb() {
  const rules = new Map<string, any>();
  const products = new Map<string, any>();
  const variants = new Map<string, any>();
  const users = new Map<string, any>();

  // Users
  users.set('usr_admin', { id: 'usr_admin', role: 'ADMIN', email: 'admin@shop.vn' });
  users.set('usr_staff_knowledge', {
    id: 'usr_staff_knowledge',
    role: 'STAFF',
    email: 'staff@shop.vn',
    permissions: [{ permission: 'knowledge' }],
  });
  users.set('usr_customer', { id: 'usr_customer', role: 'CUSTOMER', email: 'cust@shop.vn' });

  // Laptop product and variant
  const laptop = {
    id: 'prod_macbook_pro',
    name: 'MacBook Pro 16 M3 Max',
    categoryId: 'cat_laptop',
    category: 'laptop',
    isActive: true,
    price: 69990000n,
    specs: {
      schemaVersion: 1,
      values: {
        charging_port: { state: 'KNOWN', value: 'USB-C' },
        fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
        charging_power_watt: { state: 'KNOWN', value: 140, unit: 'W' },
      },
    },
  };
  products.set('prod_macbook_pro', laptop);

  const laptopVariant = {
    id: 'var_macbook_pro',
    productId: 'prod_macbook_pro',
    sku: 'MBP16-M3-36-512',
    title: 'Space Black / 36GB / 512GB',
    price: 69990000n,
    stock: 5,
    isActive: true,
    product: laptop,
  };
  variants.set('var_macbook_pro', laptopVariant);

  // Charger product and variant (140W compatible)
  const charger140 = {
    id: 'prod_apple_140w',
    name: 'Apple 140W USB-C Power Adapter',
    categoryId: 'cat_charger',
    category: 'charger',
    isActive: true,
    price: 2790000n,
    specs: {
      schemaVersion: 1,
      values: {
        connector_type: { state: 'KNOWN', value: 'USB-C' },
        fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
        charging_power_watt: { state: 'KNOWN', value: 140, unit: 'W' },
      },
    },
  };
  products.set('prod_apple_140w', charger140);

  const charger140Variant = {
    id: 'var_apple_140w',
    productId: 'prod_apple_140w',
    sku: 'APPLE-140W-USBC',
    title: 'Standard White',
    price: 2790000n,
    stock: 15,
    isActive: true,
    product: charger140,
  };
  variants.set('var_apple_140w', charger140Variant);

  // Incompatible 30W charger
  const charger30 = {
    id: 'prod_charger_30w',
    name: 'Compact 30W Phone Charger',
    categoryId: 'cat_charger',
    category: 'charger',
    isActive: true,
    price: 490000n,
    specs: {
      schemaVersion: 1,
      values: {
        connector_type: { state: 'KNOWN', value: 'USB-C' },
        fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
        charging_power_watt: { state: 'KNOWN', value: 30, unit: 'W' },
      },
    },
  };
  products.set('prod_charger_30w', charger30);

  const charger30Variant = {
    id: 'var_charger_30w',
    productId: 'prod_charger_30w',
    sku: 'PHONE-30W-USBC',
    title: 'Black 30W',
    price: 490000n,
    stock: 20,
    isActive: true,
    product: charger30,
  };
  variants.set('var_charger_30w', charger30Variant);

  // Unknown accessory (missing protocol & wattage)
  const unknownAccessory = {
    id: 'prod_generic_hub',
    name: 'Generic USB-C Dongle',
    categoryId: 'cat_hub',
    category: 'hub',
    isActive: true,
    price: 350000n,
    specs: {
      schemaVersion: 1,
      values: {
        connector_type: { state: 'KNOWN', value: 'USB-C' },
      },
    },
  };
  products.set('prod_generic_hub', unknownAccessory);

  const unknownVariant = {
    id: 'var_generic_hub',
    productId: 'prod_generic_hub',
    sku: 'GEN-HUB-USBC',
    title: 'Gray Dongle',
    price: 350000n,
    stock: 12,
    isActive: true,
    product: unknownAccessory,
  };
  variants.set('var_generic_hub', unknownVariant);

  // Active Rule
  const activeRule = {
    id: 'rule_active_pd',
    ruleCode: 'RULE-USBC-PD-LAPTOPS',
    name: 'High Performance Laptop USB-C PD Charging',
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
      power: { minPowerWatt: 100, strictPowerMatch: true },
    },
    market: 'VN',
    version: 1,
    status: 'ACTIVE',
  };
  rules.set('rule_active_pd', activeRule);

  return {
    rules,
    products,
    variants,
    users,
    compatibilityRule: {
      create: async ({ data }: { data: any }) => {
        const id = data.id || `rule_${Date.now()}`;
        const created = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
        rules.set(id, created);
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = rules.get(where.id);
        if (!existing) throw new Error('Rule not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        rules.set(where.id, updated);
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
        if (where.status) list = list.filter((r) => r.status === where.status);
        return list;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) || null,
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => products.get(where.id) || null,
      findMany: async ({ where = {} }: { where?: any } = {}) => {
        let list = Array.from(products.values());
        if (where.isActive !== undefined) list = list.filter((p) => p.isActive === where.isActive);
        return list;
      },
    },
    productVariant: {
      findUnique: async ({ where, include }: { where: { id?: string; sku?: string }; include?: any }) => {
        const v = where.id ? variants.get(where.id) : Array.from(variants.values()).find((item) => item.sku === where.sku);
        if (!v) return null;
        if (include?.product) {
          return { ...v, product: products.get(v.productId) };
        }
        return { ...v };
      },
      findMany: async ({ where = {}, include }: { where?: any; include?: any } = {}) => {
        let list = Array.from(variants.values());
        if (where.isActive !== undefined) list = list.filter((v) => v.isActive === where.isActive);
        return list.map((v) => (include?.product ? { ...v, product: products.get(v.productId) } : { ...v }));
      },
    },
    dataSource: {
      findMany: async () => [],
    },
  };
}

describe('Compatibility Public & Admin API Controllers', () => {
  let mockDb: ReturnType<typeof createApiMockDb>;

  beforeEach(() => {
    mockDb = createApiMockDb();
  });

  it('evaluates exact variant compatibility via handleCheckCompatibility', async () => {
    const res = await handleCheckCompatibility(
      {
        deviceVariantId: 'var_macbook_pro',
        accessoryVariantId: 'var_apple_140w',
      },
      mockDb as any
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'COMPATIBLE');
    assert.equal(res.data.device.productId, 'prod_macbook_pro');
    assert.equal(res.data.accessory.productId, 'prod_apple_140w');
    assert.equal(res.data.matchedRuleCode, 'RULE-USBC-PD-LAPTOPS');
  });

  it('rejects check compatibility when query parameters are missing', async () => {
    const res = await handleCheckCompatibility({}, mockDb as any);
    assert.equal(res.status, 400);
    assert.ok(res.error?.includes('deviceVariantId') || res.error?.includes('deviceProductId'));
  });

  it('lists compatible accessories for a host device', async () => {
    const res = await handleListCompatibleAccessories('var_macbook_pro', mockDb as any);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].accessory.productId, 'prod_apple_140w');
  });

  it('enforces RBAC on admin rule operations', async () => {
    // 1. Customer cannot draft rule
    const customerRes = await handleDraftRule(
      {
        ruleCode: 'RULE-NEW',
        name: 'New Rule',
        direction: 'HOST_TO_ACCESSORY',
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
        },
      },
      'usr_customer',
      mockDb as any
    );
    assert.equal(customerRes.status, 403);

    // 2. Knowledge staff can draft rule
    const staffRes = await handleDraftRule(
      {
        ruleCode: 'RULE-NEW',
        name: 'New Rule',
        direction: 'HOST_TO_ACCESSORY',
        conditions: {
          schemaVersion: 1,
          connectors: [{ requiredConnector: 'USB-C' }],
        },
      },
      'usr_staff_knowledge',
      mockDb as any
    );
    assert.equal(staffRes.status, 201);
    assert.equal(staffRes.data.status, 'DRAFT');

    // 3. Staff cannot activate rule (requires ADMIN)
    const staffActivateRes = await handleActivateRule(staffRes.data.id, 'usr_staff_knowledge', mockDb as any);
    assert.equal(staffActivateRes.status, 403);

    // 4. Admin can activate
    const adminActivateRes = await handleActivateRule(staffRes.data.id, 'usr_admin', mockDb as any);
    assert.equal(adminActivateRes.status, 200);
    assert.equal(adminActivateRes.data.status, 'ACTIVE');

    // 5. Admin can revoke
    const revokeRes = await handleRevokeRule(staffRes.data.id, 'usr_admin', 'Superseded', mockDb as any);
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.data.status, 'REVOKED');
  });
});

describe('Cart Store Add-On Preservation & Local State', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('preserves main device when an attached add-on accessory is removed', () => {
    const store = useCartStore.getState();

    // Add main device
    store.addItem({
      productId: 'prod_macbook_pro',
      name: 'MacBook Pro 16',
      price: 69990000,
      variantId: 'var_macbook_pro',
      variantTitle: 'Space Black',
    });

    // Add add-on accessory attached to main device
    store.addItem({
      productId: 'prod_apple_140w',
      name: 'Apple 140W Adapter',
      price: 2790000,
      variantId: 'var_apple_140w',
      variantTitle: 'White',
      attachedToVariantId: 'var_macbook_pro',
      isAddon: true,
    } as any);

    assert.equal(useCartStore.getState().items.length, 2);

    // Remove only the add-on accessory
    useCartStore.getState().removeItem('prod_apple_140w', 'var_apple_140w');

    const remainingItems = useCartStore.getState().items;
    assert.equal(remainingItems.length, 1);
    assert.equal(remainingItems[0].productId, 'prod_macbook_pro');
    assert.equal(remainingItems[0].variantId, 'var_macbook_pro');
  });
});

describe('Server-Side Cart & Checkout Compatibility Revalidation', () => {
  let mockDb: ReturnType<typeof createApiMockDb>;

  beforeEach(() => {
    mockDb = createApiMockDb();
  });

  it('ignores client-forged COMPATIBLE status for an incompatible accessory and rejects', async () => {
    // Client sends laptop + 30W charger, maliciously claiming "COMPATIBLE"
    const clientItems = [
      {
        productId: 'prod_macbook_pro',
        variantId: 'var_macbook_pro',
        quantity: 1,
        price: 69990000,
      },
      {
        productId: 'prod_charger_30w',
        variantId: 'var_charger_30w',
        quantity: 1,
        price: 490000,
        attachedToVariantId: 'var_macbook_pro',
        isAddon: true,
        claimedCompatibilityStatus: 'COMPATIBLE', // FORGED!
      },
    ];

    const result = await revalidateCartCompatibility(clientItems, mockDb as any);
    assert.equal(result.valid, false);
    assert.equal(result.status, 422);
    assert.ok(
      result.error?.toLowerCase().includes('incompatible') || result.error?.toLowerCase().includes('không tương thích'),
      `Expected incompatible error, got: ${result.error}`
    );
  });

  it('rejects with 409 Conflict when accessory has a stale price or is inactive', async () => {
    // 1. Stale price: Client claims 140W charger is 2,000,000đ, but DB price is 2,790,000đ
    const stalePriceItems = [
      {
        productId: 'prod_macbook_pro',
        variantId: 'var_macbook_pro',
        quantity: 1,
        price: 69990000,
      },
      {
        productId: 'prod_apple_140w',
        variantId: 'var_apple_140w',
        quantity: 1,
        price: 2000000, // STALE!
        attachedToVariantId: 'var_macbook_pro',
        isAddon: true,
      },
    ];

    const priceResult = await revalidateCartCompatibility(stalePriceItems, mockDb as any);
    assert.equal(priceResult.valid, false);
    assert.equal(priceResult.status, 409);
    assert.ok(priceResult.error?.toLowerCase().includes('giá') || priceResult.error?.toLowerCase().includes('price'));

    // 2. Inactive accessory
    const charger = mockDb.variants.get('var_apple_140w');
    charger.isActive = false;

    const normalItems = [
      {
        productId: 'prod_macbook_pro',
        variantId: 'var_macbook_pro',
        quantity: 1,
        price: 69990000,
      },
      {
        productId: 'prod_apple_140w',
        variantId: 'var_apple_140w',
        quantity: 1,
        price: 2790000,
        attachedToVariantId: 'var_macbook_pro',
        isAddon: true,
      },
    ];

    const inactiveResult = await revalidateCartCompatibility(normalItems, mockDb as any);
    assert.equal(inactiveResult.valid, false);
    assert.equal(inactiveResult.status, 409);
    assert.ok(inactiveResult.error?.toLowerCase().includes('ngừng bán') || inactiveResult.error?.toLowerCase().includes('inactive'));
  });

  it('requires caveat acknowledgment to select/checkout UNKNOWN compatibility accessory', async () => {
    // Unknown dongle without caveat acknowledged -> rejected
    const unacknowledgedItems = [
      {
        productId: 'prod_macbook_pro',
        variantId: 'var_macbook_pro',
        quantity: 1,
        price: 69990000,
      },
      {
        productId: 'prod_generic_hub',
        variantId: 'var_generic_hub',
        quantity: 1,
        price: 350000,
        attachedToVariantId: 'var_macbook_pro',
        isAddon: true,
        caveatAcknowledged: false, // NOT ACKNOWLEDGED
      },
    ];

    const unackResult = await revalidateCartCompatibility(unacknowledgedItems, mockDb as any);
    assert.equal(unackResult.valid, false);
    assert.equal(unackResult.status, 422);
    assert.ok(
      unackResult.error?.toLowerCase().includes('caveat') ||
      unackResult.error?.toLowerCase().includes('xác nhận') ||
      unackResult.error?.toLowerCase().includes('unknown')
    );

    // With caveat acknowledged -> valid
    const acknowledgedItems = [
      {
        productId: 'prod_macbook_pro',
        variantId: 'var_macbook_pro',
        quantity: 1,
        price: 69990000,
      },
      {
        productId: 'prod_generic_hub',
        variantId: 'var_generic_hub',
        quantity: 1,
        price: 350000,
        attachedToVariantId: 'var_macbook_pro',
        isAddon: true,
        caveatAcknowledged: true, // ACKNOWLEDGED
      },
    ];

    const ackResult = await revalidateCartCompatibility(acknowledgedItems, mockDb as any);
    assert.equal(ackResult.valid, true);
    assert.equal(ackResult.status, 200);
  });
});

describe('Assistant Grounded Evidence Bundle with Compatibility Citations', () => {
  let mockDb: ReturnType<typeof createApiMockDb>;

  beforeEach(() => {
    mockDb = createApiMockDb();
  });

  it('includes active COMPATIBILITY_RULE citation in assistant evidence bundle when query relates to accessories', async () => {
    const bundle = await buildEvidenceBundle(
      {
        query: 'Tư vấn sạc phù hợp cho MacBook Pro',
        productIds: ['prod_macbook_pro'],
      },
      mockDb as any
    );

    assert.ok(bundle);
    assert.ok(bundle.citations);
    const citationsList = Object.values(bundle.citations);
    const hasCompatCitation = citationsList.some((c) => c.type === 'COMPATIBILITY_RULE');
    assert.ok(hasCompatCitation, 'Assistant evidence bundle must include COMPATIBILITY_RULE citations for active rules');
  });
});
