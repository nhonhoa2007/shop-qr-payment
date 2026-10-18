import type {
  AssignmentInput,
  NormalizedSerialIdentifiers,
  RegisterUnitsInput,
  SerialIdentifiersInput,
  SerializationReadiness,
} from '@shared/types/serialized-unit';

export function normalizeSerialIdentifiers(
  input: SerialIdentifiersInput
): NormalizedSerialIdentifiers {
  const normalize = (val: string | null | undefined): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const cleanImei = (val: string | null | undefined): string | null => {
    const raw = normalize(val);
    if (!raw) return null;
    // Strip hyphens, spaces, dots
    const cleaned = raw.replace(/[-\s.]/g, '');
    return cleaned.length > 0 ? cleaned : null;
  };

  const rawSerial = normalize(input.serialNumber);
  const serialNumber = rawSerial ? rawSerial.toUpperCase() : null;
  const imei1 = cleanImei(input.imei1);
  const imei2 = cleanImei(input.imei2);

  return {
    serialNumber,
    imei1,
    imei2,
  };
}

export function validateSerialIdentifiers(
  input: SerialIdentifiersInput
): { valid: boolean; error?: string } {
  const { serialNumber, imei1, imei2 } = normalizeSerialIdentifiers(input);

  const imeiRegex = /^\d{15}$/;
  if (imei1 && !imeiRegex.test(imei1)) {
    return { valid: false, error: 'IMEI1 must be a 15-digit number' };
  }

  if (imei2 && !imeiRegex.test(imei2)) {
    return { valid: false, error: 'IMEI2 must be a 15-digit number' };
  }

  if (imei1 && imei2 && imei1 === imei2) {
    return { valid: false, error: 'IMEI1 and IMEI2 cannot be duplicate values' };
  }

  return { valid: true };
}

export function maskIdentifier(identifier: string | null | undefined): string | null {
  if (identifier === null || identifier === undefined) return null;
  if (identifier.length === 0) return '';
  if (identifier.length <= 4) return '****';

  if (identifier.length <= 8) {
    const prefix = identifier.slice(0, 2);
    const suffix = identifier.slice(-2);
    const maskLen = identifier.length - 4;
    return `${prefix}${'*'.repeat(maskLen)}${suffix}`;
  }

  const prefix = identifier.slice(0, 4);
  const suffix = identifier.slice(-4);
  const maskLen = identifier.length - 8;
  return `${prefix}${'*'.repeat(maskLen)}${suffix}`;
}

export async function registerSerializedUnitsOnReceipt(
  tx: any,
  input: RegisterUnitsInput
): Promise<{ registeredCount: number; units: any[] }> {
  const created: any[] = [];

  for (const rawUnit of input.units) {
    const normalized = normalizeSerialIdentifiers(rawUnit);
    const validation = validateSerialIdentifiers(normalized);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid serial / IMEI identifiers');
    }

    const unit = await tx.serializedUnit.create({
      data: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        purchaseOrderItemId: input.purchaseOrderItemId ?? null,
        supplierId: input.supplierId ?? null,
        status: 'AVAILABLE',
        serialNumber: normalized.serialNumber,
        imei1: normalized.imei1,
        imei2: normalized.imei2,
      },
    });
    created.push(unit);
  }

  return { registeredCount: created.length, units: created };
}

export async function assignSerializedUnits(
  tx: any,
  input: AssignmentInput
): Promise<void> {
  for (const unitId of input.unitIds) {
    const unit = await tx.serializedUnit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      throw new Error(`Serialized unit '${unitId}' not found`);
    }

    if (unit.status !== 'AVAILABLE') {
      throw new Error(
        `Serialized unit '${unitId}' is not available for assignment (status: ${unit.status})`
      );
    }

    if (unit.productId !== input.productId) {
      throw new Error(
        `Serialized unit product mismatch: expected ${input.productId}, got ${unit.productId}`
      );
    }

    if (input.variantId && unit.variantId && unit.variantId !== input.variantId) {
      throw new Error(
        `Serialized unit variant mismatch: expected ${input.variantId}, got ${unit.variantId}`
      );
    }

    const updated = await tx.serializedUnit.updateMany({
      where: {
        id: unitId,
        status: 'AVAILABLE',
      },
      data: {
        status: 'ASSIGNED',
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        assignedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new Error(`Concurrent assignment conflict for unit '${unitId}'`);
    }
  }
}

export async function assertOrderSerializationReady(
  tx: any,
  orderId: string,
  options?: {
    allowLegacyAdminOverride?: boolean;
    overrideReason?: string;
    adminUserId?: string;
  }
): Promise<SerializationReadiness> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true, variant: true },
      },
    },
  });

  if (!order) {
    throw new Error(`Order '${orderId}' not found`);
  }

  let totalMissing = 0;
  const details = [];

  for (const item of order.items || []) {
    const isDevice =
      item.product?.kind === 'LAPTOP' ||
      item.product?.kind === 'PHONE' ||
      item.variant?.serializationRequired === true;

    if (!isDevice) {
      details.push({
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        required: false,
        orderedQuantity: item.quantity,
        assignedCount: item.quantity,
      });
      continue;
    }

    const assignedUnits = await tx.serializedUnit.findMany({
      where: {
        orderItemId: item.id,
        status: { in: ['ASSIGNED', 'SOLD'] },
      },
    });

    const assignedCount = assignedUnits.length;
    const missing = Math.max(0, item.quantity - assignedCount);
    totalMissing += missing;

    details.push({
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId ?? null,
      required: true,
      orderedQuantity: item.quantity,
      assignedCount,
    });
  }

  if (totalMissing > 0) {
    if (options?.allowLegacyAdminOverride && options.adminUserId && options.overrideReason) {
      return {
        ready: true,
        orderId,
        missingCount: totalMissing,
        overridden: true,
        overrideReason: options.overrideReason,
        details,
      };
    }

    return {
      ready: false,
      orderId,
      missingCount: totalMissing,
      details,
    };
  }

  return {
    ready: true,
    orderId,
    missingCount: 0,
    details,
  };
}

export async function markOrderUnitsSold(tx: any, orderId: string): Promise<number> {
  const result = await tx.serializedUnit.updateMany({
    where: {
      orderId,
      status: 'ASSIGNED',
    },
    data: {
      status: 'SOLD',
      soldAt: new Date(),
    },
  });
  return result.count;
}
