import { serializeMoneyVnd, parseMoneyVnd } from '@shared/utils/money';
import type { MoneyVnd } from '@shared/types/money';

export { serializeMoneyVnd, parseMoneyVnd, type MoneyVnd };

/**
 * Safely converts a bigint, number, or string to a MoneyVnd string.
 * Returns null or undefined if the input is null or undefined.
 */
export function toMoneyVnd(
  value: bigint | number | string | null | undefined,
  field = 'amount'
): MoneyVnd | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'bigint') {
    return serializeMoneyVnd(value);
  }
  return serializeMoneyVnd(parseMoneyVnd(value, field));
}

/**
 * Serializes a signed bigint amount (e.g. negative for wallet deductions).
 */
export function serializeSignedMoneyVnd(value: bigint | number | string): string {
  if (typeof value === 'bigint') {
    if (value < BigInt(0)) {
      return `-${serializeMoneyVnd(-value)}`;
    }
    return serializeMoneyVnd(value);
  }
  if (typeof value === 'number') {
    if (value < 0) {
      return `-${serializeMoneyVnd(parseMoneyVnd(-value, 'amount'))}`;
    }
    return serializeMoneyVnd(parseMoneyVnd(value, 'amount'));
  }
  const str = String(value).trim();
  if (str.startsWith('-')) {
    return `-${serializeMoneyVnd(parseMoneyVnd(str.slice(1), 'amount'))}`;
  }
  return serializeMoneyVnd(parseMoneyVnd(str, 'amount'));
}

/**
 * JSON replacer function to serialize any BigInt value as decimal string.
 * Useful for JSON.stringify(data, bigIntJsonReplacer).
 */
export function bigIntJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

export type MoneyValue = bigint | number | string;

export function serializeProductDto<
  T extends { price: MoneyValue; variants?: Array<{ price: MoneyValue }> }
>(
  product: T
): T & { price: MoneyVnd } {
  return {
    ...product,
    price: serializeMoneyVnd(
      typeof product.price === 'bigint' ? product.price : parseMoneyVnd(product.price, 'price')
    ),
    variants: product.variants?.map((v) => ({
      ...v,
      price: serializeMoneyVnd(
        typeof v.price === 'bigint' ? v.price : parseMoneyVnd(v.price, 'price')
      ),
    })),
  };
}

export function serializeProductMutationResult<
  T extends {
    product: { price: MoneyValue; variants?: Array<{ price: MoneyValue }> };
  }
>(result: T) {
  return {
    ...result,
    product: serializeProductDto(result.product),
  };
}

function serializeOptionalBigInt<T extends MoneyValue | null | undefined>(value: T) {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function serializeCouponDto<
  T extends {
    discountValue: MoneyValue;
    fixedDiscountAmount?: MoneyValue | null;
    maxDiscount?: MoneyValue | null;
    minOrderAmount: MoneyValue;
  }
>(coupon: T) {
  return {
    ...coupon,
    discountValue: serializeOptionalBigInt(coupon.discountValue),
    fixedDiscountAmount: serializeOptionalBigInt(coupon.fixedDiscountAmount),
    maxDiscount: serializeOptionalBigInt(coupon.maxDiscount),
    minOrderAmount: serializeOptionalBigInt(coupon.minOrderAmount),
  };
}

export function serializeOrderDto<
  T extends {
    subtotal?: MoneyValue | null;
    shippingFee?: MoneyValue | null;
    discountAmount?: MoneyValue | null;
    totalAmount: MoneyValue;
    items?: Array<{
      price: MoneyValue;
      product?: { price: MoneyValue; variants?: Array<{ price: MoneyValue }> };
    }>;
  }
>(order: T) {
  return {
    ...order,
    subtotal:
      order.subtotal != null
        ? serializeMoneyVnd(
            typeof order.subtotal === 'bigint'
              ? order.subtotal
              : parseMoneyVnd(order.subtotal, 'subtotal')
          )
        : undefined,
    shippingFee:
      order.shippingFee != null
        ? serializeMoneyVnd(
            typeof order.shippingFee === 'bigint'
              ? order.shippingFee
              : parseMoneyVnd(order.shippingFee, 'shippingFee')
          )
        : undefined,
    discountAmount:
      order.discountAmount != null
        ? serializeMoneyVnd(
            typeof order.discountAmount === 'bigint'
              ? order.discountAmount
              : parseMoneyVnd(order.discountAmount, 'discountAmount')
          )
        : undefined,
    totalAmount: serializeMoneyVnd(
      typeof order.totalAmount === 'bigint'
        ? order.totalAmount
        : parseMoneyVnd(order.totalAmount, 'totalAmount')
    ),
    items: order.items?.map((item) => {
      const priceStr = serializeMoneyVnd(
        typeof item.price === 'bigint' ? item.price : parseMoneyVnd(item.price, 'price')
      );
      const rawUnitPrice = (item as { unitPrice?: MoneyValue | null }).unitPrice;
      const unitPriceStr =
        rawUnitPrice !== undefined && rawUnitPrice !== null
          ? serializeMoneyVnd(
              typeof rawUnitPrice === 'bigint'
                ? rawUnitPrice
                : parseMoneyVnd(rawUnitPrice, 'unitPrice')
            )
          : priceStr;

      return {
        ...item,
        price: priceStr,
        unitPrice: unitPriceStr,
        product: item.product ? serializeProductDto(item.product) : undefined,
      };
    }),
  };
}

export function serializeWalletDto<
  T extends { balance: MoneyValue; transactions?: Array<{ amount: MoneyValue }> }
>(wallet: T) {
  return {
    ...wallet,
    balance: serializeMoneyVnd(
      typeof wallet.balance === 'bigint'
        ? wallet.balance
        : parseMoneyVnd(wallet.balance, 'balance')
    ),
    transactions: wallet.transactions?.map((tx) => ({
      ...tx,
      amount:
        typeof tx.amount === 'bigint'
          ? (tx.amount < BigInt(0) ? serializeSignedMoneyVnd(tx.amount) : serializeMoneyVnd(tx.amount))
          : serializeSignedMoneyVnd(tx.amount),
    })),
  };
}

export function serializeBankTransferDto<T extends { amount: MoneyValue }>(transfer: T) {
  return {
    ...transfer,
    amount: serializeMoneyVnd(
      typeof transfer.amount === 'bigint'
        ? transfer.amount
        : parseMoneyVnd(transfer.amount, 'amount')
    ),
  };
}
