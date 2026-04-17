'use client';

import type { ReactNode } from 'react';

export type MaltsInlineFeedbackTone = 'success' | 'error' | 'warning';

type Props = {
  tone: MaltsInlineFeedbackTone;
  children: ReactNode;
  className?: string;
  /** По подразбиране: alert за грешки, status за останалото */
  role?: 'status' | 'alert';
};

const toneClass: Record<MaltsInlineFeedbackTone, string> = {
  success: 'malts-alert-success',
  error: 'malts-alert-error',
  warning: 'malts-alert-warning',
};

/**
 * Централизиран стил за кратки inline съобщения (админ, staff, поръчка, форми).
 * Ползва `.malts-alert` от globals — добър контраст на кремав фон.
 */
export function MaltsInlineFeedback({ tone, children, className = '', role }: Props) {
  const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status');
  return (
    <div
      className={`malts-alert ${toneClass[tone]} text-sm font-medium leading-snug ${className}`}
      role={resolvedRole}
    >
      {children}
    </div>
  );
}

/** @deprecated използвай MaltsInlineFeedback */
export const AdminInlineFeedback = MaltsInlineFeedback;

export type AdminInlineFeedbackTone = MaltsInlineFeedbackTone;
