'use client';

import { useState } from 'react';

const PAPER_BTN =
  'text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50 shrink-0';
const DARK_BTN =
  'text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-card-hover)] disabled:opacity-50 shrink-0';

type Props = {
  sourceText: string;
  targetLang: 'en' | 'ro';
  onTranslated: (text: string) => void;
  onError?: (message: string) => void;
  /** 'paper' = admin malts theme; 'dark' = gray modal / menu settings */
  variant?: 'paper' | 'dark';
  className?: string;
  disabled?: boolean;
};

export const TRANSLATION_EMPTY_BG = 'Моля, въведете текст на български, за да използвате автоматичен превод.';
export const TRANSLATION_FAILED = 'Неуспешен превод. Моля, опитайте отново.';

export default function AutoTranslateButton({
  sourceText,
  targetLang,
  onTranslated,
  onError,
  variant = 'paper',
  className = '',
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const src = sourceText?.trim() || '';
    if (!src) {
      onError?.(TRANSLATION_EMPTY_BG);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, targetLang }),
      });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      if (data?.text) {
        onTranslated(data.text);
      } else {
        onError?.('Неуспешно получаване на превода. Опитайте отново.');
      }
    } catch {
      onError?.(TRANSLATION_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const base = variant === 'dark' ? DARK_BTN : PAPER_BTN;

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || loading}
      className={`${base} ${className}`}
    >
      {loading ? 'Превеждам...' : 'Авто превод'}
    </button>
  );
}
