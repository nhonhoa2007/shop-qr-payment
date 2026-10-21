/**
 * Grounding Validator & Deterministic Fallback Engine
 *
 * Enforces strict citation validation, numeric claim verification against live evidence,
 * prompt injection defense, unauthorized URL blocking, and synthetic disclosure.
 */

import type {
  EvidenceBundle,
  GroundingResult,
  AssistantClaim,
  EvidenceCitation,
  AssistantAnswerDto,
} from '@shared/types/assistant';
import { isGreetingQuery } from './evidence.service';

const PROMPT_INJECTION_PATTERNS = [
  /system\s+override/i,
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
  /you\s+are\s+now\s+(an?\s+)?unrestricted/i,
];

function sanitizeString(str: string): string {
  return str.trim();
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>)]+/gi;
  return text.match(urlRegex) || [];
}

export function validateAssistantAnswer(
  raw: unknown,
  bundle: EvidenceBundle
): GroundingResult {
  const violations: string[] = [];
  const groundedClaims: AssistantClaim[] = [];
  const validatedCitations: EvidenceCitation[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      violations: ['INVALID_RESPONSE_FORMAT'],
      groundedClaims: [],
      validatedCitations: [],
      fallbackNeeded: true,
      fallbackReason: 'INVALID_RESPONSE_FORMAT',
    };
  }

  const rawObj = raw as Record<string, unknown>;
  const answerText = typeof rawObj.answer === 'string' ? rawObj.answer : '';

  // 1. Prompt Injection Defense
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(answerText)) {
      violations.push('PROMPT_INJECTION_DETECTED');
      break;
    }
  }

  // 2. URL Allowlist Check
  const allowlistedUrls = new Set(
    Object.values(bundle.citations)
      .map((c) => c.sourceUrl)
      .filter((url): url is string => Boolean(url))
  );

  const foundUrls = extractUrls(answerText);
  for (const url of foundUrls) {
    if (!allowlistedUrls.has(url)) {
      violations.push(`UNAUTHORIZED_URL: ${url}`);
    }
  }

  // 3. Citations Validation
  const rawCitations = Array.isArray(rawObj.citations) ? rawObj.citations : [];
  const revokedSet = new Set(bundle.revokedSourceIds);

  for (const citId of rawCitations) {
    if (typeof citId !== 'string') continue;

    if (revokedSet.has(citId)) {
      violations.push(`REVOKED_CITATION: ${citId}`);
      continue;
    }

    const citation = bundle.citations[citId];
    if (!citation) {
      violations.push(`UNKNOWN_CITATION: ${citId}`);
      continue;
    }

    if (citation.sourceId && revokedSet.has(citation.sourceId)) {
      violations.push(`REVOKED_CITATION: ${citId} (source: ${citation.sourceId})`);
      continue;
    }

    validatedCitations.push(citation);
  }

  // 4. Claims & Numeric Verification
  const rawClaims = Array.isArray(rawObj.claims) ? rawObj.claims : [];
  const productMap = new Map<string, typeof bundle.products[0]>();

  for (const prod of bundle.products) {
    productMap.set(prod.productId, prod);
    productMap.set(prod.productName.toLowerCase(), prod);
    if (prod.sku) productMap.set(prod.sku, prod);
    if (prod.variantId) productMap.set(prod.variantId, prod);
  }

  for (const claim of rawClaims) {
    if (!claim || typeof claim !== 'object') continue;
    const c = claim as AssistantClaim;

    const prod =
      productMap.get(c.subjectProduct) ||
      productMap.get(c.subjectProduct.toLowerCase());

    if (!prod) {
      violations.push(`UNKNOWN_PRODUCT_IN_CLAIM: ${c.subjectProduct}`);
      continue;
    }

    let claimMatches = false;
    let groundedVal: string | number | undefined = undefined;

    if (c.type === 'PRICE') {
      groundedVal = prod.livePriceVnd;
      const claimedStr = String(c.claimedValue).replace(/\D/g, '');
      const expectedStr = String(prod.livePriceVnd).replace(/\D/g, '');
      claimMatches = claimedStr === expectedStr;
      if (!claimMatches) {
        violations.push(
          `PRICE_MISMATCH: claimed ${c.claimedValue}, expected ${prod.livePriceVnd}`
        );
      }
    } else if (c.type === 'STOCK') {
      groundedVal = prod.liveStock;
      claimMatches = Number(c.claimedValue) === Number(prod.liveStock);
      if (!claimMatches) {
        violations.push(
          `STOCK_MISMATCH: claimed ${c.claimedValue}, expected ${prod.liveStock}`
        );
      }
    } else if (c.type === 'NUMERIC_SPEC') {
      const spec = prod.specs[c.field];
      groundedVal = spec?.value !== null && spec?.value !== undefined ? String(spec.value) : undefined;
      claimMatches =
        spec !== undefined &&
        String(spec.value).toLowerCase() === String(c.claimedValue).toLowerCase();
      if (!claimMatches) {
        violations.push(
          `SPEC_MISMATCH: ${c.field} claimed ${c.claimedValue}, expected ${spec?.value}`
        );
      }
    } else if (c.type === 'SCORE') {
      groundedVal = prod.scoreSnapshot?.finalScore;
      claimMatches =
        prod.scoreSnapshot !== undefined &&
        prod.scoreSnapshot !== null &&
        Number(c.claimedValue) === Number(prod.scoreSnapshot.finalScore);
      if (!claimMatches) {
        violations.push(
          `SCORE_MISMATCH: claimed ${c.claimedValue}, expected ${prod.scoreSnapshot?.finalScore}`
        );
      }
    } else if (c.type === 'BENCHMARK') {
      const bm = prod.benchmarks?.find((b) => b.metricName === c.field);
      groundedVal = bm?.value;
      claimMatches = bm !== undefined && Number(c.claimedValue) === Number(bm.value);
      if (!claimMatches) {
        violations.push(
          `BENCHMARK_MISMATCH: ${c.field} claimed ${c.claimedValue}, expected ${bm?.value}`
        );
      }
    } else {
      claimMatches = true;
    }

    if (claimMatches) {
      groundedClaims.push({
        ...c,
        groundedValue: groundedVal,
        isGrounded: true,
      });
    }
  }

  // 5. Synthetic Disclosure Check
  const hasSynthetic =
    validatedCitations.some((c) => c.isSynthetic) ||
    Object.values(bundle.citations).some((c) => c.isSynthetic);

  let sanitizedAnswer = answerText;
  if (hasSynthetic && !sanitizedAnswer.includes('dữ liệu đo đạc thử nghiệm')) {
    sanitizedAnswer +=
      ' (Lưu ý: Một số chỉ số đo đạc dựa trên dữ liệu đo đạc thử nghiệm/mô phỏng kỹ thuật).';
  }

  if (violations.length > 0) {
    return {
      valid: false,
      violations,
      groundedClaims: [],
      validatedCitations: [],
      fallbackNeeded: true,
      fallbackReason: violations[0],
    };
  }

  return {
    valid: true,
    violations: [],
    groundedClaims,
    validatedCitations,
    sanitizedAnswer,
    fallbackNeeded: false,
  };
}

