import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CatalogService } from '@server/modules/catalog/catalog.service';
import type { prisma } from '@server/database/prisma';

describe('Catalog Rating Aggregation (Task 9)', () => {
  it('should query only approved reviews and compute correct avgRating and reviewCount', async () => {
    let capturedFindManyArgs: unknown = null;

    const mockDb = {
      product: {
        findMany: async (args: {
          distinct?: unknown;
          include?: { reviews?: { where?: { isApproved?: boolean } } };
        }) => {
          if (args?.distinct) {
            return [{ category: 'Laptop' }];
          }

          capturedFindManyArgs = args;
          // Returns product with reviews filtered by the query
          // If the query filtered isApproved: true, only [5, 3] should be returned
          const isFilterPresent = args?.include?.reviews?.where?.isApproved === true;

          const reviews = isFilterPresent
            ? [{ rating: 5 }, { rating: 3 }] // Only approved
            : [{ rating: 5 }, { rating: 3 }, { rating: 1 }]; // Unapproved included if filter missing

          return [
            {
              id: 'prod_laptop_1',
              name: 'Laptop Gaming Pro',
              description: 'High performance laptop',
              price: 25_000_000n,
              image: '/laptop.jpg',
              category: 'Laptop',
              stock: 10,
              isActive: true,
              createdAt: new Date('2026-01-01'),
              updatedAt: new Date('2026-01-01'),
              reviews,
              variants: [],
            },
          ];
        },
        count: async () => 1,
      },
    } as unknown as typeof prisma;

    const result = await CatalogService.getHomeCatalog({}, mockDb);

    // Assert that the Prisma query explicitly filtered for isApproved: true
    assert.ok(capturedFindManyArgs, 'product.findMany should have been called');
    const includeReviews = (
      capturedFindManyArgs as {
        include?: { reviews?: { where?: { isApproved?: boolean } } };
      }
    )?.include?.reviews;
    assert.ok(includeReviews, 'reviews include must be present');
    assert.deepEqual(includeReviews.where, { isApproved: true });

    // Assert computed aggregate values
    assert.equal(result.products.length, 1);
    const product = result.products[0];
    assert.equal(product.reviewCount, 2);
    assert.equal(product.avgRating, 4.0);
  });
});
