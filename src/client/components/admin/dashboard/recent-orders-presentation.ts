interface FilterableRecentOrder {
  orderCode: string;
  customerName: string;
  itemsSummary: string;
  totalAmount: number;
  status: string;
}

interface RecentOrderFilters {
  query?: string;
  status?: string;
  amountSort?: 'asc' | 'desc' | null;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterRecentOrders<T extends FilterableRecentOrder>(orders: readonly T[], filters: RecentOrderFilters): T[] {
  const query = fold(filters.query?.trim() ?? '');
  const filtered = orders.filter((order) => {
    if (filters.status && filters.status !== 'ALL' && order.status !== filters.status) return false;
    return !query || fold(`${order.orderCode} ${order.customerName} ${order.itemsSummary}`).includes(query);
  });
  if (!filters.amountSort) return filtered;
  return filtered.sort((a, b) => filters.amountSort === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount);
}
