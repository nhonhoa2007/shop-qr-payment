'use client';

import { useRef, type ReactNode } from 'react';
import { Dialog } from '@animate-ui/react/primitives/radix-ui/dialog';
import { Loader2 } from 'lucide-react';
import { canDismissConfirmDialog } from './confirm-dialog-policy';

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
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  secondaryAction?: ConfirmDialogAction;
}

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
  const previousFocusRef = useRef<HTMLElement | null>(null);

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => {
    if (!nextOpen && canDismissConfirmDialog(loading)) onClose();
  }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
      <Dialog.Content
        from="bottom"
        className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none"
        onOpenAutoFocus={(event) => {
          previousFocusRef.current = document.activeElement as HTMLElement | null;
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
        }}
        onEscapeKeyDown={(event) => { if (!canDismissConfirmDialog(loading)) event.preventDefault(); }}
        onInteractOutside={(event) => { if (!canDismissConfirmDialog(loading)) event.preventDefault(); }}
      >
        <Dialog.Title className="text-lg font-semibold text-slate-900">{title}</Dialog.Title>
        <Dialog.Description className={`mt-2 text-sm leading-6 text-slate-600 ${description ? '' : 'sr-only'}`}>
          {description || 'Xác nhận hành động này'}
        </Dialog.Description>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Dialog.Close asChild>
            <button ref={cancelRef} type="button" disabled={loading} className="min-h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-700 disabled:opacity-50">
              {cancelLabel}
            </button>
          </Dialog.Close>
          {secondaryAction && !loading && <button type="button" onClick={() => { onClose(); secondaryAction.onClick(); }} className={secondaryAction.className ?? 'min-h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50'}>{secondaryAction.label}</button>}
          <button type="button" onClick={onConfirm} disabled={loading} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${variant === 'danger' ? 'bg-rose-700 hover:bg-rose-800 focus-visible:outline-rose-700' : 'bg-slate-800 hover:bg-slate-700 focus-visible:outline-slate-700'}`}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
