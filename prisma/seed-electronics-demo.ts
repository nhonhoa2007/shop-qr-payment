import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/modules/auth/password-hash.service.ts';

export interface SeedDemoReport {
  success: boolean;
  created: {
    users: number;
    orders: number;
    serializedUnits: number;
    warrantyClaims: number;
    returnRequests: number;
    refundCases: number;
  };
  skipped: {
    users: number;
    orders: number;
    serializedUnits: number;
    warrantyClaims: number;
    returnRequests: number;
    refundCases: number;
  };
  message: string;
}

/**
 * Seeds isolated, idempotent synthetic demo fixtures for electronics commerce operations & aftersales.
 */
export async function seedElectronicsDemo(
  db: PrismaClient,
  options?: { clean?: boolean }
): Promise<SeedDemoReport> {
  const report: SeedDemoReport = {
    success: true,
    created: {
      users: 0,
      orders: 0,
      serializedUnits: 0,
      warrantyClaims: 0,
      returnRequests: 0,
      refundCases: 0,
    },
    skipped: {
      users: 0,
      orders: 0,
      serializedUnits: 0,
      warrantyClaims: 0,
      returnRequests: 0,
      refundCases: 0,
    },
    message: '',
  };

  const hashedPassword = await hashPassword('demoPassword123');

  // 1. Demo Customer & Staff
  const demoUsers = [
    {
      id: 'user-demo-customer',
      email: 'demo.customer@shop.local',
      name: 'Khách Hàng Demo Electronics',
      role: 'CUSTOMER' as const,
    },
    {
      id: 'user-demo-staff',
      email: 'demo.staff@shop.local',
      name: 'Nhân Viên Hậu Mãi Demo',
      role: 'STAFF' as const,
    },
  ];

  for (const u of demoUsers) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await db.user.create({
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          passwordHash: hashedPassword,
        },
      });
      report.created.users++;
    } else {
      report.skipped.users++;
    }
  }

  // 2. Fetch sample product & variant
  const sampleProduct = await db.product.findFirst({
    where: { isActive: true },
  });
  const sampleVariant = await db.productVariant.findFirst({
    where: { isActive: true },
  });

  const productId = sampleProduct?.id ?? 'demo-prod-fallback';
  const variantId = sampleVariant?.id ?? 'demo-var-fallback';
  const unitPrice = sampleVariant ? BigInt(sampleVariant.price) : BigInt(49990000);

  // 3. Demo Completed Order with Commercial Snapshots
  const demoOrderCode = 'DH-DEMO-M7-001';
  let demoOrder = await db.order.findUnique({
    where: { orderCode: demoOrderCode },
    include: { items: true },
  });

  if (!demoOrder) {
    demoOrder = await db.order.create({
      data: {
        id: 'order-demo-m7-001',
        orderCode: demoOrderCode,
        userId: 'user-demo-customer',
        customerName: 'Khách Hàng Demo Electronics',
        customerPhone: '0901234567',
        customerEmail: 'demo.customer@shop.local',
        customerAddress: '123 Đường Công Nghệ, Quận 1, TP. Hồ Chí Minh',
        subtotal: unitPrice,
        shippingFee: BigInt(30000),
        discountAmount: BigInt(0),
        totalAmount: unitPrice + BigInt(30000),
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        qrContent: `Thanh toan don hang ${demoOrderCode}`,
        expiresAt: new Date(Date.now() + 15 * 60_000),
        createdAt: new Date(Date.now() - 5 * 86_400_000),
        items: {
          create: [
            {
              productId,
              variantId,
              variantTitle: '18GB / 512GB Space Gray',
              price: unitPrice,
              quantity: 1,
              returnedQuantity: 0,
            },
          ],
        },
      },
      include: { items: true },
    });
    report.created.orders++;
  } else {
    report.skipped.orders++;
  }

  // 4. BankTransfer for Order
  const bankTransId = 'BT-DEMO-M7-001';
  const existingTx = await db.bankTransfer.findUnique({ where: { bankTransId } });
  if (!existingTx) {
    await db.bankTransfer.create({
      data: {
        fingerprint: `demo_tx:${bankTransId}`,
        orderId: demoOrder.id,
        bankTransId,
        amount: demoOrder.totalAmount,
        description: `Thanh toan don hang ${demoOrderCode}`,
        bankName: 'VCB',
        senderAccount: '****5678',
        status: 'APPLIED_ORDER',
        receivedAt: new Date(Date.now() - 5 * 86_400_000),
      },
    });
  }

  // 5. Serialized Unit Tracking
  const demoSerial = 'SN-DEMO-MBP-001';
  const existingSerial = await db.serializedUnit.findUnique({
    where: { serialNumber: demoSerial },
  });

  const orderItemId = (demoOrder as any).items?.[0]?.id ?? (demoOrder as any).orderItems?.[0]?.id ?? 'item-demo-1';

  let unitId = existingSerial?.id ?? 'unit-demo-mbp-001';
  if (!existingSerial) {
    const createdUnit = await db.serializedUnit.create({
      data: {
        id: unitId,
        productId,
        variantId,
        serialNumber: demoSerial,
        imei1: '351234567890123',
        status: 'SOLD',
        orderItemId,
      },
    });
    unitId = createdUnit.id;
    report.created.serializedUnits++;
  } else {
    report.skipped.serializedUnits++;
  }

  // 6. Warranty Claim Lifecycle with Timeline JSON
  const claimNumber = 'WC-DEMO-M7-001';
  const existingClaim = await db.warrantyClaim.findUnique({
    where: { claimNumber },
  });

  if (!existingClaim) {
    await db.warrantyClaim.create({
      data: {
        id: 'claim-demo-m7-001',
        claimNumber,
        orderId: demoOrder.id,
        orderItemId,
        serializedUnitId: unitId,
        customerId: 'user-demo-customer',
        issueDescription: 'Bàn phím phát tiếng lách cách nhẹ, bảo hành vệ sinh và kiểm tra switch.',
        status: 'RESOLVED',
        warrantyTermsSnapshot: { policyType: 'OFFICIAL', periodMonths: 12 },
        timeline: [
          { status: 'SUBMITTED', at: new Date(Date.now() - 3 * 86_400_000).toISOString(), note: 'Khách gửi yêu cầu' },
          { status: 'RECEIVED', at: new Date(Date.now() - 2 * 86_400_000).toISOString(), note: 'Đã nhận máy tại TTBH' },
          { status: 'INSPECTING', at: new Date(Date.now() - 1 * 86_400_000).toISOString(), note: 'Kỹ thuật viên kiểm tra' },
          { status: 'RESOLVED', at: new Date().toISOString(), note: 'Hoàn tất bảo hành và trả khách' },
        ],
        evidenceRefs: [
          { type: 'IMAGE', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8', label: 'Ảnh kiểm tra' },
        ],
      },
    });
    report.created.warrantyClaims++;
  } else {
    report.skipped.warrantyClaims++;
  }

  // 7. Partial Return Request & Idempotent Refund
  const returnNumber = 'RR-DEMO-M7-001';
  const existingReturn = await db.returnRequest.findUnique({
    where: { returnNumber },
  });

  if (!existingReturn) {
    await db.returnRequest.create({
      data: {
        id: 'return-demo-m7-001',
        returnNumber,
        orderId: demoOrder.id,
        customerId: 'user-demo-customer',
        reason: 'Khách đổi ý muốn nâng cấp cấu hình cao hơn.',
        status: 'RESOLVED',
        disposition: 'RESTOCKABLE',
        evidenceRefs: [],
        items: [
          {
            orderItemId,
            quantity: 1,
            unitPrice: unitPrice.toString(),
            refundableAmount: unitPrice.toString(),
          },
        ],
        timeline: [
          { status: 'REQUESTED', at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
          { status: 'APPROVED', at: new Date(Date.now() - 1 * 86_400_000).toISOString() },
          { status: 'ITEM_RECEIVED', at: new Date(Date.now() - 12 * 3600_000).toISOString() },
          { status: 'INSPECTED', at: new Date(Date.now() - 6 * 3600_000).toISOString() },
          { status: 'RESOLVED', at: new Date().toISOString() },
        ],
      },
    });
    report.created.returnRequests++;
  } else {
    report.skipped.returnRequests++;
  }

  // 8. Idempotent RefundCase
  const refundSourceKey = `refund-return-demo-m7-001`;
  const existingRefund = await db.refundCase.findUnique({
    where: { sourceKey: refundSourceKey },
  });

  if (!existingRefund) {
    await db.refundCase.create({
      data: {
        id: 'refund-demo-m7-001',
        sourceKey: refundSourceKey,
        orderId: demoOrder.id,
        amount: unitPrice,
        status: 'COMPLETED',
        reason: 'Hoàn tiền trả hàng linh kiện demo',
      },
    });
    report.created.refundCases++;
  } else {
    report.skipped.refundCases++;
  }

  report.message = `Electronics demo fixtures verified successfully (created: ${report.created.orders} orders, ${report.created.warrantyClaims} warranty claims, ${report.created.returnRequests} returns).`;
  return report;
}

// CLI runner
if (process.argv[1]) {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
      const { prisma: defaultPrisma } = await import('@server/database/prisma');
      console.log('Seeding Electronics Demo Fixtures...');
      const report = await seedElectronicsDemo(defaultPrisma);
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.success ? 0 : 1);
    }
  } catch (err) {
    console.error('Fatal error during electronics demo seed:', err);
    process.exit(1);
  }
}
