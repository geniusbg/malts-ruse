'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
  persistent?: boolean; // If true, toast won't auto-close
  locale?: string; // For close button text
}

export default function Toast({ message, type = 'success', onClose, duration = 4000, persistent = false, locale = 'bg' }: ToastProps) {
  useEffect(() => {
    if (!persistent) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration, persistent]);

  /* Opaque surfaces — floating toast must read clearly over any page bg (theme-alert-* tints are too transparent). */
  const colors = {
    success:
      'border border-[rgba(22,101,52,0.38)] bg-[#cde8d8] text-[#05210f] shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
    error:
      'border border-[rgba(153,27,27,0.42)] bg-[#f0d9d9] text-[#3b0a0a] shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
    info:
      'border border-[var(--theme-hairline)] bg-[var(--theme-card)] text-[var(--theme-ink)] shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  return (
    <div className="fixed top-24 right-8 z-[100] animate-slide-in max-md:left-4 max-md:right-4 max-md:top-20">
      <div className={`${colors[type]} rounded-2xl p-6 min-w-[min(100%,300px)] max-w-md`}>
        <div className="flex items-center gap-4">
          <div className="shrink-0 text-4xl font-bold leading-none opacity-90">
            {icons[type]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold whitespace-pre-line leading-relaxed">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 font-semibold transition-colors ${
              persistent
                ? 'rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-paper)] px-4 py-2 text-base text-[var(--theme-ink)] shadow-sm hover:bg-[var(--theme-card-hover)]'
                : 'text-3xl leading-none text-[var(--theme-ink)] hover:opacity-75'
            }`}
          >
            {persistent 
              ? (locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Schließen')
              : '×'}
          </button>
        </div>
        
        {/* Progress bar - only show if not persistent */}
        {!persistent && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--theme-ink)]/12">
            <div
              className="h-full animate-progress bg-[var(--theme-ink)]/35"
              style={{ animationDuration: `${duration}ms` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

