import type { AssistantSpecCell } from '@shared/types/assistant-commerce';

export const SPEC_META: Record<string, { label: string; unit?: string }> = {
  cpu_model: { label: 'CPU' }, gpu_model: { label: 'GPU' }, ram_capacity_gb: { label: 'RAM', unit: 'GB' },
  storage_capacity_gb: { label: 'Bộ nhớ', unit: 'GB' }, storage_type: { label: 'Loại lưu trữ' },
  screen_size_inch: { label: 'Màn hình', unit: 'inch' }, screen_resolution: { label: 'Độ phân giải' },
  refresh_rate_hz: { label: 'Tần số quét', unit: 'Hz' }, battery_capacity_wh: { label: 'Dung lượng pin', unit: 'Wh' },
  battery_capacity_mah: { label: 'Dung lượng pin', unit: 'mAh' }, weight_kg: { label: 'Trọng lượng', unit: 'kg' },
  weight_grams: { label: 'Trọng lượng', unit: 'g' }, charging_wattage: { label: 'Công suất sạc', unit: 'W' },
  port_type: { label: 'Cổng kết nối' }, connectivity: { label: 'Kết nối' }, os: { label: 'Hệ điều hành' },
  weight: { label: 'Trọng lượng' }, nfc: { label: 'NFC' },
  ports: { label: 'Số cổng' }, fast_charging: { label: 'Sạc nhanh' },
  camera_main: { label: 'Camera chính', unit: 'MP' }, is_5g: { label: 'Hỗ trợ 5G' },
  touchscreen: { label: 'Màn hình cảm ứng' }, dedicated_gpu: { label: 'GPU rời' },
};
const ALIASES: Record<string, string> = {
  ssd: 'storage_capacity_gb', display_size: 'screen_size_inch', screen_size: 'screen_size_inch', resolution: 'screen_resolution', refresh_rate: 'refresh_rate_hz', chipset: 'cpu_model', connection_type: 'connectivity', power_output: 'charging_wattage', battery_capacity: 'battery_capacity_mah',
  ram: 'ram_capacity_gb', ram_gb: 'ram_capacity_gb', storage: 'storage_capacity_gb', storage_gb: 'storage_capacity_gb',
  battery_wh: 'battery_capacity_wh', battery_mah: 'battery_capacity_mah', fast_charging_w: 'charging_wattage',
  screen_refresh_rate_hz: 'refresh_rate_hz', cpu: 'cpu_model', gpu: 'gpu_model',
};
export const canonicalSpecCode = (code: string) => ALIASES[code] || code;
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function readProductSpecs(base: unknown, overrides?: unknown): Record<string, AssistantSpecCell> {
  const result: Record<string, AssistantSpecCell> = {};
  for (const source of [base, overrides]) {
    const root = asRecord(source);
    const values = asRecord(root.values ?? root.attributes ?? root);
    for (const [rawCode, raw] of Object.entries(values)) {
      if (rawCode === 'schemaVersion' || rawCode === 'isLegacy') continue;
      const code = canonicalSpecCode(rawCode);
      const record = asRecord(raw);
      const value = 'value' in record ? record.value : raw;
      const state = record.state === 'UNSUPPORTED' ? 'UNSUPPORTED'
        : record.state === 'UNKNOWN' || value === null || value === undefined || value === '' ? 'UNKNOWN'
        : ['string', 'number', 'boolean'].includes(typeof value) ? 'KNOWN' : 'UNKNOWN';
      const meta = SPEC_META[code];
      const unit = typeof record.unit === 'string' ? record.unit : meta?.unit;
      const knownValue = state === 'KNOWN' ? value as string | number | boolean : undefined;
      result[code] = { code, label: meta?.label || code.replaceAll('_', ' '), state, value: knownValue, unit,
        formatted: state === 'UNKNOWN' ? 'Chưa có dữ liệu' : state === 'UNSUPPORTED' ? 'Không hỗ trợ'
          : typeof knownValue === 'boolean' ? (knownValue ? 'Có' : 'Không') : `${knownValue}${unit ? ` ${unit}` : ''}` };
    }
  }
  return result;
}
export function normalizeVietnamese(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}
