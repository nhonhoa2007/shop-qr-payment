type ProductMoney = bigint | number | string;

function serializeProductMoney(value: ProductMoney): ProductMoney {
  return typeof value === 'bigint' ? value.toString() : value;
}

/** Converts Prisma BigInt product prices into lossless JSON decimal strings. */
export function serializeProductForJson<
  T extends { price: ProductMoney; variants?: Array<{ price: ProductMoney }> }
>(product: T) {
  return {
    ...product,
    price: serializeProductMoney(product.price),
    variants: product.variants?.map((variant) => ({
      ...variant,
      price: serializeProductMoney(variant.price),
    })),
  };
}
