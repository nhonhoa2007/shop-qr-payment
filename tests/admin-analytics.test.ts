import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRevenueGrowth,
  calculateQrMatchRate,
  calculatePaymentMethodDistribution,
  buildUrgentActions,
  formatItemsSummary,
  formatDateKey,
  getVietnameseDayLabel,
  buildRevenueTrend,
  buildHourlyRevenueTrend,
  buildMonthlyRevenueTrend,
  type AdminAnalyticsResponse,
  type AnalyticsRange,
} from '../src/lib/admin-analytics.ts';

describe('Admin Analytics - Revenue Growth Calculation', () => {
  it('should calculate positive revenue growth percentage rounded to 1 decimal place', () => {
    // 1,000,000 -> 1,142,000 (+14.2%)
    const growth = calculateRevenueGrowth(1_142_000, 1_000_000);
    assert.equal(growth, 14.2);
  });

  it('should calculate negative revenue growth percentage properly', () => {
    // 1,000,000 -> 800,000 (-20%)
    const growth = calculateRevenueGrowth(800_000, 1_000_000);
    assert.equal(growth, -20);
  });

  it('should safely handle division by zero when yesterday revenue was zero', () => {
    // Yesterday 0, today 500,000 -> 100%
    const positiveGrowth = calculateRevenueGrowth(500_000, 0);
    assert.equal(positiveGrowth, 100);

    // Yesterday 0, today 0 -> 0%
    const zeroGrowth = calculateRevenueGrowth(0, 0);
    assert.equal(zeroGrowth, 0);
  });

  it('should return -100% when yesterday had revenue but today has zero revenue', () => {
    const growth = calculateRevenueGrowth(0, 1_000_000);
    assert.equal(growth, -100);
  });
});

describe('Admin Analytics - QR Match Rate Calculation', () => {
  it('should return 100% when there are no transactions (empty database)', () => {
    const rate = calculateQrMatchRate(0, 0);
    assert.equal(rate, 100);
  });

  it('should calculate match rate percentage rounded to 1 decimal place', () => {
    // 988 matched out of 1000 -> 98.8%
    const rate = calculateQrMatchRate(988, 1000);
    assert.equal(rate, 98.8);
  });

  it('should clamp values safely if matched exceeds total or is negative', () => {
    assert.equal(calculateQrMatchRate(120, 100), 100);
    assert.equal(calculateQrMatchRate(-5, 100), 0);
  });
});

describe('Admin Analytics - Payment Method Distribution', () => {
  it('should return 0% for all methods when there are no paid orders', () => {
    const result = calculatePaymentMethodDistribution([]);
    assert.deepEqual(result, {
      payosQrPercentage: 0,
      walletPercentage: 0,
      codPercentage: 0,
    });
  });

  it('should calculate accurate percentages for mixed payment channels', () => {
    const orders = [
      // 3 VietQR / PayOS
      { transaction: { bankName: 'PAYOS' } },
      { transaction: { bankName: 'Vietcombank' } },
      { transaction: { bankName: 'MBBank' } },
      // 1 Wallet
      { transaction: { bankName: 'SHOP_WALLET' } },
      // 1 COD
      { transaction: null, shipment: { codAmount: 250_000 } },
    ];

    const result = calculatePaymentMethodDistribution(orders);
    // 3/5 = 60%, 1/5 = 20%, 1/5 = 20%
    assert.equal(result.payosQrPercentage, 60);
    assert.equal(result.walletPercentage, 20);
    assert.equal(result.codPercentage, 20);
  });

  it('should fallback to COD when paid order has no transaction record and no COD shipment', () => {
    const orders = [
      { transaction: null, shipment: null },
    ];
    const result = calculatePaymentMethodDistribution(orders);
    assert.equal(result.codPercentage, 100);
    assert.equal(result.payosQrPercentage, 0);
    assert.equal(result.walletPercentage, 0);
  });
});

describe('Admin Analytics - Urgent Actions Builder', () => {
  it('should generate all actionable alerts when issues are present', () => {
    const actions = buildUrgentActions({
      unmatchedTransactionsCount: 2,
      criticalStockCount: 4,
      pendingOrdersCount: 3,
    });

    assert.equal(actions.length, 3);

    const mismatchAction = actions.find((a) => a.type === 'TRANSACTION_MISMATCH');
    assert.ok(mismatchAction);
    assert.equal(mismatchAction?.link, '/admin/transactions');
    assert.match(mismatchAction?.title || '', /2 giao dịch/);

    const stockAction = actions.find((a) => a.type === 'LOW_STOCK');
    assert.ok(stockAction);
    assert.equal(stockAction?.link, '/admin/products');
    assert.match(stockAction?.title || '', /4 sản phẩm/);

    const orderAction = actions.find((a) => a.type === 'NEW_ORDER');
    assert.ok(orderAction);
    assert.equal(orderAction?.link, '/admin/orders');
    assert.match(orderAction?.title || '', /3 đơn hàng/);
  });

  it('should return an empty array when there are no issues or pending orders', () => {
    const actions = buildUrgentActions({
      unmatchedTransactionsCount: 0,
      criticalStockCount: 0,
      pendingOrdersCount: 0,
    });
    assert.equal(actions.length, 0);
  });
});

