import type { MoneyVnd } from './money.ts';
import type { ProductKind, ProductSegment, ProductSpecs } from './catalog.ts';
import type { InventoryMode } from './inventory.ts';

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc';

export interface CatalogQuery {
  search?: string;
  category?: string;
  brand?: string[];
  segment?: ProductSegment[];
  minPrice?: MoneyVnd | number | bigint;
  maxPrice?: MoneyVnd | number | bigint;
  inStock?: boolean;
  specs?: Record<string, string[]>;
  page?: number;
  limit?: number;
  sort?: CatalogSort;
}

export interface NormalizedCatalogQuery {
  search?: string;
  category?: string;
  brand?: string[];
  segment?: ProductSegment[];
  minPrice?: bigint;
  maxPrice?: bigint;
  inStock?: boolean;
  specs?: Record<string, string[]>;
  page: number;
  limit: number;
  sort: CatalogSort;
}

export interface CatalogBrandDto {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogCategoryDto {
  id: string;
  name: string;
  slug: string;
  kind: ProductKind;
}

export interface PriceRangeDto {
  min: MoneyVnd;
  max: MoneyVnd;
}

export interface CatalogItemDto {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  image: string | null;
  brand: CatalogBrandDto | null;
  category: CatalogCategoryDto | null;
  kind: ProductKind;
  segment: ProductSegment | null;
  price: MoneyVnd;
  effectivePrice: MoneyVnd;
  priceRange: PriceRangeDto;
  totalStock: number;
  inStock: boolean;
  inventoryMode: InventoryMode;
  specs: ProductSpecs | null;
  variantCount: number;
  isActive: boolean;
  createdAt: string;
  avgRating?: number;
  reviewCount?: number;
}

export interface PaginatedCatalogResponse<T = CatalogItemDto> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Standard allowlisted filterable spec codes for electronics catalog
 */
export const ALLOWLISTED_SPEC_CODES = new Set<string>([
  'cpu_model',
  'cpu_cores',
  'ram_capacity_gb',
  'storage_capacity_gb',
  'storage_type',
  'screen_size_inch',
  'screen_resolution',
  'refresh_rate_hz',
  'gpu_model',
  'battery_capacity_mah',
  'battery_capacity_wh',
  'charging_wattage',
  'weight_kg',
  'weight_grams',
  'os',
  'connectivity',
  'color',
  'port_type',
  'material',
  'warranty_months',
]);
