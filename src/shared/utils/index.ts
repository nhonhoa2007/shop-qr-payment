export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatTime(dateStr: string | Date): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateStr: string | Date): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | Date): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function generateOrderCode(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `DH${date}${random}`;
}

export function generateTopupCode(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  let randomStr = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint16Array(1);
    globalThis.crypto.getRandomValues(array);
    randomStr = (array[0] % 1000).toString().padStart(3, '0');
  } else {
    randomStr = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }
  return `NAP${date}${randomStr}`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Chờ thanh toán',
    CONFIRMED: 'Đã xác nhận',
    PROCESSING: 'Đang xử lý',
    SHIPPING: 'Đang giao hàng',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    UNPAID: 'Chưa thanh toán',
    PAID: 'Đã thanh toán',
    EXPIRED: 'Hết hạn',
    REFUNDED: 'Đã hoàn tiền',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    SHIPPING: 'bg-indigo-100 text-indigo-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    UNPAID: 'bg-orange-100 text-orange-800',
    PAID: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    REFUNDED: 'bg-pink-100 text-pink-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getShipmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    READY_TO_PICK: 'Chờ GHN lấy hàng',
    PICKING: 'Đang lấy hàng',
    DELIVERING: 'Đang giao hàng',
    DELIVERED: 'Đã giao thành công',
    RETURNED: 'Chuyển hoàn',
    CANCELLED: 'Đã hủy vận đơn',
  };
  return labels[status] || status;
}

export function getShipmentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    READY_TO_PICK: 'bg-amber-100 text-amber-800 border-amber-200',
    PICKING: 'bg-blue-100 text-blue-800 border-blue-200',
    DELIVERING: 'bg-purple-100 text-purple-800 border-purple-200',
    DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    RETURNED: 'bg-rose-100 text-rose-800 border-rose-200',
    CANCELLED: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export * from './product-variants.ts';


