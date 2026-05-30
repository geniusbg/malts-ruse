'use client';

import type { ReactNode } from 'react';

export type ThemeInlineFeedbackTone = 'success' | 'error' | 'warning';

type Props = {
  tone: ThemeInlineFeedbackTone;
  children: ReactNode;
  className?: string;
  /** По подразбиране: alert за грешки, status за останалото */
  role?: 'status' | 'alert';
};

const toneClass: Record<ThemeInlineFeedbackTone, string> = {
  success: 'theme-alert-success',
  error: 'theme-alert-error',
  warning: 'theme-alert-warning',
};

/**
 * Централизиран стил за кратки inline съобщения (админ, staff, поръчка, форми).
 * Ползва `.theme-alert` от globals — добър контраст на кремав фон.
 */
export function ThemeInlineFeedback({ tone, children, className = '', role }: Props) {
  const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status');
  return (
    <div
      className={`theme-alert ${toneClass[tone]} text-sm font-medium leading-snug ${className}`}
      role={resolvedRole}
    >
      {children}
    </div>
  );
}

/** @deprecated използвай ThemeInlineFeedback */
export const AdminInlineFeedback = ThemeInlineFeedback;

/** @deprecated използвай ThemeInlineFeedback */
export const MaltsInlineFeedback = ThemeInlineFeedback;

/** @deprecated */
export type MaltsInlineFeedbackTone = ThemeInlineFeedbackTone;
