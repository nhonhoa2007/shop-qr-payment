import type { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface AdjustStockInput {
  productId: string;
  variantId: string | null;
  delta: number;
  expectedVersion: number;
  reason: string;
  operationKey: string;
}

export interface StockAdjustmentResult {
  success: boolean;
  error?: string;
  alreadyProcessed?: boolean;
  productId: string;
  variantId: string | null;
  previousStock: number;
  newStock: number;
  newVersion: number;
  adjustmentId?: string;
}

export function validateAdjustmentInput(raw: unknown): {
  valid: boolean;
  data?: AdjustStockInput;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Dữ liệu điều chỉnh tồn kho không hợp lệ' };
  }

  const input = raw as Record<string, unknown>;
  const productId = typeof input.productId === 'string' ? input.productId.trim() : '';
  if (!productId) {
    return { valid: false, error: 'Thiếu mã sản phẩm (productId)' };
  }

  const variantId =
    typeof input.variantId === 'string' && input.variantId.trim()
      ? input.variantId.trim()
      : null;

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) {
    return { valid: false, error: 'Lý do điều chỉnh tồn kho không được để trống' };
  }

  const operationKey =
    typeof input.operationKey === 'string' ? input.operationKey.trim() : '';
  if (!operationKey) {
    return { valid: false, error: 'Mã thao tác (operationKey) không được để trống' };
  }

  const delta = Number(input.delta);
  if (!Number.isInteger(delta) || delta === 0) {
    return { valid: false, error: 'Số lượng điều chỉnh (delta) phải là số nguyên khác 0' };
  }

  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return { valid: false, error: 'Phiên bản kỳ vọng (expectedVersion) phải là số nguyên không âm' };
  }

  return {
    valid: true,
    data: {
      productId,
      variantId,
      delta,
      expectedVersion,
      reason,
      operationKey,
    },
  };
}

