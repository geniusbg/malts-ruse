'use client';

import type { ReactNode } from 'react';
import { useLockScroll } from '@/lib/use-lock-scroll';

export type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onCancel: () => void;
  /** Стандартен втори бутон (игнорира се при `alert` или `renderFooter`) */
  onConfirm?: () => void | Promise<void>;
  /** Само един бутон — затваря с `onCancel` след опционален `onConfirm` */
  alert?: boolean;
  /** Пълен контрол върху бутоните под съобщението */
  renderFooter?: (api: { close: () => void }) => ReactNode;
};

export default function ConfirmModal({
  open,
  title = 'Потвърждение',
  message,
  confirmLabel = 'Потвърди',
  cancelLabel = 'Отказ',
  tone = 'default',
  onConfirm,
  onCancel,
  alert = false,
  renderFooter,
}: ConfirmModalProps) {
  useLockScroll(open);

  if (!open) return null;

  const confirmClass = tone === 'danger' ? 'theme-btn-danger' : 'theme-btn-primary';

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto overflow-x-hidden overscroll-contain"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-[var(--theme-paper)]/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="relative z-10 flex min-h-[100dvh] min-h-[100svh] items-center justify-center p-3 py-10 sm:p-4 sm:py-12"
        onClick={onCancel}
      >
        <div
          data-modal-scroll
          className="theme-card w-full max-w-md max-h-[min(88dvh,92svh)] overflow-y-auto overscroll-contain rounded-2xl p-4 shadow-lg touch-pan-y sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-lg font-bold text-[var(--theme-ink)] sm:text-xl">{title}</h3>
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 text-2xl leading-none text-[var(--theme-subtle)] transition-colors hover:text-[var(--theme-ink)]"
              aria-label="Затвори"
            >
              ×
            </button>
          </div>

          {typeof message === 'string' ? (
            <div className="theme-muted mb-4 space-y-3 sm:mb-6">
              {message
                .trim()
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
            </div>
          ) : (
            <div className="theme-muted mb-4 sm:mb-6">{message}</div>
          )}

          {renderFooter ? (
            renderFooter({ close: onCancel })
          ) : alert ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onConfirm?.());
                  onCancel();
                }}
                className={`${confirmClass} theme-btn-admin-compact w-full rounded-lg font-semibold sm:flex-1`}
              >
                {confirmLabel}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="theme-btn-secondary theme-btn-admin-compact w-full rounded-lg font-semibold sm:flex-1"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => void Promise.resolve(onConfirm?.())}
                className={`${confirmClass} theme-btn-admin-compact w-full rounded-lg font-semibold sm:flex-1`}
              >
                {confirmLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
