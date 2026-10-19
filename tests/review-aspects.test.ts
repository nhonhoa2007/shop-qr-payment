import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getReviewAspects,
  isShippingComplaint,
  extractAspectSentiments,
} from '../src/server/modules/intelligence/review-aggregate.service.ts';
import type { PrismaClientOrTx } from '../src/server/modules/intelligence/scoring.service.ts';

describe('Commerce Intelligence: Separated Review Aspects & Sentiment Aggregation', () => {
  it('separates SHOP, EXTERNAL, and SYNTHETIC reviews into distinct groups', async () => {
    const mockDb = {
      review: {
        async findMany() {
          return [
            {
              id: 'rev_shop_1',
              productId: 'prod_laptop_1',
              userId: 'user_1',
              orderId: 'ord_1',
              rating: 5,
              comment: 'Máy chạy rất mượt, pin trâu dùng được cả ngày, màn hình đẹp.',
              isApproved: true,
            },
            {
              id: 'rev_shop_2',
              productId: 'prod_laptop_1',
              userId: 'user_2',
              orderId: 'ord_2',
              rating: 4,
              comment: 'Bàn phím gõ êm, máy mát, nhưng camera hơi mờ.',
              isApproved: true,
            },
          ];
        },
      },
      dataSource: {
        async findMany() {
          return [
            {
              id: 'ds_ext_1',
              sourceType: 'REVIEW_AGGREGATE',
              status: 'ACTIVE',
              publisher: 'NotebookCheck',
              url: 'https://notebookcheck.net/review-laptop-1',
              license: 'CC-BY-4.0',
              isSynthetic: false,
              payload: {
                schemaVersion: 1,
                sampleSize: 120,
                analyzerVersion: 'nbc-v2.1',
                ratingSummary: { averageRating: 4.4, totalReviews: 120 },
                aspects: [
                  { aspect: 'performance', positiveScore: 92, confidence: 0.95, sampleCount: 120 },
                  { aspect: 'battery', positiveScore: 88, confidence: 0.90, sampleCount: 100 },
                  { aspect: 'display', positiveScore: 85, confidence: 0.88, sampleCount: 95 },
                ],
                mapping: { productId: 'prod_laptop_1' },
              },
            },
            {
              id: 'ds_syn_1',
              sourceType: 'REVIEW_AGGREGATE',
              status: 'ACTIVE',
              publisher: 'SynthEval Labs',
              license: 'Research-Only',
              isSynthetic: true,
              payload: {
                schemaVersion: 1,
                sampleSize: 50,
                analyzerVersion: 'synth-gen-v1.0',
                ratingSummary: { averageRating: 4.0, totalReviews: 50 },
                aspects: [
                  { aspect: 'performance', positiveScore: 80, confidence: 0.70, sampleCount: 50 },
                ],
                mapping: { productId: 'prod_laptop_1' },
              },
            },
          ];
        },
      },
    };

    const summaries = await getReviewAspects(['prod_laptop_1'], mockDb as unknown as PrismaClientOrTx);
    assert.equal(summaries.length, 1);
    const summary = summaries[0];
    assert.equal(summary.productId, 'prod_laptop_1');

    // SHOP reviews
    assert.equal(summary.shop.provenance, 'SHOP');
    assert.equal(summary.shop.totalReviews, 2);
    assert.equal(summary.shop.averageRating, 4.5);
    assert.ok(summary.shop.aspects.length > 0);

    // EXTERNAL reviews
    assert.equal(summary.external.length, 1);
    assert.equal(summary.external[0].provenance, 'EXTERNAL');
    assert.equal(summary.external[0].analyzerVersion, 'nbc-v2.1');
    assert.equal(summary.external[0].totalReviews, 120);

    // SYNTHETIC reviews
    assert.equal(summary.synthetic.length, 1);
    assert.equal(summary.synthetic[0].provenance, 'SYNTHETIC');
    assert.equal(summary.synthetic[0].totalReviews, 50);
  });

  it('strictly excludes unapproved internal reviews (isApproved = false)', async () => {
    const mockDb = {
      review: {
        async findMany(args?: { where?: { isApproved?: boolean } }) {
          assert.equal(args?.where?.isApproved, true);
          return [
            {
              id: 'rev_approved',
              productId: 'prod_1',
              rating: 5,
              comment: 'Great device',
              isApproved: true,
            },
          ];
        },
      },
      dataSource: {
        async findMany() {
          return [];
        },
      },
    };

    const summaries = await getReviewAspects(['prod_1'], mockDb as unknown as PrismaClientOrTx);
    assert.equal(summaries[0].shop.totalReviews, 1);
  });

  it('strictly excludes revoked or non-active external DataSources', async () => {
    const mockDb = {
      review: {
        async findMany() {
          return [];
        },
      },
      dataSource: {
        async findMany(args?: { where?: { status?: string } }) {
          // Status must filter for ACTIVE
          assert.equal(args?.where?.status, 'ACTIVE');
          return [];
        },
      },
    };

    const summaries = await getReviewAspects(['prod_1'], mockDb as unknown as PrismaClientOrTx);
    assert.equal(summaries[0].external.length, 0);
  });

  it('retains analyzerVersion and allows mixed positive and negative aspects to coexist', async () => {
    const mockDb = {
      review: {
        async findMany() {
          return [
            {
              id: 'rev_1',
              productId: 'prod_mixed',
              rating: 3,
              comment: 'Pin rất trâu dùng 2 ngày, nhưng camera chụp rất tệ và mờ.',
              isApproved: true,
            },
          ];
        },
      },
      dataSource: {
        async findMany() {
          return [
            {
              id: 'ds_mixed',
              sourceType: 'REVIEW_AGGREGATE',
              status: 'ACTIVE',
              publisher: 'TechInsights',
              isSynthetic: false,
              payload: {
                schemaVersion: 1,
                sampleSize: 80,
                analyzerVersion: 'ti-analyzer-v3.0',
                ratingSummary: { averageRating: 3.5, totalReviews: 80 },
                aspects: [
                  { aspect: 'battery', positiveScore: 90, confidence: 0.95, sampleCount: 80 },
                  { aspect: 'camera', positiveScore: 35, confidence: 0.90, sampleCount: 75 },
                ],
                mapping: { productId: 'prod_mixed' },
              },
            },
          ];
        },
      },
    };

    const summaries = await getReviewAspects(['prod_mixed'], mockDb as unknown as PrismaClientOrTx);
    const ext = summaries[0].external[0];
    assert.equal(ext.analyzerVersion, 'ti-analyzer-v3.0');

    const batteryAspect = ext.aspects.find((a) => a.aspect === 'battery');
    const cameraAspect = ext.aspects.find((a) => a.aspect === 'camera');
    assert.ok(batteryAspect);
    assert.ok(cameraAspect);
    assert.ok(batteryAspect.positiveScore >= 80);
    assert.ok(cameraAspect.positiveScore <= 40);
  });

  it('filters out shipping complaints from device-quality aspect scores', () => {
    // Delivery/shipping complaints
    assert.equal(isShippingComplaint('Giao hàng quá chậm, shipper thái độ lồi lõm'), true);
    assert.equal(isShippingComplaint('Hộp bị móp méo do vận chuyển ghn quá ẩu'), true);
    assert.equal(isShippingComplaint('Delivery was late and box was crushed by courier'), true);

    // Device hardware aspects
    assert.equal(isShippingComplaint('Pin dùng được 10 tiếng, màn hình OLED rất đẹp'), false);
    assert.equal(isShippingComplaint('Máy rất mát khi render video, bàn phím gõ thích'), false);

    const reviews = [
      { comment: 'Giao hàng chậm 5 ngày, hộp nát bét!', rating: 1 },
      { comment: 'Pin trâu dùng mượt mà, màn hình sáng đẹp.', rating: 5 },
      { comment: 'Hiệu năng đỉnh cao, chơi game không nóng máy.', rating: 5 },
    ];

    const aspects = extractAspectSentiments(reviews);
    // Shipping complaints should not contaminate device quality aspects
    const hasShippingAspect = aspects.some((a) => a.aspect === 'shipping' || a.aspect === 'delivery');
    assert.equal(hasShippingAspect, false);

    const battery = aspects.find((a) => a.aspect === 'battery');
    const performance = aspects.find((a) => a.aspect === 'performance');
    assert.ok(battery);
    assert.ok(performance);
    assert.ok(battery.positiveScore >= 70);
    assert.ok(performance.positiveScore >= 70);
  });

  it('enforces UCI sentiment dataset is strictly marked evalOnly and cannot be used as commercial review source', () => {
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/uci-sentiment-licensed.json');
    assert.ok(fs.existsSync(fixturePath), 'UCI fixture must exist');

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.equal(raw.evalOnly, true);
    assert.ok(raw.license.includes('Creative Commons') || raw.license.includes('CC'));
    assert.ok(Array.isArray(raw.samples));
    assert.ok(raw.samples.length >= 5);

    for (const sample of raw.samples) {
      if (sample.isShippingComplaint) {
        assert.equal(isShippingComplaint(sample.text), true);
      }
    }
  });
});
