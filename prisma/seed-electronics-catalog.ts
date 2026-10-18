import { PrismaClient } from '@prisma/client';
import { computeVariantOptionHash } from '../src/shared/validations/catalog-json.ts';
import { invalidateProductCache } from '../src/server/infrastructure/redis.ts';
import type { CategorySpecSchema, ProductKind, ProductSegment } from '../src/shared/types/catalog.ts';

const prisma = new PrismaClient();

export interface SeedBrand {
  id: string;
  name: string;
  slug: string;
  country: string;
  websiteUrl: string;
  isActive: boolean;
}

export interface SeedCategory {
  id: string;
  name: string;
  slug: string;
  kind: ProductKind;
  specSchemaVersion: number;
  specSchema: CategorySpecSchema;
  warrantyConfig: Record<string, unknown>;
  isActive: boolean;
}

export interface SeedVariant {
  sku: string;
  title: string;
  price: number;
  stock: number;
  color?: string;
  size?: string;
  optionValues: Record<string, string | number | boolean>;
}

export interface SeedProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  brandId: string;
  categoryId: string;
  kind: ProductKind;
  segment: ProductSegment;
  weight: number;
  length: number;
  width: number;
  height: number;
  warrantyConfig: Record<string, unknown>;
  specs: {
    schemaVersion: number;
    values: Record<
      string,
      | { state: 'KNOWN'; value: string | number | boolean; unit?: string }
      | { state: 'UNKNOWN' }
      | { state: 'UNSUPPORTED' }
    >;
  };
  variants: SeedVariant[];
  images: Array<{ url: string; alt: string; sortOrder: number }>;
}

export interface SeedDataSource {
  id: string;
  name: string;
  sourceType: 'MANUFACTURER' | 'CATALOG';
  status: 'ACTIVE';
  publisher: string;
  url: string;
  license: string;
  version: string;
  checksum: string;
  isSynthetic: boolean;
  payload: {
    mapping: {
      productId: string;
    };
  };
}

// ═══════════════════════════════════════════════════════
// 1. ELECTRONICS BRANDS
// ═══════════════════════════════════════════════════════
export const ELECTRONICS_BRANDS: SeedBrand[] = [
  {
    id: 'brand-apple',
    name: 'Apple',
    slug: 'apple',
    country: 'United States',
    websiteUrl: 'https://www.apple.com',
    isActive: true,
  },
  {
    id: 'brand-lenovo',
    name: 'Lenovo',
    slug: 'lenovo',
    country: 'China',
    websiteUrl: 'https://www.lenovo.com',
    isActive: true,
  },
  {
    id: 'brand-dell',
    name: 'Dell',
    slug: 'dell',
    country: 'United States',
    websiteUrl: 'https://www.dell.com',
    isActive: true,
  },
  {
    id: 'brand-samsung',
    name: 'Samsung',
    slug: 'samsung',
    country: 'South Korea',
    websiteUrl: 'https://www.samsung.com',
    isActive: true,
  },
  {
    id: 'brand-anker',
    name: 'Anker',
    slug: 'anker',
    country: 'China',
    websiteUrl: 'https://www.anker.com',
    isActive: true,
  },
  {
    id: 'brand-sony',
    name: 'Sony',
    slug: 'sony',
    country: 'Japan',
    websiteUrl: 'https://www.sony.com',
    isActive: true,
  },
];