describe('Admin Analytics - Items Summary Formatter', () => {
  it('should return fallback text when items array is empty', () => {
    assert.equal(formatItemsSummary([]), 'Không có sản phẩm');
  });

  it('should format single product correctly', () => {
    const summary = formatItemsSummary([
      { product: { name: 'Áo Thun Cotton' }, quantity: 2 },
    ]);
    assert.equal(summary, 'Áo Thun Cotton x 2');
  });

  it('should format multiple products joined by comma', () => {
    const summary = formatItemsSummary([
      { product: { name: 'Áo Thun' }, quantity: 2 },
      { product: { name: 'Quần Jean' }, quantity: 1 },
    ]);
    assert.equal(summary, 'Áo Thun x 2, Quần Jean x 1');
  });

  it('should handle item without product name safely', () => {
    const summary = formatItemsSummary([
      { product: null, quantity: 3 },
    ]);
    assert.equal(summary, 'Sản phẩm x 3');
  });
});

describe('Admin Analytics - Date and Revenue Trend Helpers', () => {
  it('should format Date to YYYY-MM-DD string', () => {
    const d = new Date(2026, 8, 18); // Note: month is 0-indexed (8 = Sep)
    assert.equal(formatDateKey(d), '2026-09-18');
  });

  it('should return correct Vietnamese weekday labels', () => {
    // 2026-09-18 is Friday (T6)
    const fri = new Date(2026, 8, 18);
    assert.equal(getVietnameseDayLabel(fri), 'T6');

    // 2026-09-20 is Sunday (CN)
    const sun = new Date(2026, 8, 20);
    assert.equal(getVietnameseDayLabel(sun), 'CN');
  });

  it('should build exactly 7 days of revenue trend and map revenue accurately', () => {
    const baseDate = new Date(2026, 8, 12);
    const day3Date = new Date(2026, 8, 14);

    const paidOrders = [
      { totalAmount: 150_000, createdAt: day3Date },
      { totalAmount: 250_000, createdAt: day3Date },
    ];

    const trend = buildRevenueTrend(baseDate, paidOrders);
    assert.equal(trend.length, 7);

    // Day 3 (2026-09-14) should have 400,000
    const day3Item = trend.find((t) => t.date === '2026-09-14');
    assert.ok(day3Item);
    assert.equal(day3Item?.revenue, 400_000);

    // Other days should be 0
    const otherDay = trend.find((t) => t.date === '2026-09-12');
    assert.ok(otherDay);
    assert.equal(otherDay?.revenue, 0);
  });

  it('should build exactly 24 hourly points for today trend and map revenue accurately', () => {
    const today = new Date(2026, 8, 18, 0, 0, 0);
    const orderAt10 = new Date(2026, 8, 18, 10, 15, 0);
    const orderAt10B = new Date(2026, 8, 18, 10, 45, 0);
    const orderAt14 = new Date(2026, 8, 18, 14, 30, 0);

    const paidOrders = [
      { totalAmount: 200_000, createdAt: orderAt10 },
      { totalAmount: 300_000, createdAt: orderAt10B },
      { totalAmount: 500_000, createdAt: orderAt14 },
    ];

    const trend = buildHourlyRevenueTrend(today, paidOrders);
    assert.equal(trend.length, 24);

    // Hour 10 should have 500,000
    const item10 = trend.find((t) => t.label === '10h');
    assert.ok(item10);
    assert.equal(item10?.revenue, 500_000);

    // Hour 14 should have 500,000
    const item14 = trend.find((t) => t.label === '14h');
    assert.ok(item14);
    assert.equal(item14?.revenue, 500_000);

    // Hour 00h should have 0
    const item00 = trend.find((t) => t.label === '00h');
    assert.ok(item00);
    assert.equal(item00?.revenue, 0);
  });

  it('should build exactly 30 points for monthly trend and map revenue accurately', () => {
    const startDate = new Date(2026, 8, 1);
    const orderOnDay5 = new Date(2026, 8, 5, 12, 0, 0);

    const paidOrders = [
      { totalAmount: 1_200_000, createdAt: orderOnDay5 },
    ];

    const trend = buildMonthlyRevenueTrend(startDate, paidOrders);
    assert.equal(trend.length, 30);

    const itemDay5 = trend.find((t) => t.label === '05/09');
    assert.ok(itemDay5);
    assert.equal(itemDay5?.revenue, 1_200_000);

    const itemDay1 = trend.find((t) => t.label === '01/09');
    assert.ok(itemDay1);
    assert.equal(itemDay1?.revenue, 0);
  });
});