export async function adjustStock(
  tx: TransactionClient,
  input: AdjustStockInput,
  actorId: string
): Promise<StockAdjustmentResult> {
  const { productId, variantId, delta, expectedVersion, reason, operationKey } = input;

  // 1. Idempotency Check: nếu operationKey đã từng thực thi thành công, trả về kết quả cũ
  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.findUnique === 'function') {
    const existingMov = await (tx as any).inventoryMovement.findUnique({
      where: { operationKey },
    });
    if (existingMov) {
      return {
        success: true,
        alreadyProcessed: true,
        productId: existingMov.productId,
        variantId: existingMov.variantId,
        previousStock: existingMov.beforeAvailable,
        newStock: existingMov.afterAvailable,
        newVersion: existingMov.afterVersion,
        adjustmentId: existingMov.id,
      };
    }
  } else if ('stockAdjustment' in tx && typeof (tx as any).stockAdjustment?.findUnique === 'function') {
    const existing = await (tx as any).stockAdjustment.findUnique({
      where: { operationKey },
    });

    if (existing) {
      return {
        success: true,
        alreadyProcessed: true,
        productId: existing.productId,
        variantId: existing.variantId,
        previousStock: existing.previousStock,
        newStock: existing.newStock,
        newVersion: existing.version,
        adjustmentId: existing.id,
      };
    }
  }

  // 2. Điều chỉnh biến thể (nếu có variantId)
  if (variantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant || variant.productId !== productId) {
      return {
        success: false,
        error: 'Biến thể không tồn tại hoặc không thuộc sản phẩm chỉ định',
        productId,
        variantId,
        previousStock: 0,
        newStock: 0,
        newVersion: 0,
      };
    }

    if (variant.stock + delta < 0) {
      return {
        success: false,
        error: `Không đủ tồn kho để giảm (Hiện có: ${variant.stock}, giảm: ${Math.abs(delta)})`,
        productId,
        variantId,
        previousStock: variant.stock,
        newStock: variant.stock,
        newVersion: variant.stockVersion,
      };
    }

    // Atomic CAS update: stockVersion và stock
    const updateResult = await tx.productVariant.updateMany({
      where: {
        id: variantId,
        productId,
        stockVersion: expectedVersion,
        stock: { gte: delta < 0 ? -delta : 0 },
      },
      data: {
        stock: { increment: delta },
        stockVersion: { increment: 1 },
      },
    });

    if (updateResult.count !== 1) {
      return {
        success: false,
        error: 'Xung đột phiên bản tồn kho (stale version), vui lòng tải lại dữ liệu mới nhất',
        productId,
        variantId,
        previousStock: variant.stock,
        newStock: variant.stock,
        newVersion: variant.stockVersion,
      };
    }

    // Đồng bộ tồn kho cha Product
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    });

    const previousStock = variant.stock;
    const newStock = previousStock + delta;
    const newVersion = expectedVersion + 1;

    if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
      await (tx as any).inventoryMovement.create({
        data: {
          operationKey,
          productId,
          variantId,
          kind: 'ADJUST',
          deltaOnHand: delta,
          deltaReserved: 0,
          deltaQuarantined: 0,
          beforeOnHand: previousStock,
          afterOnHand: newStock,
          beforeReserved: 0,
          afterReserved: 0,
          beforeQuarantined: 0,
          afterQuarantined: 0,
          beforeAvailable: previousStock,
          afterAvailable: newStock,
          beforeVersion: expectedVersion,
          afterVersion: newVersion,
          reason,
          actorId,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: operationKey,
        },
      });
    }

    let adjustmentId = operationKey;
    if ('stockAdjustment' in tx && typeof (tx as any).stockAdjustment?.create === 'function') {
      const adjustment = await (tx as any).stockAdjustment.create({
        data: {
          operationKey,
          productId,
          variantId,
          delta,
          previousStock,
          newStock,
          version: newVersion,
          reason,
          actorId,
        },
      });
      adjustmentId = adjustment.id;
    }

    return {
      success: true,
      productId,
      variantId,
      previousStock,
      newStock,
      newVersion,
      adjustmentId,
    };
  }

  // 3. Điều chỉnh sản phẩm gốc (BASE product)
  const product = await tx.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return {
      success: false,
      error: 'Sản phẩm không tồn tại',
      productId,
      variantId: null,
      previousStock: 0,
      newStock: 0,
      newVersion: 0,
    };
  }

  if (product.inventoryMode === 'VARIANT') {
    return {
      success: false,
      error: 'Sản phẩm có phân loại biến thể, vui lòng chọn biến thể cụ thể để điều chỉnh tồn kho',
      productId,
      variantId: null,
      previousStock: product.stock,
      newStock: product.stock,
      newVersion: product.stockVersion,
    };
  }

  if (product.stock + delta < 0) {
    return {
      success: false,
      error: `Không đủ tồn kho để giảm (Hiện có: ${product.stock}, giảm: ${Math.abs(delta)})`,
      productId,
      variantId: null,
      previousStock: product.stock,
      newStock: product.stock,
      newVersion: product.stockVersion,
    };
  }

  // Atomic CAS update: stockVersion và stock
  const updateResult = await tx.product.updateMany({
    where: {
      id: productId,
      inventoryMode: 'BASE',
      stockVersion: expectedVersion,
      stock: { gte: delta < 0 ? -delta : 0 },
    },
    data: {
      stock: { increment: delta },
      stockVersion: { increment: 1 },
    },
  });

  if (updateResult.count !== 1) {
    return {
      success: false,
      error: 'Xung đột phiên bản tồn kho (stale version), vui lòng tải lại dữ liệu mới nhất',
      productId,
      variantId: null,
      previousStock: product.stock,
      newStock: product.stock,
      newVersion: product.stockVersion,
    };
  }

  const previousStock = product.stock;
  const newStock = previousStock + delta;
  const newVersion = expectedVersion + 1;

  if ('inventoryMovement' in tx && typeof (tx as any).inventoryMovement?.create === 'function') {
    await (tx as any).inventoryMovement.create({
      data: {
        operationKey,
        productId,
        variantId: null,
        kind: 'ADJUST',
        deltaOnHand: delta,
        deltaReserved: 0,
        deltaQuarantined: 0,
        beforeOnHand: previousStock,
        afterOnHand: newStock,
        beforeReserved: 0,
        afterReserved: 0,
        beforeQuarantined: 0,
        afterQuarantined: 0,
        beforeAvailable: previousStock,
        afterAvailable: newStock,
        beforeVersion: expectedVersion,
        afterVersion: newVersion,
        reason,
        actorId,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: operationKey,
      },
    });
  }

  let adjustmentId = operationKey;
  if ('stockAdjustment' in tx && typeof (tx as any).stockAdjustment?.create === 'function') {
    const adjustment = await (tx as any).stockAdjustment.create({
      data: {
        operationKey,
        productId,
        variantId: null,
        delta,
        previousStock,
        newStock,
        version: newVersion,
        reason,
        actorId,
      },
    });
    adjustmentId = adjustment.id;
  }

  return {
    success: true,
    productId,
    variantId: null,
    previousStock,
    newStock,
    newVersion,
    adjustmentId,
  };
}
