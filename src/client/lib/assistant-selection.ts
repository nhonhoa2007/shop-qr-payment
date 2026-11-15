import type { AssistantProductRef } from '@shared/types/assistant-commerce';
export interface AssistantSelection extends AssistantProductRef { name: string; categoryId: string | null }
export const assistantRefKey = (ref: AssistantProductRef) => `${ref.productId}:${ref.variantId || ''}`;
export function toggleAssistantSelection(selected: AssistantSelection[], item: AssistantSelection): { selected: AssistantSelection[]; error?: string } {
  if (selected.some(ref => assistantRefKey(ref) === assistantRefKey(item))) return { selected: selected.filter(ref => assistantRefKey(ref) !== assistantRefKey(item)) };
  if (selected.length === 2) return { selected, error: 'Bạn đã chọn 2 sản phẩm. Hãy bỏ một sản phẩm trước khi chọn thêm.' };
  if (!item.categoryId || (selected[0] && selected[0].categoryId !== item.categoryId)) return { selected, error: 'Hãy chọn hai sản phẩm cùng danh mục để so sánh.' };
  return { selected: [...selected, item] };
}