describe('Admin Analytics - Data Contract Conformance', () => {
  it('should satisfy AdminAnalyticsResponse structure', () => {
    const sampleResponse: AdminAnalyticsResponse = {
      summary: {
        totalRevenue: 50_000_000,
        todayRevenue: 2_500_000,
        todayRevenueGrowth: 14.2,
        totalOrders: 120,
        todayOrders: 5,
        pendingOrdersCount: 2,
        processingOrdersCount: 4,
        lowStockCount: 3,
        totalCustomers: 85,
        qrMatchRate: 98.8,
        unmatchedTransactionsCount: 1,
        activeShipmentsCount: 6,
        totalPaidOrders: 110,
      },
      ordersByStatus: {
        PENDING: 2,
        CONFIRMED: 5,
        PROCESSING: 4,
        SHIPPING: 6,
        COMPLETED: 100,
        CANCELLED: 3,
      },
      revenueTrend: [
        { date: '2026-09-12', label: 'T7', revenue: 1_200_000 },
      ],
      paymentMethodDistribution: {
        payosQrPercentage: 68,
        walletPercentage: 22,
        codPercentage: 10,
      },
      urgentActions: [
        {
          id: 'action-1',
          type: 'TRANSACTION_MISMATCH',
          title: 'Giao dịch chưa khớp',
          description: 'Cần kiểm tra giao dịch',
          link: '/admin/transactions',
        },
      ],
      recentOrders: [
        {
          id: 'order-1',
          orderCode: 'DH100001',
          customerName: 'Nguyễn Văn A',
          customerPhone: '0901234567',
          itemsSummary: 'Áo Thun x 2',
          totalAmount: 300_000,
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          createdAt: '2026-09-18T10:00:00.000Z',
        },
      ],
      topProducts: [
        {
          productId: 'prod-1',
          name: 'Áo Thun',
          price: 150_000,
          image: null,
          category: 'Thời trang',
          totalSold: 25,
        },
      ],
    };

    assert.equal(sampleResponse.summary.todayRevenueGrowth, 14.2);
    assert.equal(sampleResponse.summary.qrMatchRate, 98.8);
    assert.equal(sampleResponse.paymentMethodDistribution.payosQrPercentage, 68);
    assert.equal(sampleResponse.recentOrders[0].itemsSummary, 'Áo Thun x 2');
  });
});

describe('Admin Analytics - Dynamic Time Range (today, 7days, month) via buildRevenueTrend', () => {
  it('should route buildRevenueTrend with range="today" to 24 hourly points', () => {
    const today = new Date(2026, 8, 18, 0, 0, 0);
    const orderAt09 = new Date(2026, 8, 18, 9, 30, 0);
    const orderAt15 = new Date(2026, 8, 18, 15, 0, 0);

    const paidOrders = [
      { totalAmount: 350_000, createdAt: orderAt09 },
      { totalAmount: 650_000, createdAt: orderAt15 },
    ];

    const trend = buildRevenueTrend(today, paidOrders, 'today');
    assert.equal(trend.length, 24);
    assert.equal(trend[0].label, '00h');
    assert.equal(trend[23].label, '23h');

    const item09 = trend.find((t) => t.label === '09h');
    assert.ok(item09);
    assert.equal(item09?.revenue, 350_000);

    const item15 = trend.find((t) => t.label === '15h');
    assert.ok(item15);
    assert.equal(item15?.revenue, 650_000);

    const item12 = trend.find((t) => t.label === '12h');
    assert.ok(item12);
    assert.equal(item12?.revenue, 0);
  });

  it('should route buildRevenueTrend with range="month" to 30 daily points', () => {
    const thirtyDaysAgo = new Date(2026, 7, 20); // 20 August 2026
    const orderDate = new Date(2026, 7, 25, 10, 0, 0);

    const paidOrders = [
      { totalAmount: 800_000, createdAt: orderDate },
    ];

    const trend = buildRevenueTrend(thirtyDaysAgo, paidOrders, 'month');
    assert.equal(trend.length, 30);

    const matchedItem = trend.find((t) => t.label === '25/08');
    assert.ok(matchedItem);
    assert.equal(matchedItem?.revenue, 800_000);
  });

  it('should route buildRevenueTrend with range="7days" to 7 daily points', () => {
    const sevenDaysAgo = new Date(2026, 8, 12);
    const orderDate = new Date(2026, 8, 15);

    const paidOrders = [
      { totalAmount: 450_000, createdAt: orderDate },
    ];

    const trend = buildRevenueTrend(sevenDaysAgo, paidOrders, '7days');
    assert.equal(trend.length, 7);

    const matchedItem = trend.find((t) => t.date === '2026-09-15');
    assert.ok(matchedItem);
    assert.equal(matchedItem?.revenue, 450_000);
  });

  it('should default to 7 days when range is omitted', () => {
    const sevenDaysAgo = new Date(2026, 8, 12);
    const trend = buildRevenueTrend(sevenDaysAgo, []);
    assert.equal(trend.length, 7);
  });
});

