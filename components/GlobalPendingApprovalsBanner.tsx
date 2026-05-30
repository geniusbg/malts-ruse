'use client';

import PendingApprovalsBanner from './PendingApprovalsBanner';
import { usePathname } from 'next/navigation';

interface GlobalPendingApprovalsBannerProps {
  locale?: string;
  onApprovalClick?: (approval: any) => void;
}

export default function GlobalPendingApprovalsBanner({ 
  locale = 'bg',
  onApprovalClick 
}: GlobalPendingApprovalsBannerProps) {
  const pathname = usePathname();
  
  // Only show in admin and staff sections
  if (!pathname?.includes('/admin') && !pathname?.includes('/staff')) {
    return null;
  }

  // Don't show on login pages
  if (pathname?.includes('/login')) {
    return null;
  }

  return (
    <div className="sticky top-20 z-40">
      <PendingApprovalsBanner 
        locale={locale} 
        onApprovalClick={onApprovalClick}
        showButtons={true}
        className="bg-[var(--theme-paper)]/92 backdrop-blur-md border border-[var(--theme-hairline)]"
      />
    </div>
  );
}

