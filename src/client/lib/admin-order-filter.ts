export interface AdminOrderFilterItem {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
}

export interface AdminOrderCriteria {
  status: string;
  payment: string;
  query: string;
}

export function filterAdminOrders<T extends AdminOrderFilterItem>(orders: readonly T[], criteria: AdminOrderCriteria): T[] {
  const query = criteria.query.trim().toLocaleLowerCase('vi-VN');
  return orders.filter((order) => {
    if (criteria.status !== 'ALL' && order.status !== criteria.status) return false;
    if (criteria.payment !== 'ALL' && order.paymentStatus !== criteria.payment) return false;
    if (!query) return true;
    return [order.orderCode, order.customerName, order.customerPhone].some((value) => value.toLocaleLowerCase('vi-VN').includes(query));
  });
}

export function initialOrderQuery(params: { q?: string | string[]; search?: string | string[] }): string {
  const value = params.q ?? params.search;
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export function initialOrderStatus(params: { status?: string | string[] }): string {
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  return status && ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'].includes(status)
    ? status
    : 'ALL';
}