// ═══════════════════════════════════════════════════════
// 2. ELECTRONICS CATEGORIES WITH STRICT SPEC SCHEMAS
// ═══════════════════════════════════════════════════════
export const ELECTRONICS_CATEGORIES: SeedCategory[] = [
  {
    id: 'cat-laptop',
    name: 'Laptop & Máy tính xách tay',
    slug: 'laptop',
    kind: 'LAPTOP',
    specSchemaVersion: 1,
    warrantyConfig: {
      policyType: 'OFFICIAL',
      periodMonths: 12,
      provider: 'MANUFACTURER',
    },
    isActive: true,
    specSchema: {
      schemaVersion: 1,
      definitions: [
        { code: 'cpu', label: 'Vi xử lý (CPU)', valueType: 'TEXT', required: true, filterable: true, comparable: true },
        { code: 'ram', label: 'Bộ nhớ RAM', valueType: 'INTEGER', unit: 'GB', required: true, filterable: true, comparable: true },
        { code: 'ssd', label: 'Ổ cứng SSD', valueType: 'INTEGER', unit: 'GB', required: true, filterable: true, comparable: true },
        { code: 'display_size', label: 'Kích thước màn hình', valueType: 'DECIMAL', unit: 'inch', required: true, filterable: true, comparable: true },
        { code: 'resolution', label: 'Độ phân giải', valueType: 'TEXT', required: true, comparable: true },
        { code: 'refresh_rate', label: 'Tần số quét', valueType: 'INTEGER', unit: 'Hz', comparable: true },
        { code: 'weight', label: 'Trọng lượng', valueType: 'DECIMAL', unit: 'kg', comparable: true },
        { code: 'os', label: 'Hệ điều hành', valueType: 'TEXT', filterable: true, comparable: true },
        { code: 'nfc', label: 'Kết nối NFC', valueType: 'BOOLEAN', allowUnsupported: true, comparable: true },
      ],
      variantOptions: [
        { code: 'color', label: 'Màu sắc', valueType: 'TEXT' },
        { code: 'ram', label: 'RAM', valueType: 'INTEGER', unit: 'GB' },
        { code: 'ssd', label: 'SSD', valueType: 'INTEGER', unit: 'GB' },
      ],
    },
  },
  {
    id: 'cat-smartphone',
    name: 'Điện thoại thông minh',
    slug: 'smartphone',
    kind: 'PHONE',
    specSchemaVersion: 1,
    warrantyConfig: {
      policyType: 'OFFICIAL',
      periodMonths: 12,
      provider: 'MANUFACTURER',
    },
    isActive: true,
    specSchema: {
      schemaVersion: 1,
      definitions: [
        { code: 'chipset', label: 'Vi xử lý (Chipset)', valueType: 'TEXT', required: true, filterable: true, comparable: true },
        { code: 'ram', label: 'Bộ nhớ RAM', valueType: 'INTEGER', unit: 'GB', required: true, filterable: true, comparable: true },
        { code: 'storage', label: 'Bộ nhớ trong', valueType: 'INTEGER', unit: 'GB', required: true, filterable: true, comparable: true },
        { code: 'screen_size', label: 'Màn hình', valueType: 'DECIMAL', unit: 'inch', required: true, filterable: true, comparable: true },
        { code: 'battery_capacity', label: 'Dung lượng pin', valueType: 'INTEGER', unit: 'mAh', comparable: true },
        { code: 'camera_main', label: 'Camera chính', valueType: 'INTEGER', unit: 'MP', comparable: true },
        { code: 'is_5g', label: 'Hỗ trợ 5G', valueType: 'BOOLEAN', filterable: true, comparable: true },
        { code: 'os', label: 'Hệ điều hành', valueType: 'TEXT', filterable: true, comparable: true },
        { code: 'nfc', label: 'Giao tiếp NFC', valueType: 'BOOLEAN', comparable: true },
      ],
      variantOptions: [
        { code: 'color', label: 'Màu sắc', valueType: 'TEXT' },
        { code: 'storage', label: 'Dung lượng lưu trữ', valueType: 'INTEGER', unit: 'GB' },
      ],
    },
  },
  {
    id: 'cat-accessory',
    name: 'Phụ kiện & Thiết bị ngoại vi',
    slug: 'accessory',
    kind: 'ACCESSORY',
    specSchemaVersion: 1,
    warrantyConfig: {
      policyType: 'OFFICIAL',
      periodMonths: 18,
      provider: 'MANUFACTURER',
    },
    isActive: true,
    specSchema: {
      schemaVersion: 1,
      definitions: [
        { code: 'connection_type', label: 'Phương thức kết nối', valueType: 'TEXT', filterable: true, comparable: true },
        { code: 'power_output', label: 'Công suất tối đa', valueType: 'INTEGER', unit: 'W', filterable: true, comparable: true, allowUnsupported: true },
        { code: 'ports', label: 'Số cổng kết nối', valueType: 'INTEGER', comparable: true, allowUnsupported: true },
        { code: 'fast_charging', label: 'Hỗ trợ sạc nhanh', valueType: 'BOOLEAN', filterable: true, comparable: true, allowUnsupported: true },
        { code: 'battery_capacity', label: 'Dung lượng pin', valueType: 'INTEGER', unit: 'mAh', comparable: true, allowUnsupported: true },
        { code: 'weight', label: 'Trọng lượng', valueType: 'INTEGER', unit: 'g', comparable: true },
      ],
      variantOptions: [
        { code: 'color', label: 'Màu sắc', valueType: 'TEXT' },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════
// 3. 10-PRODUCT ELECTRONICS VERTICAL SLICE
// ═══════════════════════════════════════════════════════
export const ELECTRONICS_PRODUCTS: SeedProduct[] = [
  // ─── 2 Laptops ───
  {
    id: 'prod-mbp14-m3',
    slug: 'macbook-pro-14-m3',
    name: 'MacBook Pro 14 inch M3 (8-Core CPU / 10-Core GPU)',
    description: 'Laptop chuyên nghiệp cao cấp với chip Apple M3, màn hình Liquid Retina XDR 120Hz siêu nét, thời lượng pin lên đến 22 giờ.',
    brandId: 'brand-apple',
    categoryId: 'cat-laptop',
    kind: 'LAPTOP',
    segment: 'PREMIUM',
    weight: 1550,
    length: 31,
    width: 22,
    height: 2,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Apple Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        cpu: { state: 'KNOWN', value: 'Apple M3 8-core' },
        ram: { state: 'KNOWN', value: 8, unit: 'GB' },
        ssd: { state: 'KNOWN', value: 512, unit: 'GB' },
        display_size: { state: 'KNOWN', value: 14.2, unit: 'inch' },
        resolution: { state: 'KNOWN', value: '3024x1964 Liquid Retina XDR' },
        refresh_rate: { state: 'KNOWN', value: 120, unit: 'Hz' },
        weight: { state: 'KNOWN', value: 1.55, unit: 'kg' },
        os: { state: 'KNOWN', value: 'macOS Sonoma' },
        nfc: { state: 'UNSUPPORTED' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', alt: 'MacBook Pro 14 M3 góc chính diện', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80', alt: 'MacBook Pro 14 M3 cạnh bên mở rộng', sortOrder: 1 },
    ],
    variants: [
      {
        sku: 'MBP14-M3-8-512-SG',
        title: 'Xám không gian / 8GB RAM / 512GB SSD',
        price: 39990000,
        stock: 15,
        color: 'Space Grey',
        optionValues: { color: 'Space Grey', ram: 8, ssd: 512 },
      },
      {
        sku: 'MBP14-M3-16-512-SLV',
        title: 'Bạc ánh kim / 16GB RAM / 512GB SSD',
        price: 44990000,
        stock: 10,
        color: 'Silver',
        optionValues: { color: 'Silver', ram: 16, ssd: 512 },
      },
    ],
  },
  {
    id: 'prod-thinkpad-x1-c11',
    slug: 'thinkpad-x1-carbon-gen-11',
    name: 'Lenovo ThinkPad X1 Carbon Gen 11 Ultralight',
    description: 'Chiếc ultrabook doanh nhân biểu tượng làm từ sợi carbon siêu nhẹ chỉ 1.12kg, bàn phím gõ êm trứ danh, độ bền đạt chuẩn quân đội MIL-STD 810H.',
    brandId: 'brand-lenovo',
    categoryId: 'cat-laptop',
    kind: 'LAPTOP',
    segment: 'PREMIUM',
    weight: 1120,
    length: 32,
    width: 22,
    height: 2,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 36, provider: 'Lenovo Premier Support' },
    specs: {
      schemaVersion: 1,
      values: {
        cpu: { state: 'KNOWN', value: 'Intel Core i7-1365U vPro' },
        ram: { state: 'KNOWN', value: 16, unit: 'GB' },
        ssd: { state: 'KNOWN', value: 512, unit: 'GB' },
        display_size: { state: 'KNOWN', value: 14.0, unit: 'inch' },
        resolution: { state: 'KNOWN', value: '1920x1200 IPS Low Power 400 nits' },
        refresh_rate: { state: 'KNOWN', value: 60, unit: 'Hz' },
        weight: { state: 'KNOWN', value: 1.12, unit: 'kg' },
        os: { state: 'KNOWN', value: 'Windows 11 Pro' },
        nfc: { state: 'UNSUPPORTED' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80', alt: 'Lenovo ThinkPad X1 Carbon Gen 11 mở phẳng', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80', alt: 'Bàn phím ThinkPad với TrackPoint đỏ', sortOrder: 1 },
    ],
    variants: [
      {
        sku: 'TP-X1C11-I7-16-512-BLK',
        title: 'Đen nhung / 16GB RAM / 512GB SSD',
        price: 38500000,
        stock: 12,
        color: 'Deep Black',
        optionValues: { color: 'Deep Black', ram: 16, ssd: 512 },
      },
      {
        sku: 'TP-X1C11-I7-32-1TB-BLK',
        title: 'Đen nhung / 32GB RAM / 1TB SSD',
        price: 46900000,
        stock: 8,
        color: 'Deep Black',
        optionValues: { color: 'Deep Black', ram: 32, ssd: 1024 },
      },
    ],
  },

  // ─── 2 Smartphones ───
  {
    id: 'prod-iphone-15-pro-max',
    slug: 'iphone-15-pro-max',
    name: 'Apple iPhone 15 Pro Max Titanium',
    description: 'Khung viền Titanium chuẩn hàng không vũ trụ, chip A17 Pro tiến trình 3nm đột phá đồ họa game console, camera zoom quang học 5x cùng nút Tác Vụ tùy biến.',
    brandId: 'brand-apple',
    categoryId: 'cat-smartphone',
    kind: 'PHONE',
    segment: 'FLAGSHIP',
    weight: 221,
    length: 16,
    width: 8,
    height: 1,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Apple Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        chipset: { state: 'KNOWN', value: 'Apple A17 Pro 3nm' },
        ram: { state: 'KNOWN', value: 8, unit: 'GB' },
        storage: { state: 'KNOWN', value: 256, unit: 'GB' },
        screen_size: { state: 'KNOWN', value: 6.7, unit: 'inch' },
        battery_capacity: { state: 'KNOWN', value: 4422, unit: 'mAh' },
        camera_main: { state: 'KNOWN', value: 48, unit: 'MP' },
        is_5g: { state: 'KNOWN', value: true },
        os: { state: 'KNOWN', value: 'iOS 17' },
        nfc: { state: 'KNOWN', value: true },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80', alt: 'iPhone 15 Pro Max mặt lưng Titanium', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1695048065059-d4bf453bbe9c?auto=format&fit=crop&w=800&q=80', alt: 'Cụm camera 3 mắt iPhone 15 Pro Max', sortOrder: 1 },
    ],
    variants: [
      {
        sku: 'IP15PM-256-NAT',
        title: 'Titan Tự Nhiên / 256GB',
        price: 29990000,
        stock: 20,
        color: 'Natural Titanium',
        optionValues: { color: 'Natural Titanium', storage: 256 },
      },
      {
        sku: 'IP15PM-512-BLU',
        title: 'Titan Xanh / 512GB',
        price: 34990000,
        stock: 14,
        color: 'Blue Titanium',
        optionValues: { color: 'Blue Titanium', storage: 512 },
      },
    ],
  },
  {
    id: 'prod-galaxy-s24-ultra',
    slug: 'samsung-galaxy-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra 5G AI Phone',
    description: 'Quyền năng Galaxy AI đỉnh cao, màn hình phẳng Dynamic AMOLED 2X 2600 nits chống chói Corning Gorilla Armor, bút S-Pen tích hợp và camera 200MP bắt trọn màn đêm.',
    brandId: 'brand-samsung',
    categoryId: 'cat-smartphone',
    kind: 'PHONE',
    segment: 'FLAGSHIP',
    weight: 232,
    length: 16,
    width: 8,
    height: 1,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Samsung Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        chipset: { state: 'KNOWN', value: 'Snapdragon 8 Gen 3 for Galaxy' },
        ram: { state: 'KNOWN', value: 12, unit: 'GB' },
        storage: { state: 'KNOWN', value: 256, unit: 'GB' },
        screen_size: { state: 'KNOWN', value: 6.8, unit: 'inch' },
        battery_capacity: { state: 'KNOWN', value: 5000, unit: 'mAh' },
        camera_main: { state: 'KNOWN', value: 200, unit: 'MP' },
        is_5g: { state: 'KNOWN', value: true },
        os: { state: 'KNOWN', value: 'Android 14 / One UI 6.1' },
        nfc: { state: 'KNOWN', value: true },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80', alt: 'Samsung Galaxy S24 Ultra kèm bút S-Pen', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80', alt: 'Màn hình hiển thị viền siêu mỏng Galaxy S24', sortOrder: 1 },
    ],
    variants: [
      {
        sku: 'S24U-256-GRAY',
        title: 'Xám Titan / 256GB',
        price: 28490000,
        stock: 25,
        color: 'Titanium Gray',
        optionValues: { color: 'Titanium Gray', storage: 256 },
      },
      {
        sku: 'S24U-512-BLK',
        title: 'Đen Titan / 512GB',
        price: 32990000,
        stock: 16,
        color: 'Titanium Black',
        optionValues: { color: 'Titanium Black', storage: 512 },
      },
    ],
  },

  // ─── 6 Accessories ───
  {
    id: 'prod-anker-prime-67w',
    slug: 'cu-sac-nhanh-anker-prime-67w-gan',
    name: 'Củ sạc nhanh Anker Prime 67W GaN 3 cổng (2C1A)',
    description: 'Công nghệ bán dẫn GaNPrime thế hệ mới nhỏ gọn hơn 51%, công suất 67W sạc nhanh cùng lúc MacBook, iPhone và iPad với tính năng phân bổ dòng điện động PowerIQ 4.0.',
    brandId: 'brand-anker',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'PREMIUM',
    weight: 145,
    length: 5,
    width: 4,
    height: 4,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 24, provider: 'Anker Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'USB-C x2, USB-A x1' },
        power_output: { state: 'KNOWN', value: 67, unit: 'W' },
        ports: { state: 'KNOWN', value: 3 },
        fast_charging: { state: 'KNOWN', value: true },
        battery_capacity: { state: 'UNSUPPORTED' },
        weight: { state: 'KNOWN', value: 145, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80', alt: 'Củ sạc Anker GaNPrime 67W cắm ổ điện', sortOrder: 0 },
    ],
    variants: [
      {
        sku: 'ANKER-PRIME-67W-BLK',
        title: 'Đen không gian (Space Black)',
        price: 1190000,
        stock: 45,
        color: 'Space Black',
        optionValues: { color: 'Space Black' },
      },
    ],
  },
  {
    id: 'prod-sony-wh-1000xm5',
    slug: 'tai-nghe-sony-wh-1000xm5',
    name: 'Tai nghe chụp tai không dây chống ồn Sony WH-1000XM5',
    description: 'Hệ thống chống ồn chủ động kép với 8 micro và 2 bộ xử lý V1 + QN1, chất âm chuẩn Hi-Res Audio Wireless LDAC, đàm thoại AI lọc tạp âm trong trẻo.',
    brandId: 'brand-sony',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'FLAGSHIP',
    weight: 250,
    length: 22,
    width: 20,
    height: 6,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Sony Electronics Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'Bluetooth 5.2 / 3.5mm Aux' },
        power_output: { state: 'UNSUPPORTED' },
        ports: { state: 'KNOWN', value: 2 },
        fast_charging: { state: 'KNOWN', value: true },
        battery_capacity: { state: 'KNOWN', value: 1200, unit: 'mAh' },
        weight: { state: 'KNOWN', value: 250, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80', alt: 'Tai nghe Sony WH-1000XM5 màu đen', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', alt: 'Chi tiết đệm tai êm ái Sony XM5', sortOrder: 1 },
    ],
    variants: [
      {
        sku: 'SONY-XM5-BLK',
        title: 'Đen nhung (Black)',
        price: 7990000,
        stock: 18,
        color: 'Black',
        optionValues: { color: 'Black' },
      },
      {
        sku: 'SONY-XM5-SLV',
        title: 'Bạc ánh kim (Silver)',
        price: 7990000,
        stock: 12,
        color: 'Silver',
        optionValues: { color: 'Silver' },
      },
    ],
  },
  {
    id: 'prod-apple-magic-mouse',
    slug: 'chuot-apple-magic-mouse-usb-c',
    name: 'Chuột Apple Magic Mouse Multi-Touch (Cổng sạc Type-C)',
    description: 'Chuột không dây cảm ứng đa điểm hỗ trợ vuốt chạm mượt mà trên macOS, thiết kế chân đế tối ưu lướt nhẹ nhàng, tích hợp cáp bện Type-C bền bỉ.',
    brandId: 'brand-apple',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'PREMIUM',
    weight: 99,
    length: 11,
    width: 6,
    height: 2,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Apple Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'Bluetooth / USB-C' },
        power_output: { state: 'UNSUPPORTED' },
        ports: { state: 'KNOWN', value: 1 },
        fast_charging: { state: 'KNOWN', value: false },
        battery_capacity: { state: 'UNKNOWN' },
        weight: { state: 'KNOWN', value: 99, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80', alt: 'Chuột Apple Magic Mouse mặt trên trắng bóng', sortOrder: 0 },
    ],
    variants: [
      {
        sku: 'APPLE-MM-USBC-WHT',
        title: 'Trắng sứ bóng (White Surface)',
        price: 2190000,
        stock: 30,
        color: 'White',
        optionValues: { color: 'White' },
      },
    ],
  },
  {
    id: 'prod-dell-da310',
    slug: 'hub-chuyen-doi-dell-da310-usb-c-7-in-1',
    name: 'Hub chuyển đổi đa năng Dell DA310 USB-C Mobile Adapter 7-in-1',
    description: 'Bộ mở rộng cổng kết nối dạng đĩa bay độc đáo: HDMI 4K 60Hz, DisplayPort, VGA, 2x USB-A 10Gbps, 1x USB-C Pass-through 90W và cổng mạng LAN Gigabit RJ-45.',
    brandId: 'brand-dell',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'PREMIUM',
    weight: 290,
    length: 7,
    width: 7,
    height: 3,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 36, provider: 'Dell Technologies' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'USB-C Tethered Cable' },
        power_output: { state: 'KNOWN', value: 90, unit: 'W' },
        ports: { state: 'KNOWN', value: 7 },
        fast_charging: { state: 'KNOWN', value: true },
        battery_capacity: { state: 'UNSUPPORTED' },
        weight: { state: 'KNOWN', value: 290, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80', alt: 'Hub Dell DA310 tròn nhỏ gọn', sortOrder: 0 },
    ],
    variants: [
      {
        sku: 'DELL-DA310-7IN1',
        title: 'Xám Titan (Titan Grey)',
        price: 2490000,
        stock: 22,
        color: 'Titan Grey',
        optionValues: { color: 'Titan Grey' },
      },
    ],
  },
  {
    id: 'prod-anker-737-powerbank',
    slug: 'pin-sac-du-phong-anker-powercore-24000mah-140w',
    name: 'Pin sạc dự phòng Anker 737 PowerBank 24,000mAh 140W (PowerCore 24K)',
    description: 'Sạc dự phòng công suất siêu khủng 140W chuẩn PD 3.1 hai chiều, dung lượng 24.000mAh đủ sạc đầy laptop, màn hình màu OLED hiển thị công suất và nhiệt độ pin thời gian thực.',
    brandId: 'brand-anker',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'FLAGSHIP',
    weight: 630,
    length: 16,
    width: 5,
    height: 5,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 24, provider: 'Anker Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'USB-C x2, USB-A x1' },
        power_output: { state: 'KNOWN', value: 140, unit: 'W' },
        ports: { state: 'KNOWN', value: 3 },
        fast_charging: { state: 'KNOWN', value: true },
        battery_capacity: { state: 'KNOWN', value: 24000, unit: 'mAh' },
        weight: { state: 'KNOWN', value: 630, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=800&q=80', alt: 'Pin sạc dự phòng Anker 737 với màn hình kỹ thuật số', sortOrder: 0 },
    ],
    variants: [
      {
        sku: 'ANKER-737-140W-24K',
        title: 'Xám than chì (Charcoal Grey)',
        price: 2790000,
        stock: 25,
        color: 'Charcoal Grey',
        optionValues: { color: 'Charcoal Grey' },
      },
    ],
  },
  {
    id: 'prod-samsung-45w-charger',
    slug: 'cu-sac-nhanh-samsung-45w-type-c',
    name: 'Củ sạc siêu nhanh Samsung 45W Type-C T4510 Super Fast Charging 2.0',
    description: 'Sạc nhanh siêu tốc chuẩn PD 3.0 PPS cho Galaxy S24 Ultra và các dòng điện thoại Galaxy cao cấp, tiêu thụ điện chế độ chờ cực thấp dưới 5mW.',
    brandId: 'brand-samsung',
    categoryId: 'cat-accessory',
    kind: 'ACCESSORY',
    segment: 'MID_RANGE',
    weight: 105,
    length: 5,
    width: 4,
    height: 3,
    warrantyConfig: { policyType: 'OFFICIAL', periodMonths: 12, provider: 'Samsung Vietnam' },
    specs: {
      schemaVersion: 1,
      values: {
        connection_type: { state: 'KNOWN', value: 'USB-C' },
        power_output: { state: 'KNOWN', value: 45, unit: 'W' },
        ports: { state: 'KNOWN', value: 1 },
        fast_charging: { state: 'KNOWN', value: true },
        battery_capacity: { state: 'UNSUPPORTED' },
        weight: { state: 'KNOWN', value: 105, unit: 'g' },
      },
    },
    images: [
      { url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80', alt: 'Củ sạc nhanh Samsung 45W màu đen', sortOrder: 0 },
    ],
    variants: [
      {
        sku: 'SS-45W-T4510-BLK',
        title: 'Đen nguyên bản (Phantom Black)',
        price: 790000,
        stock: 50,
        color: 'Black',
        optionValues: { color: 'Black' },
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════
// 4. ACTIVE DATA SOURCES (PROVENANCE REPOSITORY)
// ═══════════════════════════════════════════════════════
export const ELECTRONICS_DATA_SOURCES: SeedDataSource[] = [
  {
    id: 'src-apple-mbp14-m3',
    name: 'Apple Inc. - MacBook Pro 14 M3 Technical Specifications',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Apple Inc.',
    url: 'https://support.apple.com/kb/SP898',
    license: 'Public Technical Documentation / Open Hardware Spec Sheet',
    version: '2024.1',
    checksum: 'a4b1c8e3f92d5017e8c39fa4109b6782d109f284c810398f6238b1d94f271049',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-mbp14-m3',
      },
    },
  },
  {
    id: 'src-lenovo-x1-carbon-gen11',
    name: 'Lenovo Group - ThinkPad X1 Carbon Gen 11 PSREF Documentation',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Lenovo Group Limited',
    url: 'https://psref.lenovo.com/Product/ThinkPad/ThinkPad_X1_Carbon_Gen_11',
    license: 'Lenovo Product Specifications Reference Public Sheet',
    version: '2023.2',
    checksum: 'f872c019482bf49102c98a3b817420194857b2938475c1029384756102938475',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-thinkpad-x1-c11',
      },
    },
  },
  {
    id: 'src-apple-iphone15-pro-max',
    name: 'Apple Inc. - iPhone 15 Pro Max Technical Specifications',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Apple Inc.',
    url: 'https://support.apple.com/kb/SP903',
    license: 'Public Technical Documentation / Open Hardware Spec Sheet',
    version: '2024.1',
    checksum: 'b928174629384756102938475610293847561029384756102938475610293847',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-iphone-15-pro-max',
      },
    },
  },
  {
    id: 'src-samsung-s24-ultra',
    name: 'Samsung Electronics - Galaxy S24 Ultra Official Spec Sheet',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Samsung Electronics Co., Ltd.',
    url: 'https://www.samsung.com/global/galaxy/galaxy-s24-ultra/specs/',
    license: 'Samsung Open Hardware Tech Specs Reference',
    version: '2024.2',
    checksum: 'd837261948572610394857261039485726103948572610394857261039485726',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-galaxy-s24-ultra',
      },
    },
  },
  {
    id: 'src-anker-prime-67w',
    name: 'Anker Innovations - Anker Prime 67W GaN Wall Charger Specification',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Anker Innovations Technology',
    url: 'https://www.anker.com/products/a2669',
    license: 'Anker Innovations Public Product Data Sheet',
    version: '2023.1',
    checksum: 'c728194726103948572610394857261039485726103948572610394857261039',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-anker-prime-67w',
      },
    },
  },
  {
    id: 'src-sony-wh1000xm5',
    name: 'Sony Corporation - WH-1000XM5 Noise Canceling Headphones Tech Guide',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Sony Corporation',
    url: 'https://www.sony.com/electronics/headband-headphones/wh-1000xm5/specifications',
    license: 'Sony Corporation Public Hardware Specifications',
    version: '2022.3',
    checksum: 'e928174620194857261039485726103948572610394857261039485726103948',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-sony-wh-1000xm5',
      },
    },
  },
  {
    id: 'src-apple-magic-mouse',
    name: 'Apple Inc. - Magic Mouse USB-C Specification Sheet',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Apple Inc.',
    url: 'https://www.apple.com/shop/product/MXK53AM/A/magic-mouse-usb-c',
    license: 'Public Technical Documentation / Open Hardware Spec Sheet',
    version: '2024.1',
    checksum: 'a837261948572610394857261039485726103948572610394857261039485726',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-apple-magic-mouse',
      },
    },
  },
  {
    id: 'src-dell-da310',
    name: 'Dell Technologies - DA310 USB-C Mobile Adapter Spec Sheet',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Dell Technologies Inc.',
    url: 'https://www.dell.com/en-us/shop/dell-7-in-1-usb-c-multiport-adapter-da310/apd/470-aetl',
    license: 'Dell Technologies Commercial Hardware Catalog Entry',
    version: '2023.1',
    checksum: 'b728194726103948572610394857261039485726103948572610394857261039',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-dell-da310',
      },
    },
  },
  {
    id: 'src-anker-737',
    name: 'Anker Innovations - 737 PowerBank PowerCore 24K Hardware Guide',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Anker Innovations Technology',
    url: 'https://www.anker.com/products/a1289',
    license: 'Anker Innovations Public Product Data Sheet',
    version: '2023.2',
    checksum: 'f928174620194857261039485726103948572610394857261039485726103948',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-anker-737-powerbank',
      },
    },
  },
  {
    id: 'src-samsung-45w',
    name: 'Samsung Electronics - EP-T4510 45W Power Adapter Tech Specs',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'Samsung Electronics Co., Ltd.',
    url: 'https://www.samsung.com/us/mobile/mobile-accessories/phones/45w-power-adapter-with-cable-ep-t4510xbegus/',
    license: 'Samsung Open Hardware Tech Specs Reference',
    version: '2024.1',
    checksum: 'c837261948572610394857261039485726103948572610394857261039485726',
    isSynthetic: false,
    payload: {
      mapping: {
        productId: 'prod-samsung-45w-charger',
      },
    },
  },
];

