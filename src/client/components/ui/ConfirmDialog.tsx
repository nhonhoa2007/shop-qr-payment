'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmDialogAction {
  label: string;
  onClick: () => void;
  className?: string;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = nút xác nhận màu đỏ (hành động phá vỡ) */
  variant?: 'danger' | 'default';
  loading?: boolean;
  /** Hành động phụ thứ hai (thay cho pattern confirm() OK/Cancel 2 lựa chọn) */
  secondaryAction?: ConfirmDialogAction;
}

/**
 * Dialog xác nhận thống nhất của ứng dụng, theo chuẩn a11y của WalletTopupModal:
 * role=dialog, aria-modal, ESC đóng, khoá scroll, click backdrop đóng, focus vào nút an toàn khi mở.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'default',
  loading = false,
  secondaryAction,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus vào nút an toàn (Hủy) để tránh kích hoạt nhầm hành động phá vỡ bằng Enter
    cancelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-ink-black text-white hover:bg-slate-ink';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="fixed inset-0 -z-10" onClick={loading ? undefined : onClose} aria-hidden="true" />
      <div className="bg-white rounded-[28px] shadow-2xl p-6 sm:p-8 w-full max-w-sm text-center">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            variant === 'danger'
              ? 'bg-rose-50 border border-rose-100 text-rose-500'
              : 'bg-slate-50 border border-slate-100 text-slate-500'
          }`}
        >
          <AlertTriangle className="w-7 h-7 stroke-[1.5]" />
        </div>
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-ink-black tracking-[-0.03em] mb-2"
        >
          {title}
        </h2>
        {description && (
          <div className="text-sm text-muted-gray tracking-[-0.014em] mb-6 leading-relaxed">
            {description}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium tracking-[-0.014em] transition text-sm disabled:opacity-50 cursor-pointer ${confirmClasses}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
          {secondaryAction && !loading && (
            <button
              type="button"
              onClick={() => {
                onClose();
                secondaryAction.onClick();
              }}
              className={`w-full px-6 py-3 rounded-full font-medium tracking-[-0.014em] transition text-sm cursor-pointer ${
                secondaryAction.className ??
                'bg-shop-violet text-white hover:bg-shop-violet-deep'
              }`}
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="w-full text-sm text-muted-gray hover:text-ink-black transition py-1.5 tracking-[-0.014em] disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
