import type { MoneyVnd } from './money.ts';
import type {
  ProductKind,
  ProductSegment,
  KnowledgeState,
  CatalogImage,
  SpecValue,
  VariantOptionItem,
} from './catalog.ts';
import type { InventoryMode } from './inventory.ts';
import type { PriceRangeDto } from './catalog-query.ts';

export interface MoneySnapshot {
  amount: MoneyVnd;
  formatted: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  kind: ProductKind;
  specSchemaVersion?: number;
}

export interface SpecItemDto {
  code: string;
  label: string;
  state: KnowledgeState;
  value?: string | number | boolean;
  unit?: string | null;
  formatted?: string;
  comparable?: boolean;
  filterable?: boolean;
  isOption?: boolean;
}

export interface ProductSpecsDto {
  schemaVersion: number;
  items: SpecItemDto[];
  byCode: Record<string, SpecItemDto>;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  title: string;
  price: MoneySnapshot;
  stock: number;
  inStock: boolean;
  isActive: boolean;
  color?: string | null;
  size?: string | null;
  optionValues: Record<string, string | number | boolean>;
  optionItems: VariantOptionItem[];
  optionHash: string | null;
  specOverrides?: Record<string, SpecValue> | null;
  images: CatalogImage[];
  warrantyConfig?: unknown;
  serializationRequired: boolean;
}

export type CatalogImageDto = CatalogImage;

export interface EvidenceRef {
  id: string;
  sourceType: string;
  publisher: string;
  url: string;
  licenseDecision?: string;
  version?: string;
  isSynthetic?: boolean;
  checksum?: string;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  image: string | null;
  brand: BrandDto | null;
  category: CategoryDto;
  kind: ProductKind;
  segment: ProductSegment | null;
  specs: ProductSpecsDto | null;
  variants: ProductVariantDto[];
  images: CatalogImage[];
  sources: EvidenceRef[];
  price: MoneySnapshot;
  effectivePrice: MoneySnapshot;
  priceRange: PriceRangeDto;
  totalStock: number;
  inStock: boolean;
  inventoryMode: InventoryMode;
  legacy: boolean;
  catalogVersion: number;
  createdAt: string;
  updatedAt: string;
  avgRating?: number;
  reviewCount?: number;
}

export interface ComparisonSpecValue {
  productId: string;
  productName: string;
  state: KnowledgeState;
  value?: string | number | boolean;
  formatted: string;
}

export interface ComparisonSpecRow {
  code: string;
  label: string;
  unit?: string | null;
  comparable: boolean;
  values: ComparisonSpecValue[];
  hasDifference: boolean;
}

export interface ProductComparisonMatrixDto {
  products: Array<{
    id: string;
    name: string;
    image: string | null;
    brandName?: string | null;
    effectivePrice: MoneySnapshot;
    inStock: boolean;
  }>;
  specRows: ComparisonSpecRow[];
  compatibleCategory: boolean;
}
