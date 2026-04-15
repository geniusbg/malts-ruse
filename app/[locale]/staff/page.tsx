'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { getPusherClient } from '@/lib/pusher-client';
import { playSound } from '@/lib/sound';
import Toast from '@/components/Toast';
import Price from '@/components/Price';
import ServiceWorkerUpdater from '@/components/ServiceWorkerUpdater';
import PendingApprovalsBanner from '@/components/PendingApprovalsBanner';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';
import { useLockScroll } from '@/lib/use-lock-scroll';
import { 
  isPushSupported, 
  isSubscribed, 
  subscribeToPush,
  getPushSupportDetails
} from '@/lib/push-notifications';
import { formatBulgarianDateTime, formatBulgarianTime } from '@/lib/date-utils';

export default function StaffDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [ordersTab, setOrdersTab] = useState<'active' | 'completed'>('active');
  const [callsTab, setCallsTab] = useState<'active' | 'completed'>('active');
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    approvalOrderThreshold: 5,
    approvalTimeWindowMinutes: 5,
    autoRejectMinutes: 30
  });
  const approvalWindowMinutes = securitySettings?.approvalTimeWindowMinutes ?? 5;
  
  // Loading state
  const [initialLoading, setInitialLoading] = useState(true);
  
  // PWA & Push states
  const [isPWA, setIsPWA] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Ref to prevent multiple simultaneous refreshes
  const isRefreshingRef = useRef(false);

  // ONE-TIME SETUP: PWA, Push, Service Worker (separate useEffect to prevent re-registration)
  useEffect(() => {
    // Check if running as PWA
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
    };
    checkPWA();

    // Check push subscription status and auto-subscribe if permission already granted
    const checkPush = async () => {
      try {
        // First, ensure Service Worker is ready (critical for Android)
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker is ready');
          } catch (swError) {
            console.warn('⚠️ Service Worker not ready yet:', swError);
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker ready after retry');
          }
        }
        
        const subscribed = await isSubscribed();
        console.log('📊 Push subscription status:', subscribed ? 'Subscribed' : 'Not subscribed');
        setPushEnabled(subscribed);
        
        // If not subscribed but push is supported, try to auto-subscribe
        // (only if permission was already granted previously)
        if (!subscribed && isPushSupported()) {
          // Check if permission was previously granted
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              console.log('🔔 Permission already granted, auto-subscribing to push...');
              console.log('📱 Device:', navigator.userAgent.includes('Android') ? 'Android' : 'Other');
              
              // Double-check Service Worker is ready before subscribing (especially important for Android)
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                console.log('✅ Service Worker registration ready:', registration.scope);
              }
              
              await subscribeToPush();
              setPushEnabled(true);
              console.log('✅✅✅ Auto-subscribed to push notifications successfully!');
            } catch (error: any) {
              console.error('❌ Auto-subscribe failed:', error);
              console.error('Error details:', error.message, error.stack);
              // Don't show error to user - they can manually subscribe if needed
              // But log it for debugging
            }
          } else {
            console.log('ℹ️ Permission not granted yet:', Notification.permission);
          }
        } else if (!isPushSupported()) {
          console.log('ℹ️ Push notifications not supported on this device');
        }
      } catch (error: any) {
        console.error('❌ Check push error:', error);
        console.error('Error details:', error.message);
      }
    };
    
    // Delay checkPush slightly to ensure page is fully loaded (helps on Android)
    setTimeout(() => {
      checkPush();
    }, 500);


    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPWAPrompt(true);
      console.log('📱 PWA install prompt ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []); // Empty deps - run ONCE on mount

  useEffect(() => {
    let isMounted = true;
    fetch('/api/security-settings')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data?.settings) {
          setSecuritySettings({
            approvalOrderThreshold: data.settings.approvalOrderThreshold ?? 5,
            approvalTimeWindowMinutes: data.settings.approvalTimeWindowMinutes ?? 5,
            autoRejectMinutes: data.settings.autoRejectMinutes ?? 30
          });
        }
      })
      .catch(() => {
        // fallback to defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // DATA & PUSHER SETUP (separate useEffect for data loading and real-time)
  useEffect(() => {

    // Load initial data
    async function loadData() {
      try {
        const [allOrdersRes, callsRes, approvalsRes] = await Promise.all([
          fetch('/api/orders/all'),
          fetch('/api/waiter-call/all'),
          fetch('/api/orders/pending-approval').catch(() => ({ ok: false } as Response)) // Don't fail if endpoint doesn't exist
        ]);

        const ordersData = await allOrdersRes.json();
        const callsData = await callsRes.json();

        setOrders(ordersData.orders || []);
        setWaiterCalls(callsData.calls || []);

        // Load pending approvals if endpoint exists
        if (approvalsRes && approvalsRes.ok && approvalsRes instanceof Response) {
          const approvalsData = await approvalsRes.json();
          setPendingApprovals(approvalsData.approvals || []);
        }
        
        // Show loading for 2 seconds
        setTimeout(() => {
          setInitialLoading(false);
        }, 2000);
      } catch (error) {
        console.error('Load data error:', error);
        setInitialLoading(false);
      }
    }
    loadData();

    // Setup Pusher real-time
    const pusher = getPusherClient();
    const channel = pusher.subscribe('staff-channel');

    // New order notification
    channel.bind('new-order', (data: any) => {
      console.log('🔔 New order received:', data);

      // Play sound (MP3 or generated beep)
      playSound('order');

      // Add to notifications queue
      setNotifications(prev => [...prev, {
        id: `order-${data.orderId}-${Date.now()}`,
        type: 'order',
        title: `НОВА ПОРЪЧКА #${data.orderNumber}`,
        message: `Маса ${data.tableNumber}`,
        data,
        urgent: false
      }]);

      // Add new order to state instead of reloading
      setOrders(prev => [data, ...prev]);
    });

    // Waiter call notification
    channel.bind('waiter-call', (data: any) => {
      console.log('🔔 Waiter called:', data);

      // Play urgent sound (MP3 or generated alert)
      playSound('urgent');

      // Add to notifications queue
      setNotifications(prev => [...prev, {
        id: `call-${data.callId}-${Date.now()}`,
        type: 'call',
        title: `🚨 МАСА ${data.tableNumber}`,
        message: data.callType === 'payment_cash' ? 'Плащане с брой' : 
                 data.callType === 'payment_card' ? 'Плащане с карта' : 'Нужна помощ',
        data,
        urgent: true
      }]);

      // Add new call to state
      const newCall = {
        id: data.callId,
        tableNumber: data.tableNumber,
        callType: data.callType,
        message: data.message,
        status: 'pending',
        createdAt: data.timestamp
      };
      setWaiterCalls(prev => [newCall, ...prev]);
    });

    // Order status change notification
    channel.bind('order-status-change', (data: any) => {
      console.log('🔄 Order status changed:', data);
      
      // Update order in state
      setOrders(prev => prev.map(order => 
        order.id === data.orderId 
          ? { ...order, status: data.status }
          : order
      ));
    });

    // Waiter call status change notification
    channel.bind('call-status-change', (data: any) => {
      // Update call in state (silently, don't show toast - it's from another device)
      setWaiterCalls(prev => prev.map(call => 
        call.id === data.callId 
          ? { ...call, status: data.status }
          : call
      ));
    });

    // Order approval needed notification (listen to admin channel for approvals)
    const adminChannel = pusher.subscribe('admin-channel');
    adminChannel.bind('order-approval-needed', (data: any) => {
      console.log('⚠️ Order approval needed:', data);
      // Reload pending approvals
      fetch('/api/orders/pending-approval')
        .then(res => res.ok ? res.json() : { approvals: [] })
        .then(data => setPendingApprovals(data.approvals || []))
        .catch(() => {});
    });

    // Order approval status change
    adminChannel.bind('order-approval-status', (data: any) => {
      // Reload pending approvals when status changes
      fetch('/api/orders/pending-approval')
        .then(res => res.ok ? res.json() : { approvals: [] })
        .then(data => setPendingApprovals(data.approvals || []))
        .catch(() => {});
    });

    // Smart refresh on visibility change (for iOS when returning from background)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        
        try {
          const [ordersRes, callsRes, approvalsRes] = await Promise.all([
            fetch('/api/orders/all'),
            fetch('/api/waiter-call/all'),
            fetch('/api/orders/pending-approval').catch(() => ({ ok: false } as Response))
          ]);

          const ordersData = await ordersRes.json();
          const callsData = await callsRes.json();

          // Just update data, let Pusher handle new notifications
          setOrders(ordersData.orders || []);
          setWaiterCalls(callsData.calls || []);

          // Update pending approvals if endpoint exists
          if (approvalsRes && approvalsRes.ok && approvalsRes instanceof Response) {
            const approvalsData = await approvalsRes.json();
            setPendingApprovals(approvalsData.approvals || []);
          }
          
          console.log('✅ Data refreshed');
        } catch (error) {
          console.error('Refresh error:', error);
        } finally {
          // Reset flag after 2 seconds to prevent rapid re-triggers
          setTimeout(() => {
            isRefreshingRef.current = false;
          }, 2000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      channel.unbind_all();
      adminChannel.unbind_all();
      pusher.unsubscribe('staff-channel');
      pusher.unsubscribe('admin-channel');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty deps - setup once, use refs for state access

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const updateOrderStatus = async (orderId: string, status: string, cancellationReason?: string) => {
    setLoadingActions(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellationReason })
      });

      if (response.ok) {
        setOrders(prev =>
          prev.map(order =>
            order.id === orderId 
              ? { 
                  ...order, 
                  status,
                  cancellationReason: cancellationReason || null,
                  completedAt: status === 'completed' ? new Date().toISOString() : order.completedAt
                } 
              : order
          )
        );
        
        const statusMessages: Record<string, string> = {
          'preparing': 'Поръчка започната',
          'ready': 'Поръчка готова',
          'completed': 'Поръчка завършена',
          'cancelled': 'Поръчка отказана'
        };
        
        setToast({ 
          message: statusMessages[status] || 'Статус обновен', 
          type: 'success' 
        });
      } else {
        setToast({ message: 'Грешка при обновяване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCancelOrder = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = () => {
    if (cancelOrderId) {
      updateOrderStatus(cancelOrderId, 'cancelled', cancelReason || undefined);
      setShowCancelModal(false);
      setCancelOrderId(null);
      setCancelReason('');
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/approve`, {
        method: 'POST'
      });

      if (response.ok) {
        // Build message with items
        let message = '✅ Поръчката е одобрена успешно';
        if (selectedApproval?.order?.items && selectedApproval.order.items.length > 0) {
          const itemsList = selectedApproval.order.items.map((item: any) => 
            `${item.quantity}x ${item.productName}`
          ).join('\n');
          message = `✅ Поръчката е одобрена успешно!\n\n${itemsList}`;
        }
        setToast({ message, type: 'success' });
        setShowApprovalModal(false);
        setSelectedApproval(null);
        // Reload pending approvals
        const approvalsRes = await fetch('/api/orders/pending-approval');
        if (approvalsRes.ok) {
          const approvalsData = await approvalsRes.json();
          setPendingApprovals(approvalsData.approvals || []);
        }
        // Reload orders
        const ordersRes = await fetch('/api/orders/all');
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        }
      } else {
        const data = await response.json();
        setToast({ message: data.error || 'Грешка при одобрение', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleRejectOrder = async (orderId: string, reason?: string) => {
    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        setToast({ message: '❌ Поръчката е отхвърлена', type: 'success' });
        setShowApprovalModal(false);
        setSelectedApproval(null);
        // Reload pending approvals
        const approvalsRes = await fetch('/api/orders/pending-approval');
        if (approvalsRes.ok) {
          const approvalsData = await approvalsRes.json();
          setPendingApprovals(approvalsData.approvals || []);
        }
      } else {
        const data = await response.json();
        setToast({ message: data.error || 'Грешка при отхвърляне', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setProcessingApproval(false);
    }
  };

  const acknowledgeCall = async (callId: string) => {
    setLoadingActions(prev => ({ ...prev, [callId]: true }));
    
    try {
      const response = await fetch(`/api/waiter-call/${callId}/acknowledge`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setWaiterCalls(prev =>
          prev.map(call =>
            call.id === callId ? { ...call, status: 'acknowledged' } : call
          )
        );
        setToast({ message: 'Потвърдено - отивате', type: 'success' });
      } else {
        setToast({ message: 'Грешка при потвърждаване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setLoadingActions(prev => ({ ...prev, [callId]: false }));
    }
  };

  const completeCall = async (callId: string) => {
    setLoadingActions(prev => ({ ...prev, [`complete_${callId}`]: true }));
    
    try {
      const response = await fetch(`/api/waiter-call/${callId}/complete`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setWaiterCalls(prev =>
          prev.map(call =>
            call.id === callId 
              ? { ...call, status: 'completed', completedAt: new Date().toISOString() } 
              : call
          )
        );
        setToast({ message: 'Повикване завършено', type: 'success' });
      } else {
        setToast({ message: 'Грешка при завършване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`complete_${callId}`]: false }));
    }
  };

  const dismissNotification = (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  // PWA Install handler
  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setToast({ message: 'App инсталиран успешно! 🎉', type: 'success' });
      setShowPWAPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  // Check if device is MIUI (Xiaomi/Redmi)
  const isMIUI = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('miui') || ua.includes('xiaomi') || ua.includes('redmi');
  };

  // Enable Push Notifications
  const handleEnablePush = async () => {
    try {
      // Check support first
      const details = getPushSupportDetails();
      
      if (!details.isSupported) {
        if (details.isIOS && !details.isHTTPS) {
          setToast({ 
            message: '⚠️ iOS изисква HTTPS за Push! Работи на production с https://', 
            type: 'error' 
          });
          return;
        }
        
        setToast({ message: 'Push notifications не се поддържат на това устройство', type: 'error' });
        return;
      }

      await subscribeToPush();
      setPushEnabled(true);
    } catch (error: any) {
      console.error('Enable push error:', error);
      if (isMIUI()) {
        setToast({ 
          message: `Грешка: ${error.message}. За Redmi/Xiaomi провери: Настройки → Приложения → Chrome → Автозапуск и Нотификации`, 
          type: 'error' 
        });
      } else {
        setToast({ message: `Грешка: ${error.message}`, type: 'error' });
      }
    }
  };

  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';

  const { data: session, status } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: false });

    const currentOrigin = window.location.origin;
    const loginUrl = `${currentOrigin}/${locale}/staff/login`;
    window.location.href = loginUrl;
  };

  // Prevent back button after logout
  useEffect(() => {
    const handlePopState = (e: any) => {
      // Don't redirect if offline
      if (typeof window !== 'undefined' && (window as any).__isOffline) {
        return;
      }
      
      // Clear session if user tries to go back after logout
      if (!session) {
        window.history.pushState(null, '', window.location.href);
        window.location.href = `/${locale}/staff/login`;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session, locale]);

  // Redirect to login if not authenticated
  useEffect(() => {
    // Don't redirect if offline - offline banner will handle it
    if (typeof window !== 'undefined' && (window as any).__isOffline) {
      return;
    }
    
    if (status === 'unauthenticated') {
      // Small delay to allow SW offline message to arrive
      const timer = setTimeout(() => {
        // Check again if still not offline (race condition with SW message)
        if (typeof window !== 'undefined' && !(window as any).__isOffline) {
          window.location.href = `/${locale}/staff/login`;
        }
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
  }, [status, locale]);

  useLockScroll(
    showCancelModal || showApprovalModal || notifications.length > 0
  );

  // Show loading screen
  if (status === 'loading' || initialLoading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div className="min-h-screen">
      <ServiceWorkerUpdater />
      <div className="px-4 pt-6 pb-8 md:px-8">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Global Pending Approvals Banner */}
      <PendingApprovalsBanner 
        locale={locale}
        onApprovalClick={(approval) => {
          setSelectedApproval(approval);
          setShowApprovalModal(true);
        }}
        showButtons={true}
        className="mb-6"
      />

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="malts-card w-full max-w-md">
            <div className="p-6 border-b border-[var(--malts-hairline)]">
              <h2 className="text-2xl font-bold">Откажи поръчка</h2>
              <p className="malts-muted text-sm mt-1">Можете да посочите причина (незадължително)</p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium malts-subtle mb-2">
                Причина за отказ (незадължително)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Например: Клиентът отмени поръчката, няма наличност, и т.н."
                className="w-full px-4 py-3 malts-inset rounded-lg placeholder-[var(--malts-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)] resize-none"
                rows={4}
              />
            </div>

            <div className="p-6 border-t border-[var(--malts-hairline)] flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelOrderId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-all"
              >
                Откажи
              </button>
              <button
                onClick={confirmCancelOrder}
                className="px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-all"
              >
                Потвърди отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Popups - Stacked on Mobile, Grid on Desktop */}
      {notifications.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--malts-paper)]/80 backdrop-blur-md p-2 md:p-8">
          <div className={`flex flex-col md:grid gap-2 md:gap-4 w-full max-h-full overflow-y-auto md:overflow-visible ${
            notifications.length === 1 ? 'md:grid-cols-1' :
            notifications.length === 2 ? 'md:grid-cols-2' :
            notifications.length <= 4 ? 'md:grid-cols-2 md:grid-rows-2' :
            notifications.length <= 6 ? 'md:grid-cols-3 md:grid-rows-2' :
            'md:grid-cols-3 md:grid-rows-3'
          } md:h-full md:items-center md:justify-items-center md:content-center`}>
            {notifications.slice(0, 9).map((notif, index) => (
              <div
                key={notif.id}
                className={`animate-bounce-in w-full ${
                  notifications.length === 1 ? 'max-w-3xl' :
                  notifications.length <= 4 ? 'max-w-xl' :
                  'max-w-md'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`relative rounded-xl shadow-2xl border-2 md:border-4 p-4 md:p-8 ${
                  notif.urgent
                    ? 'bg-red-600 border-red-400 animate-pulse'
                    : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border-[var(--malts-hairline)]'
                }`}>
                  {/* Badge showing position in queue */}
                  {notifications.length > 1 && (
                    <div className={`absolute top-2 md:top-3 right-2 md:right-3 px-2 md:px-3 py-1 rounded-full font-bold text-xs md:text-sm ${
                      notif.urgent
                        ? 'bg-[rgba(245,240,230,0.25)] text-[#f5f0e6]'
                        : 'bg-[var(--malts-inset)] text-[var(--malts-ink)] border border-[var(--malts-hairline)]'
                    }`}>
                      {index + 1}/{notifications.length}
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-2xl md:text-4xl">
                        {notif.type === 'order' ? '🔔' : '🚨'}
                      </div>
                      <h3 className={`font-bold leading-tight flex-1 ${
                        notif.urgent ? 'text-[#f5f0e6]' : 'text-[var(--malts-ink)]'
                      } text-base md:text-2xl`}>
                        {notif.title}
                      </h3>
                    </div>
                    <p className={`font-semibold leading-tight ${
                      notif.urgent ? 'text-[#f5f0e6]' : 'text-[var(--malts-ink)]'
                    } text-sm md:text-lg`}>
                      {notif.message}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => dismissNotification(notif.id)}
                      className={`flex-1 rounded-lg font-bold transition-all shadow-lg px-4 py-3 text-base md:text-lg ${
                        notif.urgent 
                          ? 'bg-[rgba(245,240,230,0.92)] text-[var(--malts-danger)] hover:bg-[rgba(245,240,230,1)]' 
                          : 'bg-[var(--malts-accent)] text-[#f5f0e6] hover:bg-[var(--malts-accent-hover)]'
                      }`}
                    >
                      ✓ OK
                    </button>
                    
                    {notifications.length > 1 && index === 0 && (
                      <button
                        onClick={() => setNotifications([])}
                        className={`rounded-lg font-bold transition-all whitespace-nowrap px-3 py-3 text-sm md:text-base ${
                          notif.urgent 
                            ? 'bg-[rgba(245,240,230,0.22)] text-[#f5f0e6] hover:bg-[rgba(245,240,230,0.30)]' 
                            : 'bg-[var(--malts-accent-tint)] text-[var(--malts-ink)] border border-[var(--malts-accent-tint-border)]'
                        }`}
                      >
                        Всички
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 md:mb-8">
        {/* Logo Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
          {/* Left - Logo */}
          <Link
            href={`/${locale}/staff`}
            className="flex h-14 max-h-14 min-w-0 shrink-0 items-center overflow-hidden sm:h-16 sm:max-h-16 md:h-[4.25rem] md:max-h-[4.25rem]"
          >
            <Image
              src="/malts-logo-nav.webp"
              alt="Malt's"
              width={400}
              height={331}
              sizes="(max-width: 768px) 200px, 260px"
              className="malts-brand-filter h-full w-auto max-h-14 min-h-0 min-w-0 shrink-0 object-contain object-left sm:max-h-16 md:max-h-[4.25rem]"
              priority
            />
          </Link>

          {/* Right - Title & PWA Status & User Menu */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-right">
              <h1 className="text-xl md:text-4xl font-bold">Staff Dashboard</h1>
              <p className="malts-muted text-sm">Real-time поръчки и известия</p>
            </div>

            <div className="hidden md:flex gap-3">
              {/* PWA Install Button */}
              {!isPWA && showPWAPrompt && (
              <button
                onClick={handleInstallPWA}
                className="px-6 py-3 malts-btn-secondary rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2"
              >
                📱 Инсталирай App
              </button>
            )}

            {!pushEnabled && isPushSupported() && (
              <button
                onClick={handleEnablePush}
                className="px-6 py-3 malts-btn-primary rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2 animate-pulse"
              >
                🔔 Активирай нотификации
              </button>
            )}

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-4 py-3 bg-[var(--malts-card)] rounded-xl hover:bg-[var(--malts-card-hover)] transition-colors border border-[var(--malts-hairline)]"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--malts-accent)] text-[#f5f0e6] flex items-center justify-center font-bold">
                    {(session?.user as any)?.name?.[0] || 'S'}
                  </div>
                  <span className="text-[var(--malts-ink)] font-medium hidden lg:block">
                    {(session?.user as any)?.name || 'Staff'}
                  </span>
                  <svg className="w-4 h-4 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--malts-card)] border border-[var(--malts-hairline)] rounded-lg shadow-xl">
                    <div className="p-4 border-b border-[var(--malts-hairline)]">
                      <p className="text-[var(--malts-ink)] font-semibold">{(session?.user as any)?.name}</p>
                      <p className="text-sm malts-muted">{(session?.user as any)?.email}</p>
                      <span className="mt-2 inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] text-[var(--malts-accent)]">
                        {(session?.user as any)?.role}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full text-left px-4 py-3 text-[var(--malts-danger)] hover:bg-[var(--malts-accent-tint)] transition-colors flex items-center gap-2"
                    >
                      <span>🚪</span>
                      Изход
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile PWA Buttons & User Menu */}
        <div className="md:hidden flex flex-col gap-2">
          {!isPWA && showPWAPrompt && (
            <button
              onClick={handleInstallPWA}
              className="w-full px-4 py-3 malts-btn-secondary rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              📱 Инсталирай App
            </button>
          )}

          {!pushEnabled && isPushSupported() && (
            <button
              onClick={handleEnablePush}
              className="w-full px-4 py-3 malts-btn-primary rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 animate-pulse text-sm"
            >
              🔔 Активирай нотификации
            </button>
          )}

          {/* Mobile User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--malts-card)] rounded-xl hover:bg-[var(--malts-card-hover)] transition-colors border border-[var(--malts-hairline)] justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--malts-accent)] text-[#f5f0e6] flex items-center justify-center font-bold">
                  {(session?.user as any)?.name?.[0] || 'S'}
                </div>
                <span className="text-[var(--malts-ink)] font-medium">
                  {(session?.user as any)?.name || 'Staff'}
                </span>
              </div>
              <svg className="w-4 h-4 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="mt-2 bg-[var(--malts-card)] border border-[var(--malts-hairline)] rounded-lg shadow-xl p-4">
                <div className="mb-3 pb-3 border-b border-[var(--malts-hairline)]">
                  <p className="text-[var(--malts-ink)] font-semibold">{(session?.user as any)?.name}</p>
                  <p className="text-sm malts-muted">{(session?.user as any)?.email}</p>
                  <span className="mt-1 inline-block px-2 py-1 text-xs rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] text-[var(--malts-accent)]">
                    {(session?.user as any)?.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full text-left px-4 py-3 text-[var(--malts-danger)] hover:bg-[var(--malts-accent-tint)] rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🚪</span>
                  Изход
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Изход"
        message="Сигурни ли сте, че искате да излезете?"
        confirmLabel="Да, излез"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await handleLogout();
        }}
      />

      {/* Waiter Calls Section with Tabs */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold">
            🔔 Повиквания
          </h2>
          
          {/* Tabs for Calls */}
          <div className="flex gap-2 bg-[var(--malts-inset)] p-1 rounded-lg w-full sm:w-auto border border-[var(--malts-hairline)]">
            <button
              onClick={() => setCallsTab('active')}
              className={`flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base ${
                callsTab === 'active'
                  ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
              }`}
            >
              Активни ({waiterCalls.filter(c => c.status !== 'completed').length})
            </button>
            <button
              onClick={() => setCallsTab('completed')}
              className={`flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base ${
                callsTab === 'completed'
                  ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
              }`}
            >
              Завършени ({waiterCalls.filter(c => c.status === 'completed').length})
            </button>
          </div>
        </div>
        
        {callsTab === 'active' && (
          waiterCalls.filter(call => call.status !== 'completed').length === 0 ? (
            <div className="text-center py-20 malts-card">
              <p className="malts-muted text-xl">Няма активни повиквания</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {waiterCalls
                .filter(call => call.status !== 'completed')
                .map(call => (
              <div
                key={call.id}
                className={`rounded-xl p-4 md:p-6 border-2 ${
                  call.callType.includes('payment')
                    ? 'bg-red-500/20 border-red-500'
                    : 'bg-yellow-500/20 border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start mb-3 md:mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold">
                      Маса {call.tableNumber}
                    </h3>
                    <p className="text-base md:text-lg malts-muted">
                      {call.message}
                    </p>
                    {call.createdAt && (
                      <p className="text-xs md:text-sm malts-muted mt-1">
                        {formatBulgarianDateTime(call.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="text-2xl md:text-3xl">
                    {call.callType.includes('payment') ? '💰' : '🆘'}
                  </div>
                </div>
                {call.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => acknowledgeCall(call.id)}
                      disabled={loadingActions[call.id]}
                      className="px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      {loadingActions[call.id] ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          <span className="hidden sm:inline">...</span>
                        </>
                      ) : (
                        'Отивам'
                      )}
                    </button>
                    <button
                      onClick={() => completeCall(call.id)}
                      disabled={loadingActions[`complete_${call.id}`]}
                      className="px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      {loadingActions[`complete_${call.id}`] ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          <span className="hidden sm:inline">...</span>
                        </>
                      ) : (
                        'Завърши'
                      )}
                    </button>
                  </div>
                )}
                {call.status === 'acknowledged' && (
                  <button
                    onClick={() => completeCall(call.id)}
                    disabled={loadingActions[`complete_${call.id}`]}
                    className="w-full px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                    {loadingActions[`complete_${call.id}`] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">...</span>
                      </>
                    ) : (
                      <>✓ Завърши</>
                    )}
                  </button>
                )}
              </div>
            ))}
            </div>
          )
        )}
        
        {/* Completed Calls */}
        {callsTab === 'completed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiterCalls
              .filter(call => call.status === 'completed')
              .map(call => (
              <div
                key={call.id}
                className="rounded-xl p-6 border-2 bg-[var(--malts-inset)] border-green-500/30 opacity-90"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">
                      Маса {call.tableNumber}
                    </h3>
                    <p className="text-lg malts-muted">
                      {call.message}
                    </p>
                    {call.createdAt && (
                      <p className="text-sm malts-muted mt-1">
                        Заявено: {formatBulgarianDateTime(call.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="text-3xl">
                    {call.callType.includes('payment') ? '💰' : '🆘'}
                  </div>
                </div>
                <div className="text-center text-green-300 font-semibold">
                  ✓ Завършено
                </div>
                {call.completedAt && (
                  <p className="text-sm malts-muted mt-2 text-center">
                    Завършено: {formatBulgarianDateTime(call.completedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders Section with Tabs */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold">
            📋 Поръчки
          </h2>
          
          {/* Tabs */}
          <div className="flex gap-2 bg-[var(--malts-inset)] p-1 rounded-lg w-full sm:w-auto border border-[var(--malts-hairline)]">
            <button
              onClick={() => setOrdersTab('active')}
              className={`flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base ${
                ordersTab === 'active'
                  ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
              }`}
            >
              Активни ({orders.filter((o: any) => o.status !== 'completed').length})
            </button>
            <button
              onClick={() => setOrdersTab('completed')}
              className={`flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base ${
                ordersTab === 'completed'
                  ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
              }`}
            >
              Завършени ({orders.filter((o: any) => o.status === 'completed').length})
            </button>
          </div>
        </div>
        
        {/* Active Orders */}
        {ordersTab === 'active' && (
          orders.filter((o: any) => o.status !== 'completed').length === 0 ? (
            <div className="text-center py-20 malts-card">
              <p className="malts-muted text-xl">Няма активни поръчки</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders
                .filter((order: any) => order.status !== 'completed')
                .map((order: any) => (
                <div
                  key={`active-${order.id}`}
                  className="malts-card rounded-xl p-4 md:p-6 border-2 border-[var(--malts-hairline)]"
                >
                  <div className="flex justify-between items-start mb-3 md:mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-lg md:text-2xl font-bold text-[var(--malts-ink)]">
                        Поръчка #{order.orderNumber}
                      </div>
                      <div className="text-base md:text-lg malts-muted">
                        Маса {order.tableNumber}
                      </div>
                      {order.createdAt && (
                        <div className="text-xs md:text-sm malts-muted mt-1">
                          {formatBulgarianDateTime(order.createdAt)}
                        </div>
                      )}
                    </div>
                    <div className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap ${
                      order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                      order.status === 'pending_approval' ? 'bg-orange-500/20 text-orange-300' :
                      order.status === 'preparing' ? 'bg-blue-500/20 text-blue-300' :
                      order.status === 'ready' ? 'bg-green-500/20 text-green-300' : ''
                    }`}>
                      {order.status === 'pending' ? 'Нова' :
                       order.status === 'pending_approval' ? 'Изчаква одобрение' :
                       order.status === 'preparing' ? 'В процес' :
                       order.status === 'ready' ? 'Готова' : order.status}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-3 md:mb-4 space-y-1 md:space-y-2">
                    {order.items && order.items.map((item: any, itemIdx: number) => (
                      <div key={`${order.id}-item-${item.id || itemIdx}`} className="flex justify-between text-[var(--malts-ink)] text-sm md:text-base">
                        <span className="truncate mr-2">{item.quantity}x {item.productName}</span>
                        <Price priceBgn={Number(item.priceBgn)} className="text-[var(--malts-ink)] whitespace-nowrap" />
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--malts-hairline)] pt-2 md:pt-3 mb-3 md:mb-4">
                    <div className="flex justify-between text-base md:text-xl font-bold text-[var(--malts-ink)]">
                      <span>Общо:</span>
                      <Price priceBgn={Number(order.totalBgn)} className="text-base md:text-xl font-bold text-[var(--malts-ink)]" />
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          {loadingActions[order.id] ? (
                            <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Приготвяме</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                    {order.status === 'preparing' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          {loadingActions[order.id] ? (
                            <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Готова</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                    {order.status === 'ready' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-primary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          {loadingActions[order.id] ? (
                            <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            '✓ Завърши'
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={loadingActions[order.id]}
                          className="px-3 md:px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        
        {/* Completed Orders */}
        {ordersTab === 'completed' && (
          orders.filter((o: any) => o.status === 'completed').length === 0 ? (
            <div className="text-center py-20 malts-card">
              <p className="malts-muted text-xl">Няма завършени поръчки днес</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders
                .filter((order: any) => order.status === 'completed')
                .map((order: any) => (
                <div
                  key={`completed-${order.id}`}
                  className="malts-card rounded-xl p-6 border-2 border-green-500/50 opacity-75"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-2xl font-bold text-[var(--malts-ink)]">
                        Поръчка #{order.orderNumber}
                      </div>
                      <div className="text-lg malts-muted">
                        Маса {order.tableNumber}
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-300">
                      ✓ Завършена
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4 space-y-2">
                    {order.items && order.items.map((item: any, itemIdx: number) => (
                      <div key={`${order.id}-item-${item.id || itemIdx}`} className="flex justify-between text-[var(--malts-ink)]">
                        <span>{item.quantity}x {item.productName}</span>
                        <Price priceBgn={Number(item.priceBgn)} className="text-[var(--malts-ink)]" />
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--malts-hairline)] pt-3">
                    <div className="flex justify-between text-xl font-bold text-[var(--malts-ink)]">
                      <span>Общо:</span>
                      <Price priceBgn={Number(order.totalBgn)} className="text-xl font-bold text-[var(--malts-ink)]" />
                    </div>
                    {order.completedAt && (
                      <p className="text-sm malts-muted mt-2">
                        Завършена: {formatBulgarianTime(order.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedApproval && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="malts-card p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              Поръчка изисква одобрение
            </h2>

            <div className="space-y-4 mb-6">
              <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="malts-subtle">Поръчка #:</span>
                  <span className="font-semibold">
                    {selectedApproval.order?.orderNumber || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="malts-subtle">Маса:</span>
                  <span className="font-semibold">
                    {selectedApproval.tableNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="malts-subtle">Дата/Час:</span>
                  <span className="font-semibold">
                    {selectedApproval.order?.createdAt 
                      ? formatBulgarianDateTime(selectedApproval.order.createdAt)
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="malts-subtle">Общо:</span>
                  <span className="font-semibold text-lg">
                    {selectedApproval.order?.totalBgn != null ? (
                      <Price priceBgn={Number(selectedApproval.order.totalBgn)} />
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
              </div>

              {selectedApproval.order?.items && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3">Артикули:</h4>
                  <div className="space-y-2">
                    {selectedApproval.order.items.map((item: any, idx: number) => (
                      <div key={`${selectedApproval.orderId}-item-${item.id || idx}`} className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 flex justify-between">
                        <span>{item.productName} x {item.quantity}</span>
                        <span className="font-semibold">
                          <Price priceBgn={Number(item.priceBgn) * item.quantity} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mb-6">
                <p className="text-yellow-200 text-sm">
                  <strong>Причина:</strong> Направени са {selectedApproval.orderCount} поръчки за последните {approvalWindowMinutes} минути. 
                  Заради съображения за сигурност и превантивно действие при потенциално неправомерни действия 
                  и хакерски атаки, тази поръчка изисква одобрение.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleApproveOrder(selectedApproval.orderId)}
                  disabled={processingApproval}
                  className="flex-1 px-6 py-3 malts-btn-primary rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingApproval ? 'Обработване...' : '✅ Одобри'}
                </button>
                <button
                  onClick={() => handleRejectOrder(selectedApproval.orderId)}
                  disabled={processingApproval}
                  className="flex-1 px-6 py-3 malts-btn-danger rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingApproval ? 'Обработване...' : '❌ Откажи'}
                </button>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedApproval(null);
                  }}
                  disabled={processingApproval}
                  className="px-6 py-3 malts-btn-secondary rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Затвори
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


