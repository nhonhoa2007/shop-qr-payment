'use client';

import { useState, useEffect } from 'react';
import { X, Scale, AlertCircle, HelpCircle } from 'lucide-react';
import { formatVND } from '@shared/utils';
import type { ComparisonDto, ComparisonProductDetail } from '@shared/types/comparison';

interface ProductComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  productIds: string[];
  useCase?: string;
}

export function ProductComparisonModal({
  isOpen,
  onClose,
  productIds,
  useCase = 'office_study',
}: ProductComparisonModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonDto | null>(null);

  useEffect(() => {
    if (!isOpen || productIds.length < 2) return;

    let ignore = false;
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/products/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: productIds.map((id) => ({ productId: id })),
            useCase,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Không thể tải thông tin so sánh');
        }
        if (!ignore) {
          setData(json.comparison);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchComparison();
    return () => {
      ignore = true;
    };
  }, [isOpen, productIds, useCase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                So sánh minh bạch thông số & bằng chứng
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {data ? `Danh mục: ${data.categoryName} • Use-case: ${data.useCase}` : 'Đang xử lý dữ liệu...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm text-zinc-500">Đang đối chiếu thông số canonical và điểm số thực tế...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Product cards side-by-side */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {data.items.map((item: ComparisonProductDetail) => (
                  <div
                    key={item.productId}
                    className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {item.brandName}
                    </span>
                    <h3 className="mt-1 line-clamp-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.productName}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base font-bold text-red-600 dark:text-red-400">
                        {formatVND(BigInt(item.priceVnd))}
                      </span>
                      {item.scoreSnapshot?.isGoodValue && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          P/P Tốt
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Trade-off summary bullets without unsolicited winner */}
              {data.tradeOffSummary && data.tradeOffSummary.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    Điểm đánh đổi khách quan (Trade-offs)
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                    {data.tradeOffSummary.map((tradeOff: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>{tradeOff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Full Attribute Comparison Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      <th className="w-1/3 px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                        Thuộc tính / Bằng chứng
                      </th>
                      {data.items.map((item: ComparisonProductDetail) => (
                        <th key={item.productId} className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.productName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.attributes.map((attr) => (
                      <tr key={attr.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                          {attr.label}
                        </td>
                        {data.items.map((item: ComparisonProductDetail) => {
                          const val = attr.values[item.productId];
                          if (val && typeof val === 'object' && 'status' in val) {
                            if (val.status === 'UNSUPPORTED') {
                              return (
                                <td key={item.productId} className="px-4 py-2.5 text-zinc-400">
                                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                                    Không hỗ trợ
                                  </span>
                                </td>
                              );
                            }
                            if (val.status === 'UNKNOWN') {
                              return (
                                <td key={item.productId} className="px-4 py-2.5 text-zinc-400">
                                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-400 dark:bg-zinc-800">
                                    <HelpCircle className="h-3 w-3" /> Chưa có số liệu
                                  </span>
                                </td>
                              );
                            }
                            return (
                              <td key={item.productId} className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                                {String(val.canonicalValue)} {val.unit || ''}
                              </td>
                            );
                          }

                          return (
                            <td key={item.productId} className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                              {val !== null && val !== undefined ? `${val} ${attr.unit || ''}` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