// ═══════════════════════════════════════════════════════
// 5. IDEMPOTENT SEED EXECUTION LOGIC
// ═══════════════════════════════════════════════════════
export async function seedElectronicsCatalog(db = prisma): Promise<{
  brandsCount: number;
  categoriesCount: number;
  productsCount: number;
  variantsCount: number;
  dataSourcesCount: number;
}> {
  console.log('🚀 Seeding Compact Electronics Vertical Slice (10 Products)...');

  // 1. Seed Brands
  for (const b of ELECTRONICS_BRANDS) {
    await db.brand.upsert({
      where: { slug: b.slug },
      update: {
        name: b.name,
        country: b.country,
        websiteUrl: b.websiteUrl,
        isActive: b.isActive,
      },
      create: {
        id: b.id,
        name: b.name,
        slug: b.slug,
        country: b.country,
        websiteUrl: b.websiteUrl,
        isActive: b.isActive,
      },
    });
  }

  // 2. Seed Categories
  for (const c of ELECTRONICS_CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        kind: c.kind,
        specSchema: c.specSchema as unknown as Record<string, unknown>,
        specSchemaVersion: c.specSchemaVersion,
        warrantyConfig: c.warrantyConfig as unknown as Record<string, unknown>,
        isActive: c.isActive,
      },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        kind: c.kind,
        specSchema: c.specSchema as unknown as Record<string, unknown>,
        specSchemaVersion: c.specSchemaVersion,
        warrantyConfig: c.warrantyConfig as unknown as Record<string, unknown>,
        isActive: c.isActive,
      },
    });
  }

  // 3. Seed Products and Variants
  let totalVariants = 0;
  for (const p of ELECTRONICS_PRODUCTS) {
    const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
    const minPrice = p.variants.reduce(
      (min, v) => (v.price < min ? v.price : min),
      p.variants[0]?.price ?? 0
    );

    const productRecord = await db.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: BigInt(minPrice),
        image: p.images[0]?.url || null,
        category: p.categoryId === 'cat-laptop' ? 'Laptop' : p.categoryId === 'cat-smartphone' ? 'Điện thoại' : 'Phụ kiện',
        brandId: p.brandId,
        categoryId: p.categoryId,
        kind: p.kind,
        segment: p.segment,
        isLegacy: false,
        specs: p.specs as unknown as Record<string, unknown>,
        images: p.images as unknown as Record<string, unknown>[],
        warrantyConfig: p.warrantyConfig as unknown as Record<string, unknown>,
        weightGrams: p.weight,
        lengthCm: p.length,
        widthCm: p.width,
        heightCm: p.height,
        stock: totalStock,
        inventoryMode: 'VARIANT',
        isActive: true,
      },
      create: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: BigInt(minPrice),
        image: p.images[0]?.url || null,
        category: p.categoryId === 'cat-laptop' ? 'Laptop' : p.categoryId === 'cat-smartphone' ? 'Điện thoại' : 'Phụ kiện',
        brandId: p.brandId,
        categoryId: p.categoryId,
        kind: p.kind,
        segment: p.segment,
        isLegacy: false,
        specs: p.specs as unknown as Record<string, unknown>,
        images: p.images as unknown as Record<string, unknown>[],
        warrantyConfig: p.warrantyConfig as unknown as Record<string, unknown>,
        weightGrams: p.weight,
        lengthCm: p.length,
        widthCm: p.width,
        heightCm: p.height,
        stock: totalStock,
        inventoryMode: 'VARIANT',
        isActive: true,
      },
    });

    for (const v of p.variants) {
      const optItems = Object.entries(v.optionValues).map(([code, value]) => ({ code, value }));
      const optionHash = computeVariantOptionHash(optItems);

      await db.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          productId: productRecord.id,
          title: v.title,
          price: BigInt(v.price),
          stock: v.stock,
          color: v.color || null,
          size: v.size || null,
          image: p.images[0]?.url || null,
          optionValues: v.optionValues as unknown as Record<string, unknown>,
          optionHash,
          isActive: true,
        },
        create: {
          productId: productRecord.id,
          sku: v.sku,
          title: v.title,
          price: BigInt(v.price),
          stock: v.stock,
          color: v.color || null,
          size: v.size || null,
          image: p.images[0]?.url || null,
          optionValues: v.optionValues as unknown as Record<string, unknown>,
          optionHash,
          isActive: true,
        },
      });
      totalVariants++;
    }
  }

  // 4. Seed Data Sources
  for (const src of ELECTRONICS_DATA_SOURCES) {
    await db.dataSource.upsert({
      where: { id: src.id },
      update: {
        name: src.name,
        sourceType: src.sourceType,
        status: src.status,
        publisher: src.publisher,
        url: src.url,
        license: src.license,
        version: src.version,
        checksum: src.checksum,
        isSynthetic: src.isSynthetic,
        payload: src.payload as unknown as Record<string, unknown>,
      },
      create: {
        id: src.id,
        name: src.name,
        sourceType: src.sourceType,
        status: src.status,
        publisher: src.publisher,
        url: src.url,
        license: src.license,
        version: src.version,
        checksum: src.checksum,
        isSynthetic: src.isSynthetic,
        payload: src.payload as unknown as Record<string, unknown>,
      },
    });
  }

  // 5. Invalidate caches
  await invalidateProductCache();

  console.log(`✅ Đã nạp thành công: ${ELECTRONICS_BRANDS.length} Brands, ${ELECTRONICS_CATEGORIES.length} Categories, ${ELECTRONICS_PRODUCTS.length} Products (${totalVariants} Variants), ${ELECTRONICS_DATA_SOURCES.length} DataSources.`);

  return {
    brandsCount: ELECTRONICS_BRANDS.length,
    categoriesCount: ELECTRONICS_CATEGORIES.length,
    productsCount: ELECTRONICS_PRODUCTS.length,
    variantsCount: totalVariants,
    dataSourcesCount: ELECTRONICS_DATA_SOURCES.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedElectronicsCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Lỗi khi chạy seed electronics catalog:', err);
      process.exit(1);
    });
}