export function buildDeterministicAnswer(
  bundle: EvidenceBundle,
  reason: string
): AssistantAnswerDto {
  if (isGreetingQuery(bundle.query)) {
    return {
      answer:
        'Chào bạn! Mình là Clawd Chef 🦀👨‍🍳 - trợ lý mua sắm AI của Shop QR.\n\n' +
        'Rất vui được hỗ trợ bạn hôm nay! Mình có thể giúp bạn:\n' +
        '• Tìm kiếm sản phẩm phù hợp với nhu cầu và tầm giá\n' +
        '• Tra cứu cấu hình & thông số kỹ thuật niêm yết chính hãng\n' +
        '• So sánh thông số kỹ thuật và kiểm tra tình trạng còn hàng\n\n' +
        'Hôm nay bạn đang quan tâm đến dòng sản phẩm nào (laptop, điện thoại, phụ kiện...)?',
      followUpQuestion: 'Bạn đang tìm thiết bị phục vụ công việc, học tập hay giải trí?',
      citations: [],
      claims: [],
      isGrounded: true,
      fallbackReason: reason,
    };
  }

  if (bundle.products.length === 0) {
    return {
      answer:
        'Dạ hiện tại Clawd Chef chưa tìm thấy sản phẩm nào khớp với tìm kiếm của bạn trong kho hàng. Bạn có thể thử tìm với từ khóa khác (ví dụ: tên loại sản phẩm, tầm giá hoặc thương hiệu) để mình hỗ trợ nhé!',
      followUpQuestion: 'Bạn có muốn tìm kiếm theo khoảng giá hoặc thương hiệu cụ thể nào không?',
      citations: [],
      claims: [],
      isGrounded: true,
      fallbackReason: reason,
    };
  }

  const summaries = bundle.products.map((p) => {
    const formattedPrice = new Intl.NumberFormat('vi-VN').format(Number(p.livePriceVnd));
    const stockStatus = p.liveStock > 0 ? `còn ${p.liveStock} sản phẩm` : 'tạm hết hàng';
    const ramSpec = p.specs.ram?.value ? `RAM ${p.specs.ram.value}${p.specs.ram.unit || 'GB'}` : '';
    const storageSpec = p.specs.storage?.value
      ? `Bộ nhớ ${p.specs.storage.value}${p.specs.storage.unit || 'GB'}`
      : '';
    const scoreStr = p.scoreSnapshot ? `Điểm đánh giá: ${p.scoreSnapshot.finalScore}/100` : '';

    let reviewStr = '';
    if (p.reviews && p.reviews.length > 0) {
      const avg = (p.reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / p.reviews.length).toFixed(1);
      reviewStr = `Đánh giá ${avg}★ (${p.reviews.length} nhận xét)`;
    }

    const details = [ramSpec, storageSpec, scoreStr, reviewStr].filter(Boolean).join(' • ');
    return `• **${p.productName}** (${p.brand}): Giá **${formattedPrice}₫** (${stockStatus})${details ? `\n  - Chi tiết: ${details}` : ''}`;
  });

  const answer = `Dạ, Clawd Chef xin gửi bạn thông tin sản phẩm từ cửa hàng:\n\n${summaries.join('\n\n')}`;

  const defaultCitations = Object.values(bundle.citations).filter(
    (c) => !bundle.revokedSourceIds.includes(c.id)
  );

  return {
    answer,
    followUpQuestion:
      'Bạn ưu tiên mức giá tiết kiệm hơn, hiệu năng xử lý cao hơn, hay thời lượng pin bền bỉ cho nhu cầu chính của mình?',
    citations: defaultCitations,
    claims: bundle.products.map((p) => ({
      type: 'PRICE',
      claimText: p.livePriceVnd,
      subjectProduct: p.productId,
      field: 'livePriceVnd',
      claimedValue: p.livePriceVnd,
      groundedValue: p.livePriceVnd,
      isGrounded: true,
    })),
    isGrounded: true,
    fallbackReason: reason,
  };
}
