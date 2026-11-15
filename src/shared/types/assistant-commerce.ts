export interface AssistantProductRef {
  productId: string;
  variantId?: string;
}

export interface AssistantSearchQuery {
  kind?: 'LAPTOP' | 'PHONE' | 'ACCESSORY';
  categoryTerm?: string;
  brand?: string;
  terms: string[];
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  specs: Record<string, string>;
  sort?: 'price-asc' | 'price-desc';
}

export interface AssistantSpecCell {
  code: string;
  label: string;
  state: 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';
  value?: string | number | boolean;
  unit?: string;
  formatted: string;
}

export interface AssistantProductCard extends AssistantProductRef {
  name: string;
  variantName?: string;
  image: string | null;
  brand: string | null;
  categoryId: string | null;
  categoryName: string;
  href: string;
  price: { min: string; max: string };
  stock: number;
  specs: AssistantSpecCell[];
  warranty: string;
  isDemo?: boolean;
}

export interface AssistantComparison {
  products: [AssistantProductCard, AssistantProductCard];
  rows: Array<{ code: string; label: string; values: [string, string] }>;
  summary: string[];
}

export interface AssistantCommerce {
  kind: 'search' | 'clarification' | 'comparison';
  products: AssistantProductCard[];
  total: number;
  query?: AssistantSearchQuery;
  comparison?: AssistantComparison;
  notice?: string;
  refreshed?: boolean;
  truncated?: boolean;
}

/** Server-owned metadata embedded in an existing citation JSON entry. */
export interface AssistantCommerceRef {
  version: 1;
  kind: AssistantCommerce['kind'];
  position: number;
  productId: string;
  variantId?: string;
  query?: AssistantSearchQuery;
}