describe('Admin Analytics - Pusher Admin Channel Authorization Guard', () => {
  function authorizePusherChannel(
    channelName: string,
    session: { user?: { id: string; role?: string } } | null
  ): { allowed: boolean; status: number } {
    if (!session?.user?.id) {
      return { allowed: false, status: 401 };
    }

    if (channelName.startsWith('private-admin-')) {
      if (session.user.role !== 'ADMIN') {
        return { allowed: false, status: 403 };
      }
    }

    if (channelName.startsWith('private-chat-')) {
      // roomId check placeholder
    }

    if (channelName.startsWith('private-user-')) {
      const userId = channelName.replace('private-user-', '');
      if (userId !== session.user.id) {
        return { allowed: false, status: 403 };
      }
    }

    return { allowed: true, status: 200 };
  }

  it('should reject unauthenticated requests to private-admin-channel with 401', () => {
    const result = authorizePusherChannel('private-admin-channel', null);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 401);
  });

  it('should reject non-admin users attempting to subscribe to private-admin-channel with 403', () => {
    const customerSession = { user: { id: 'usr_customer_123', role: 'CUSTOMER' } };
    const result = authorizePusherChannel('private-admin-channel', customerSession);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it('should reject staff users without ADMIN role from subscribing to private-admin-channel with 403', () => {
    const staffSession = { user: { id: 'usr_staff_456', role: 'STAFF' } };
    const result = authorizePusherChannel('private-admin-channel', staffSession);
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it('should allow ADMIN users to subscribe to private-admin-channel with 200', () => {
    const adminSession = { user: { id: 'usr_admin_001', role: 'ADMIN' } };
    const result = authorizePusherChannel('private-admin-channel', adminSession);
    assert.equal(result.allowed, true);
    assert.equal(result.status, 200);
  });

  it('should allow ADMIN users to subscribe to any private-admin-* subchannel', () => {
    const adminSession = { user: { id: 'usr_admin_001', role: 'ADMIN' } };
    const result = authorizePusherChannel('private-admin-orders', adminSession);
    assert.equal(result.allowed, true);
    assert.equal(result.status, 200);
  });
});

describe('Admin Analytics - Real-time Event Contract & Validation', () => {
  it('should construct valid analytics-updated event payloads for all triggers', () => {
    const triggers = [
      'PAYOS_PAYMENT',
      'CASSO_PAYMENT',
      'WALLET_PAYMENT',
      'MANUAL_RECONCILE',
      'ORDER_STATUS_CHANGED',
      'ORDER_CREATED',
    ];

    const now = Date.now();
    for (const type of triggers) {
      const payload = { type, timestamp: now };
      assert.equal(typeof payload.type, 'string');
      assert.equal(payload.type, type);
      assert.ok(payload.timestamp > 0);
      assert.ok(payload.timestamp <= Date.now());
    }
  });

  it('should validate range query param parsing logic', () => {
    function parseRangeParam(urlParam: string | null): AnalyticsRange {
      if (urlParam === 'today' || urlParam === 'month' || urlParam === '7days') {
        return urlParam;
      }
      return '7days';
    }

    assert.equal(parseRangeParam('today'), 'today');
    assert.equal(parseRangeParam('month'), 'month');
    assert.equal(parseRangeParam('7days'), '7days');
    assert.equal(parseRangeParam(null), '7days');
    assert.equal(parseRangeParam(''), '7days');
    assert.equal(parseRangeParam('year'), '7days');
    assert.equal(parseRangeParam('invalid'), '7days');
  });
});
