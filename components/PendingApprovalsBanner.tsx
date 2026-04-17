'use client';

import { useEffect, useState } from 'react';
import { getPusherClient } from '@/lib/pusher-client';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

interface PendingApprovalsBannerProps {
  locale?: string;
  onApprovalClick?: (approval: any) => void;
  showButtons?: boolean;
  className?: string;
}

export default function PendingApprovalsBanner({ 
  locale = 'bg', 
  onApprovalClick,
  showButtons = true,
  className = ''
}: PendingApprovalsBannerProps) {
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPendingApprovals = async () => {
    try {
      const response = await fetch('/api/orders/pending-approval');
      if (response.ok) {
        const data = await response.json();
        // Filter only pending approvals (not approved/rejected)
        const pending = (data.approvals || []).filter((a: any) => a.status === 'pending');
        setPendingApprovals(pending);
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();

    // Setup Pusher for real-time updates
    const pusher = getPusherClient();
    const adminChannel = pusher.subscribe('admin-channel');

    adminChannel.bind('order-approval-needed', () => {
      loadPendingApprovals();
    });

    adminChannel.bind('order-approval-status', () => {
      loadPendingApprovals();
    });

    // Listen for auto-rejections
    adminChannel.bind('auto-rejections', () => {
      loadPendingApprovals();
    });

    return () => {
      adminChannel.unbind_all();
      pusher.unsubscribe('admin-channel');
    };
  }, []);

  if (loading || pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className={`px-4 md:px-8 pt-2 pb-2 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <MaltsInlineFeedback tone="warning" className="rounded-xl p-4 md:p-6" role="status">
          <div className="flex items-start gap-4">
            <div className="text-2xl md:text-3xl">⚠️</div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-bold text-[var(--malts-ink)] mb-2">
                {locale === 'bg' 
                  ? `Поръчки изискващи одобрение (${pendingApprovals.length})`
                  : locale === 'en'
                  ? `Orders requiring approval (${pendingApprovals.length})`
                  : `Bestellungen erfordern Genehmigung (${pendingApprovals.length})`}
              </h3>
              <p className="text-sm md:text-base text-[var(--malts-ink)] mb-3">
                {locale === 'bg'
                  ? `Има ${pendingApprovals.length} ${pendingApprovals.length === 1 ? 'поръчка' : 'поръчки'} изискващи одобрение.`
                  : locale === 'en'
                  ? `There ${pendingApprovals.length === 1 ? 'is' : 'are'} ${pendingApprovals.length} order${pendingApprovals.length === 1 ? '' : 's'} requiring approval.`
                  : `Es ${pendingApprovals.length === 1 ? 'gibt' : 'gibt'} ${pendingApprovals.length} Bestellung${pendingApprovals.length === 1 ? '' : 'en'}, die eine Genehmigung erfordern.`}
              </p>
              {showButtons && onApprovalClick && (
                <div className="flex gap-2 flex-wrap">
                  {pendingApprovals.map((approval: any) => (
                    <button
                      key={approval.id}
                      onClick={() => onApprovalClick(approval)}
                      className="px-3 md:px-4 py-2 malts-btn-secondary font-semibold rounded-lg transition-colors text-sm md:text-base"
                    >
                      {locale === 'bg'
                        ? `Прегледай поръчка #${approval.order?.orderNumber || approval.orderId.substring(0, 8)}`
                        : locale === 'en'
                        ? `Review order #${approval.order?.orderNumber || approval.orderId.substring(0, 8)}`
                        : `Bestellung #${approval.order?.orderNumber || approval.orderId.substring(0, 8)} ansehen`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </MaltsInlineFeedback>
      </div>
    </div>
  );
}

