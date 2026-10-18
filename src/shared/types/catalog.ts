/**
 * Catalog Domain Types & Strict JSON Contracts (M1 Electronics Catalog)
 */

export type ProductKind = 'LAPTOP' | 'PHONE' | 'ACCESSORY' | 'LEGACY';

export type ProductSegment = 'BUDGET' | 'MID_RANGE' | 'PREMIUM' | 'FLAGSHIP';

export type KnowledgeState = 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';

export type SourceStatus =
  | 'DISCOVERED'
  | 'LICENSE_REVIEW'
  | 'MAPPING_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'REVOKED';

export type DataSourceType =
  | 'CATALOG'
  | 'REVIEW_AGGREGATE'
  | 'BENCHMARK'
  | 'COMPATIBILITY'
  | 'MANUFACTURER';


export type SpecValueType = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'ENUM';

export interface VersionedJson<T> {
  schemaVersion: number;
  value: T;
}

export interface SpecDefinition {
  code: string;
  label: string;
  valueType: SpecValueType;
  unit?: string | null;
  required?: boolean;
  filterable?: boolean;
  comparable?: boolean;
  allowUnsupported?: boolean;
  enumValues?: string[];
  sortOrder?: number;
  isOption?: boolean;
}

export interface CategorySpecSchema {
  schemaVersion: number;
  definitions: SpecDefinition[];
  variantOptions?: SpecDefinition[];
}

export type SpecValue =
  | { state: 'KNOWN'; value: string | number | boolean; unit?: string | null }
  | { state: 'UNKNOWN'; value?: never; unit?: never }
  | { state: 'UNSUPPORTED'; value?: never; unit?: never };

export interface ProductSpecs {
  schemaVersion: number;
  values: Record<string, SpecValue>;
}

export interface VariantOptionItem {
  code: string;
  value: string | number | boolean;
  unit?: string | null;
}

export interface VariantOptions {
  options: VariantOptionItem[];
  values: Record<string, string | number | boolean>;
  optionHash: string;
}

export interface CatalogImage {
  url: string;
  alt: string;
  sortOrder: number;
  sourceId?: string | null;
}
