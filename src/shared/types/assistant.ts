// ==========================================
// GROUNDED ASSISTANT & EVIDENCE DTO TYPES
// ==========================================

export type CitationType =
  | 'PRODUCT_SPEC'
  | 'BENCHMARK'
  | 'SCORE_SNAPSHOT'
  | 'REVIEW_AGGREGATE'
  | 'LIVE_PRICE_STOCK'
  | 'COMPATIBILITY_RULE';

export interface EvidenceCitation {
  id: string; // e.g. "src_official_apple", "src_benchmark_geekbench"
  type: CitationType;
  title: string;
  sourceId?: string;
  sourceUrl?: string;
  publisher?: string;
  license?: string;
  isSynthetic?: boolean;
}

export interface GroundedProductEvidence {
  productId: string;
  productName: string;
  brand: string;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
  market?: string | null;
  livePriceVnd: string;
  liveStock: number;
  specs: Record<string, { value: string | number | boolean | null; unit?: string | null }>;
  scoreSnapshot?: {
    useCase: string;
    finalScore: number;
    priceEfficiencyScore: number;
    confidence: number;
    version: number;
  } | null;
  benchmarks?: Array<{
    metricName: string;
    value: number;
    unit: string;
    sourceId: string;
  }>;
  reviewAggregate?: {
    aspects: Array<{ aspect: string; score: number }>;
    sampleSize: number;
    averageRating: number;
  } | null;
  reviews?: Array<{ rating: number; comment?: string | null }>;
  evidenceIds: string[];
}

export interface EvidenceBundle {
  bundleId: string;
  generatedAt: string;
  query: string;
  products: GroundedProductEvidence[];
  citations: Record<string, EvidenceCitation>;
  activeSourceIds: string[];
  revokedSourceIds: string[];
  systemInstructions: string;
}

export interface EvidenceBundleInput {
  query: string;
  productIds?: string[];
  variantIds?: string[];
  categoryId?: string;
  market?: string;
}

export type ClaimType =
  | 'NUMERIC_SPEC'
  | 'PRICE'
  | 'STOCK'
  | 'SCORE'
  | 'BENCHMARK'
  | 'GENERAL';

export interface AssistantClaim {
  type: ClaimType;
  claimText: string;
  subjectProduct: string; // productId or productName
  field: string;
  claimedValue: string | number;
  groundedValue?: string | number;
  isGrounded: boolean;
  citationId?: string;
}

export interface AssistantAnswerDto {
  conversationId?: string;
  messageId?: string;
  answer: string;
  followUpQuestion?: string; // Mặc định so sánh tổng quan trước, sau đó hỏi đúng 1 câu về nhu cầu chính
  citations: EvidenceCitation[];
  claims: AssistantClaim[];
  isGrounded: boolean;
  fallbackReason?: string;
  syntheticDisclosure?: string;
}

export interface GroundingResult {
  valid: boolean;
  violations: string[];
  groundedClaims: AssistantClaim[];
  validatedCitations: EvidenceCitation[];
  sanitizedAnswer?: string;
  fallbackNeeded: boolean;
  fallbackReason?: string;
}

export interface ConversationDto {
  id: string;
  userId?: string | null;
  anonymousTokenHash?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  messagesCount: number;
}

export interface AssistantMessageDto {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  followUpQuestion?: string | null;
  citations: EvidenceCitation[];
  claims: AssistantClaim[];
  usage?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  } | null;
  isGrounded: boolean;
  fallbackReason?: string | null;
  createdAt: string;
}

export interface Principal {
  userId?: string | null;
  role?: string;
  anonymousTokenHash?: string | null;
  ip: string;
}

export interface CreateConversationInput {
  title?: string;
}

export interface AppendMessageInput {
  conversationId: string;
  content: string;
  role?: 'USER' | 'ASSISTANT';
}

export interface AnswerInput {
  conversationId: string;
  content: string;
  productIds?: string[];
  variantIds?: string[];
  market?: string;
}
