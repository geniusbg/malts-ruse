'use client';

import { useEffect, useLayoutEffect, useState, Suspense, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import Price from '@/components/Price';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Toast from '@/components/Toast';
import { getPusherClient } from '@/lib/pusher-client';
import LoadingScreen from '@/components/LoadingScreen';
import { useLockScroll } from '@/lib/use-lock-scroll';
import {
  getChildrenOf,
  categoryPathLeafId,
  selectCategoryAtDepth,
  MALLS_MAX_CATEGORY_DEPTH,
} from '@/lib/category-navigation';

/** API/Prisma понякога връщат snake_case; навигацията използва parentCategoryId. */
function normalizeCategoryRow(c: any) {
  return {
    ...c,
    parentCategoryId: c.parentCategoryId ?? c.parent_category_id ?? null,
  };
}

interface CartItem {
  productId: string;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  priceBgn: number;
  quantity: number;
  unit?: string;
  productQuantity?: number;
}

function OrderPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialTableNumber = searchParams.get('table');
  const [tableNumber, setTableNumber] = useState<string | null>(initialTableNumber);
  
  // Get locale from URL path
  const locale = pathname.split('/')[1] || 'bg';

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  /** Мобилен bottom sheet за избор на категория (под lg). */
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const categorySheetPanelRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [loadProgress, setLoadProgress] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; persistent?: boolean } | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  
  // Lock scroll when cart, session gate, or other full-screen overlays are open
  useLockScroll(showCart || sessionStatus !== 'valid' || categorySheetOpen);
  const [isOffline, setIsOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | 'auto-rejected' | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [approvalConfig, setApprovalConfig] = useState<{ threshold: number; windowMinutes: number; autoRejectMinutes?: number } | null>(null);

  const approvalThresholdValue = approvalConfig?.threshold ?? 5;
  const approvalWindowValue = approvalConfig?.windowMinutes ?? 5;
  const autoRejectMinutesValue = approvalConfig?.autoRejectMinutes ?? 30;

  const approvalPollRef = useRef<NodeJS.Timeout | null>(null);
  const approvalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const approvalStatusRef = useRef<'pending' | 'approved' | 'rejected' | 'auto-rejected' | null>(null);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    let hideTimer: NodeJS.Timeout | null = null;

    if (loading) {
      setShowLoadingScreen(true);
    } else {
      hideTimer = setTimeout(() => {
        setShowLoadingScreen(false);
      }, 3000);
    }

    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, [loading]);

  useEffect(() => {
    approvalStatusRef.current = approvalStatus;
  }, [approvalStatus]);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  const clearApprovalPolling = useCallback(() => {
    if (approvalPollRef.current) {
      clearInterval(approvalPollRef.current);
      approvalPollRef.current = null;
    }
    if (approvalTimeoutRef.current) {
      clearTimeout(approvalTimeoutRef.current);
      approvalTimeoutRef.current = null;
    }
  }, []);

  /** Мобилно: bottom sheet; десктоп: скрол към блока с категориите. */
  const openCategoryPicker = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      document.getElementById('order-category-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setCategorySheetOpen(true);
    }
  }, []);

  const handleApprovalStatusUpdate = useCallback(
    (status: 'approved' | 'rejected' | 'auto-rejected', data?: { items?: { productName: string; quantity: number }[]; reason?: string }) => {
      clearApprovalPolling();
      setApprovalStatus(status);

      const itemsList = data?.items && data.items.length
        ? '\n\n' + data.items.map(item => `${item.quantity}x ${item.productName}`).join('\n')
        : '';

      if (status === 'approved') {
        const message =
          (locale === 'bg'
            ? '✅ Поръчката е одобрена!'
            : locale === 'en'
            ? '✅ Order approved!'
            : '✅ Comanda a fost aprobată!') + itemsList;

        setToast({ message, type: 'success' });
        setCart([]);
        setShowCart(false);
      } else if (status === 'rejected') {
        const rejectionMessage =
          (locale === 'bg'
            ? '❌ Поръчката е отхвърлена'
            : locale === 'en'
            ? '❌ Order rejected'
            : '❌ Comanda a fost respinsă') + (data?.reason ? `: ${data.reason}` : '') + itemsList;

        setToast({ message: rejectionMessage, type: 'error' });
      } else if (status === 'auto-rejected') {
        const autoMessage =
          (locale === 'bg'
            ? `⏱️ Поръчката беше автоматично отхвърлена след ${autoRejectMinutesValue} минути`
            : locale === 'en'
            ? `⏱️ Order was automatically rejected after ${autoRejectMinutesValue} minutes`
            : `⏱️ Comanda a fost respinsă automat după ${autoRejectMinutesValue} minute`) +
          (data?.reason ? `: ${data.reason}` : '') +
          itemsList;

        setToast({ message: autoMessage, type: 'error' });
      }

      setTimeout(() => {
        setRequiresApproval(false);
        setApprovalStatus(null);
        setOrderId(null);
        setApprovalConfig(null);
      }, 3000);
    },
    [autoRejectMinutesValue, clearApprovalPolling, locale]
  );

  // Health check function
  const checkServerHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // Expose offline state for ConditionalNav to detect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__checkServerHealth = checkServerHealth;
    }
  }, []);

  // Save session token from URL to localStorage
  const getSessionMessageForReason = useCallback((reason?: string) => {
    const messages: Record<string, { bg: string; en: string; ro: string }> = {
      missing: {
        bg: 'Сесията е изтекла. Моля, сканирайте QR кода от масата отново.',
        en: 'Your session has expired. Please scan the table QR code again.',
        ro: 'Sesiunea a expirat. Scanează din nou codul QR de la masă.',
      },
      expired: {
        bg: 'Сесията е изтекла. Моля, сканирайте QR кода от масата отново.',
        en: 'Your session has expired. Please scan the table QR code again.',
        ro: 'Sesiunea a expirat. Scanează din nou codul QR de la masă.',
      },
      revoked: {
        bg: 'Сесията е невалидна. Моля, сканирайте QR кода от масата отново.',
        en: 'Your session is no longer valid. Please scan the table QR code again.',
        ro: 'Sesiunea nu mai este validă. Scanează din nou codul QR de la masă.',
      },
      invalid: {
        bg: 'Невалидна сесия. Моля, сканирайте QR кода от масата отново.',
        en: 'Invalid session. Please scan the table QR code again.',
        ro: 'Sesiune invalidă. Scanează din nou codul QR de la masă.',
      },
      default: {
        bg: 'Моля, сканирайте QR кода от масата, за да продължите.',
        en: 'Please scan the table QR code to continue.',
        ro: 'Scanează codul QR de la masă pentru a continua.',
      },
    };

    const localeMessages = messages[reason ?? 'default'] || messages.default;
    return localeMessages[locale as 'bg' | 'en' | 'ro'] || messages.default.bg;
  }, [locale]);

  const validateSession = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setSessionStatus('checking');
    }

    try {
      const response = await fetch('/api/table-session/validate', {
        method: 'POST',
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (data.tableNumber) {
          setTableNumber(String(data.tableNumber));
        }
        setSessionStatus('valid');
        setSessionMessage(null);
        return { ok: true as const, tableNumber: data.tableNumber };
      }

      const message = getSessionMessageForReason(data.reason);
      setSessionStatus('invalid');
      setSessionMessage(message);
      setTableNumber(null);
      return { ok: false as const, reason: data.reason };
    } catch {
      const message = getSessionMessageForReason('missing');
      setSessionStatus('invalid');
      setSessionMessage(message);
      setTableNumber(null);
      return { ok: false as const, reason: 'missing' };
    }
  }, [getSessionMessageForReason]);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  useEffect(() => {
    if (typeof window !== 'undefined' && searchParams.get('session')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      clearApprovalPolling();
    };
  }, [clearApprovalPolling]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (mq.matches) setCategorySheetOpen(false);
    };
    mq.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => mq.removeEventListener('change', closeOnDesktop);
  }, []);

  /** Хоризонталните редове с чипове понякога остават с грешен scrollLeft (емулация/touch) — винаги отляво. */
  useLayoutEffect(() => {
    if (!categorySheetOpen) return;
    const panel = categorySheetPanelRef.current;
    if (!panel) return;
    panel.querySelectorAll<HTMLElement>('[data-order-tier-hscroll]').forEach((el) => {
      el.scrollLeft = 0;
    });
  }, [categorySheetOpen]);

  // Listen for order status and approval updates via Pusher
  useEffect(() => {
    if (!tableNumber) return;

    const pusher = getPusherClient();
    const tableChannel = pusher.subscribe(`table-${tableNumber}`);

    const statusHandler = (data: any) => {
      console.log('📢 Order status update received:', data);

      const itemsList =
        data.items && data.items.length
          ? '\n\n' + data.items.map((item: any) => `${item.quantity}x ${item.productName}`).join('\n')
          : '';

      let message = '';
      let type: 'success' | 'error' = 'success';

      switch (data.status) {
        case 'pending':
          message =
            (locale === 'bg'
              ? `🔄 Поръчка #${data.orderNumber} е приета и се подготвя`
              : locale === 'en'
              ? `🔄 Order #${data.orderNumber} accepted and being prepared`
              : `🔄 Comanda #${data.orderNumber} a fost acceptată și se pregătește`) + itemsList;
          break;
        case 'preparing':
          message =
            (locale === 'bg'
              ? `👨‍🍳 Поръчка #${data.orderNumber} се приготвя`
              : locale === 'en'
              ? `👨‍🍳 Order #${data.orderNumber} is being prepared`
              : `👨‍🍳 Comanda #${data.orderNumber} se pregătește`) + itemsList;
          break;
        case 'ready':
          message =
            (locale === 'bg'
              ? `✅ Поръчка #${data.orderNumber} е готова!`
              : locale === 'en'
              ? `✅ Order #${data.orderNumber} is ready!`
              : `✅ Comanda #${data.orderNumber} este gata!`) + itemsList;
          break;
        case 'completed':
          message =
            (locale === 'bg'
              ? `✅ Поръчка #${data.orderNumber} е завършена`
              : locale === 'en'
              ? `✅ Order #${data.orderNumber} completed`
              : `✅ Comanda #${data.orderNumber} a fost finalizată`) + itemsList;
          break;
        case 'cancelled':
          message =
            (locale === 'bg'
              ? `❌ Поръчка #${data.orderNumber} е отменена${data.cancellationReason ? ': ' + data.cancellationReason : ''}`
              : locale === 'en'
              ? `❌ Order #${data.orderNumber} cancelled${data.cancellationReason ? ': ' + data.cancellationReason : ''}`
              : `❌ Comanda #${data.orderNumber} a fost anulată${data.cancellationReason ? ': ' + data.cancellationReason : ''}`) + itemsList;
          type = 'error';
          break;
        default:
          return;
      }

      setToast({ message, type });
    };

    const approvalHandler = (data: any) => {
      console.log('📢 Order approval status received:', data);
      
      // Only process if this is for the current pending order
      if (orderIdRef.current && data?.orderId && data.orderId !== orderIdRef.current) {
        console.log('⚠️ Approval status for different order, ignoring');
        return;
      }
      
      // Process approval status update
      const status = data?.status as 'approved' | 'rejected' | 'auto-rejected';
      if (status && ['approved', 'rejected'].includes(status)) {
        handleApprovalStatusUpdate(status, {
          items: data.items,
          reason: data.reason
        });
      }
    };

    const waiterCallHandler = (data: any) => {
      console.log('📢 Waiter call status received:', data);
      
      let message = '';
      let type: 'success' | 'error' = 'success';
      
      if (data.status === 'acknowledged') {
        message = locale === 'bg'
          ? '✅ Сервитьорът е уведомен и ще дойде скоро'
          : locale === 'en'
          ? '✅ Waiter has been notified and will arrive soon'
          : '✅ Chelnerul a fost anunțat și va veni în curând';
      } else if (data.status === 'completed') {
        const callTypeText = data.callType === 'payment_cash'
          ? (locale === 'bg' ? 'Плащане с брой' : locale === 'en' ? 'Payment with cash' : 'Plată numerar')
          : data.callType === 'payment_card'
          ? (locale === 'bg' ? 'Плащане с карта' : locale === 'en' ? 'Payment with card' : 'Plată cu cardul')
          : (locale === 'bg' ? 'Помощ' : locale === 'en' ? 'Help' : 'Ajutor');
        
        message = locale === 'bg'
          ? `✅ ${callTypeText} - завършено`
          : locale === 'en'
          ? `✅ ${callTypeText} - completed`
          : `✅ ${callTypeText} - finalizat`;
      }
      
      if (message) {
        setToast({ message, type, persistent: true });
      }
    };

    tableChannel.bind('order-status-update', statusHandler);
    tableChannel.bind('order-approval-status', approvalHandler);
    tableChannel.bind('waiter-call-status', waiterCallHandler);

    return () => {
      tableChannel.unbind('order-status-update', statusHandler);
      tableChannel.unbind('order-approval-status', approvalHandler);
      tableChannel.unbind('waiter-call-status', waiterCallHandler);
      pusher.unsubscribe(`table-${tableNumber}`);
    };
  }, [handleApprovalStatusUpdate, locale, tableNumber]);

  // Reset scroll position immediately when component mounts and while the loading screen is visible
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Force scroll to top immediately on mount
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Also try scrollTo with different methods
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
    };
    
    resetScroll();
    
    // Reset on loading screen visibility change
    if (showLoadingScreen) {
      resetScroll();
      // Also use requestAnimationFrame to ensure it happens after render
      requestAnimationFrame(() => {
        resetScroll();
      });
    }
  }, [showLoadingScreen]);

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoadProgress(10);
        const categoriesRes = await fetch('/api/categories');
        setLoadProgress(45);
        const productsRes = await fetch('/api/menu');
        setLoadProgress(85);

        const categoriesData = await categoriesRes.json();
        const productsData = await productsRes.json();

        const rawCats: any[] = categoriesData.categories || [];
        const cats = rawCats.map(normalizeCategoryRow);
        setCategories(cats);
        setProducts(productsData.products || []);

        if (cats.length > 0) {
          const roots = cats
            .filter((c: any) => !c.parentCategoryId)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
          if (roots.length > 0) {
            setCategoryPath([roots[0].id]);
          }
        }
        setLoadProgress(100);
      } catch (error) {
        // Error loading menu
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, []);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        nameBg: product.nameBg,
        nameEn: product.nameEn,
        nameRo: product.nameRo,
        priceBgn: Number(product.priceBgn),
        quantity: 1,
        unit: product.unit,
        productQuantity: product.quantity
      }];
    });

    // Show toast notification
    const productName = locale === 'bg' ? product.nameBg : locale === 'en' ? product.nameEn : product.nameRo;
    setToast({
      message: `${productName} ${locale === 'bg' ? 'добавено в кошницата' : locale === 'en' ? 'added to cart' : 'adăugat în coș'}`,
      type: 'success'
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.priceBgn * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const parentCategories = useMemo(
    () =>
      categories
        .filter((c: any) => !c.parentCategoryId)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  const displayCategoryId = categoryPathLeafId(categoryPath);
  const categoryProducts = products.filter((p: any) => p.categoryId === displayCategoryId);
  const leafIdOrder = categoryPathLeafId(categoryPath);
  const childrenOfLeafOrder = leafIdOrder ? getChildrenOf(categories, leafIdOrder) : [];
  const needsDeeperDrillOrder =
    !!leafIdOrder && childrenOfLeafOrder.length > 0 && categoryProducts.length === 0;

  const pollApprovalStatus = useCallback(
    (orderId: string) => {
      clearApprovalPolling();

      // Fallback polling only every 60 seconds (Pusher is primary method)
      // This ensures we still get updates even if Pusher connection fails
      approvalPollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/orders/${orderId}/approval-status`);
          if (response.ok) {
            const data = await response.json();
            if (data.status && data.status !== 'pending') {
              console.log('📡 Fallback poll detected approval status change:', data.status);
              handleApprovalStatusUpdate(data.status as 'approved' | 'rejected' | 'auto-rejected', data);
            }
          }
        } catch (error) {
          console.log('Approval poll failed:', error);
        }
      }, 60000); // 60 seconds instead of 10 - Pusher is primary

      // Auto-reject timeout (still needed as safety mechanism)
      approvalTimeoutRef.current = setTimeout(() => {
        if (approvalStatusRef.current === 'pending') {
          handleApprovalStatusUpdate('auto-rejected');
        }
      }, autoRejectMinutesValue * 60 * 1000);
    },
    [autoRejectMinutesValue, clearApprovalPolling, handleApprovalStatusUpdate]
  );

  const submitOrder = async () => {
    if (cart.length === 0) return;
    
    // Prevent duplicate submissions
    if (submitting) return;
    
    setSubmitting(true);

    // Health check before submitting
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      // Trigger offline banner with server down flag
      setIsOffline(true);
      if (typeof window !== 'undefined') {
        if ((window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        // Set server down flag
        if ((window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
      }
      setToast({ 
        message: 'Сървърът е недостъпен. Моля, опитайте отново след няколко секунди.', 
        type: 'error' 
      });
      setSubmitting(false);
      return;
    }

    try {
      const sessionCheck = await validateSession({ silent: true });
      if (!sessionCheck.ok) {
        setToast({ 
          message: getSessionMessageForReason(sessionCheck.reason),
          type: 'error' 
        });
        setSubmitting(false);
        return;
      }

      // Prepare items with productName for the API
      const orderItems = cart.map(item => ({
        productId: item.productId,
        productName: item.nameBg, // Always use Bulgarian name for orders
        priceBgn: item.priceBgn,
        quantity: item.quantity
      }));

      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: parseInt(tableNumber || '0'),
          items: orderItems
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle 409 Conflict - pending approval exists
        if (response.status === 409) {
          setToast({ 
            message: responseData.error || 'Има изчакваща поръчка за одобрение',
            type: 'error' 
          });
          setSubmitting(false);
          return;
        }
        
        // Handle 401 Unauthorized - session expired
        if (response.status === 401) {
          const message = getSessionMessageForReason(responseData.reason);
          setSessionStatus('invalid');
          setSessionMessage(message);
          setToast({ 
            message,
            type: 'error' 
          });
          setSubmitting(false);
          return;
        }
        
        // Handle 429 Rate Limit - too many orders
        if (response.status === 429) {
          let errorMsg = responseData.error || 'Твърде много поръчки';
          if (responseData.details) {
            errorMsg += `\n${responseData.details}`;
          }
          setToast({ 
            message: errorMsg,
            type: 'error' 
          });
          setSubmitting(false);
          return;
        }
        
        // Handle other errors
        setToast({ 
          message: responseData.error || responseData.details || 'Грешка при създаване на поръчка',
          type: 'error' 
        });
        setSubmitting(false);
        return;
      }

      setApprovalConfig(responseData.approvalConfig ?? null);

      // Success - check if approval is required
      if (responseData.requiresApproval) {
        setRequiresApproval(true);
        setApprovalStatus('pending');
        setOrderId(responseData.orderId);
        pollApprovalStatus(responseData.orderId);

        setToast({ 
          message: locale === 'bg' 
            ? '⚠️ Поръчката изисква одобрение от администратор'
            : locale === 'en'
            ? '⚠️ Order requires admin approval'
            : '⚠️ Comanda necesită aprobare de la administrator',
          type: 'error' 
        });
      } else {
        setToast({ 
          message: locale === 'bg' 
            ? `✅ Поръчка #${responseData.orderNumber} е създадена успешно!`
            : locale === 'en'
            ? `✅ Order #${responseData.orderNumber} created successfully!`
            : `✅ Comanda #${responseData.orderNumber} a fost creată cu succes!`,
          type: 'success' 
        });
        setCart([]);
        setShowCart(false);
      }
      
      setSubmitting(false);
    } catch (error: any) {
      console.error('Submit order error:', error);
      setToast({ 
        message: locale === 'bg' 
          ? 'Грешка при създаване на поръчка. Моля, опитайте отново.'
          : locale === 'en'
          ? 'Error creating order. Please try again.'
          : 'Eroare la crearea comenzii. Încercați din nou.',
        type: 'error' 
      });
      setSubmitting(false);
    }
  };

  const sessionOverlayTitle = sessionStatus === 'checking'
    ? (locale === 'bg'
        ? 'Проверка на сесията...'
        : locale === 'en'
        ? 'Verifying your session...'
        : 'Se verifică sesiunea...')
    : (locale === 'bg'
        ? 'Сесията е изтекла'
        : locale === 'en'
        ? 'Session expired'
        : 'Sesiune expirată');

  const sessionOverlayBody = sessionStatus === 'checking'
    ? (locale === 'bg'
        ? 'Моля, изчакайте докато проверим връзката със системата.'
        : locale === 'en'
        ? 'Please wait while we verify the connection to the system.'
        : 'Vă rugăm așteptați în timp ce verificăm conexiunea.')
    : (sessionMessage || getSessionMessageForReason());

  if (showLoadingScreen) {
    return <LoadingScreen locale={locale} progress={loading ? loadProgress : undefined} />;
  }

  return (
    <main
      className={`min-h-screen malts-surface ${tableNumber ? 'pb-16 max-md:pb-24 md:pb-8' : 'pb-8'}`}
    >
      {/* Toast Notifications - hidden when server is offline */}
      {toast && !isOffline && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          persistent={true}
          locale={locale}
        />
      )}

      {/* Approval Banner */}
      {requiresApproval && (
        <div className="bg-yellow-100 border-b-4 border-yellow-400 text-yellow-800 p-4 sticky top-0 z-50">
          <div className="container mx-auto">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-2">
                  {locale === 'bg' ? 'Поръчката изисква одобрение' : 
                   locale === 'en' ? 'Order requires approval' : 
                   'Comanda necesită aprobare'}
                </p>
                <p className="text-sm mb-2">
                  {locale === 'bg' 
                    ? `Направени са ${approvalThresholdValue} поръчки за последните ${approvalWindowValue} минути. Заради съображения за сигурност и превантивно действие при потенциално неправомерни действия и хакерски атаки, тази поръчка изисква одобрение.`
                    : locale === 'en'
                    ? `${approvalThresholdValue} orders have been placed in the last ${approvalWindowValue} minutes. Due to security concerns and preventive action against potentially unauthorized actions and hacking attacks, this order requires approval.`
                    : `Au fost plasate ${approvalThresholdValue} comenzi în ultimele ${approvalWindowValue} minute. Din motive de securitate și ca măsură preventivă împotriva acțiunilor neautorizate și a atacurilor, această comandă necesită aprobare.`}
                </p>
                {approvalStatus === 'pending' && (
                  <p className="text-sm font-medium">
                    {locale === 'bg' 
                      ? '⏳ Очакване на одобрение от администратор...'
                      : locale === 'en'
                      ? '⏳ Waiting for admin approval...'
                      : '⏳ Se așteaptă aprobarea administratorului...'}
                  </p>
                )}
                {approvalStatus === 'approved' && (
                  <p className="text-sm font-medium text-green-700">
                    {locale === 'bg' 
                      ? '✅ Поръчката е одобрена!'
                      : locale === 'en'
                      ? '✅ Order approved!'
                      : '✅ Comanda a fost aprobată!'}
                  </p>
                )}
                {approvalStatus === 'rejected' && (
                  <p className="text-sm font-medium text-red-700">
                    {locale === 'bg' 
                      ? '❌ Поръчката е отхвърлена'
                      : locale === 'en'
                      ? '❌ Order rejected'
                      : '❌ Comanda a fost respinsă'}
                  </p>
                )}
                {approvalStatus === 'auto-rejected' && (
                  <p className="text-sm font-medium text-red-600">
                    {locale === 'bg'
                      ? `⏱️ Поръчката беше автоматично отхвърлена след ${autoRejectMinutesValue} минути`
                      : locale === 'en'
                      ? `⏱️ Order was automatically rejected after ${autoRejectMinutesValue} minutes`
                      : `⏱️ Comanda a fost respinsă automat după ${autoRejectMinutesValue} minute`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[var(--malts-paper)]/92 backdrop-blur-lg border-b border-[var(--malts-hairline)] sticky top-0 z-40">
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between items-center gap-4">
            <Link
              href={`/${locale}`}
              className="flex h-[5.5rem] max-h-[5.5rem] min-w-0 shrink-0 items-center overflow-hidden sm:h-16 sm:max-h-16"
            >
              <Image
                src="/malts-logo-nav.webp"
                alt="Malt's"
                width={400}
                height={331}
                sizes="(max-width: 640px) 320px, 300px"
                className="malts-brand-filter h-full w-auto max-h-[5.5rem] min-h-0 min-w-0 shrink-0 object-contain object-left sm:max-h-16"
                priority
              />
            </Link>
            
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 md:gap-3">
                {tableNumber && (
                  <div className="bg-[var(--malts-accent-tint)] px-3 py-1 rounded-full border border-[var(--malts-accent-tint-border)] -ml-2 md:ml-0">
                    <p className="text-[var(--malts-ink)] font-semibold text-sm whitespace-nowrap">
                      {locale === 'bg' ? 'Маса' : locale === 'en' ? 'Table' : 'Masă'} {tableNumber}
                    </p>
                  </div>
                )}
                
                {/* Cart Button */}
                <button
                  onClick={() => setShowCart(!showCart)}
                  className="relative px-4 py-2.5 malts-btn-secondary rounded-lg font-semibold transition-all text-sm md:text-base"
                >
                  🛒 {locale === 'bg' ? 'Количка' : locale === 'en' ? 'Cart' : 'Coș'}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[var(--malts-danger)] text-[#f5f0e6] rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center text-xs md:text-sm font-bold">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Language Switcher */}
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter — мобилен: сгъваем панел + ограничена височина; десктоп: пълен ред */}
      <div
        id="order-category-nav"
        className="border-b border-[var(--malts-hairline)] bg-[var(--malts-paper)]/92 py-2 backdrop-blur-lg lg:py-4"
      >
        <div className="container mx-auto px-4">
          {(() => {
            const tierBtnClass = (depth: number, isActive: boolean) =>
              depth === 0
                ? `rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm lg:rounded-xl lg:px-6 lg:py-3 lg:text-base ${
                    isActive
                      ? 'scale-[1.02] bg-[var(--malts-accent)] text-[#f5f0e6] shadow-lg lg:scale-105'
                      : 'border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
                  }`
                : `rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-sm lg:rounded-lg lg:px-4 lg:py-2 ${
                    isActive
                      ? 'border-2 border-[var(--malts-accent)] bg-[var(--malts-accent)] text-[#f5f0e6]'
                      : 'border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
                  }`;

            const renderTierRow = (
              depth: number,
              wrapClass: string,
              flexClass: string,
              opts?: { closeCategorySheet?: boolean; markHorizontalTier?: boolean }
            ) => {
              const tierItems =
                depth === 0
                  ? parentCategories
                  : categoryPath[depth - 1]
                    ? getChildrenOf(categories, categoryPath[depth - 1]!)
                    : [];
              if (tierItems.length === 0) return null;
              return (
                <div
                  key={`tier-${depth}`}
                  className={wrapClass}
                  {...(opts?.markHorizontalTier ? { 'data-order-tier-hscroll': true } : {})}
                >
                  <div className={flexClass}>
                    {tierItems.map((cat: any) => {
                      const name = locale === 'bg' ? cat.nameBg : locale === 'en' ? cat.nameEn : cat.nameRo;
                      const isActive = categoryPath[depth] === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const nextPath = selectCategoryAtDepth(categoryPath, depth, cat.id);
                            setCategoryPath(nextPath);
                            if (opts?.closeCategorySheet) {
                              const leaf = categoryPathLeafId(nextPath);
                              if (leaf) {
                                const prodsHere = products.filter((p: any) => p.categoryId === leaf);
                                const subcats = getChildrenOf(categories, leaf);
                                if (prodsHere.length > 0 || subcats.length === 0) {
                                  setCategorySheetOpen(false);
                                }
                              }
                            }
                          }}
                          className={tierBtnClass(depth, isActive)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            };

            const sheetTitle =
              locale === 'bg' ? 'Категории' : locale === 'en' ? 'Categories' : 'Categorii';
            const pickActionLabel =
              locale === 'bg' ? 'Избери' : locale === 'en' ? 'Choose' : 'Alege';
            const openSheetAria =
              locale === 'bg' ? 'Отвори избор на категория' : locale === 'en' ? 'Open category picker' : 'Deschide categoriile';

            const renderPathSegmentButtons = (variant: 'mobile' | 'sheet') => (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
                {categoryPath.map((id, idx) => {
                  const c = categories.find((x: any) => x.id === id);
                  if (!c) return null;
                  const name = locale === 'bg' ? c.nameBg : locale === 'en' ? c.nameEn : c.nameRo;
                  return (
                    <span key={`${id}-${idx}`} className="inline-flex max-w-full shrink-0 items-center gap-0.5">
                      {idx > 0 ? (
                        <span className="text-[var(--malts-subtle)]" aria-hidden>
                          ›
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryPath(categoryPath.slice(0, idx + 1));
                          if (variant === 'mobile') openCategoryPicker();
                        }}
                        className={
                          variant === 'mobile'
                            ? 'rounded-md border border-[var(--malts-hairline)]/70 bg-[var(--malts-card)]/80 px-2 py-0.5 text-left text-xs font-medium text-[var(--malts-muted)] transition-colors hover:border-[var(--malts-accent)]/40 hover:bg-[var(--malts-card)]'
                            : 'rounded-md border border-transparent px-1.5 py-0.5 text-left text-xs font-medium text-[var(--malts-muted)] transition-colors hover:border-[var(--malts-hairline)] hover:bg-[var(--malts-inset)]/50'
                        }
                      >
                        {name}
                      </button>
                    </span>
                  );
                })}
              </div>
            );

            return (
              <>
                <div className="mb-0 flex w-full flex-col gap-1.5 rounded-xl border border-[var(--malts-hairline)] bg-[var(--malts-inset)]/50 px-3 py-2.5 lg:hidden">
                  <div className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 shrink text-sm font-semibold text-[var(--malts-ink)]">{sheetTitle}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openCategoryPicker()}
                        className="malts-btn-secondary rounded-md px-2.5 py-1 text-xs font-semibold"
                      >
                        {pickActionLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCategoryPicker()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--malts-subtle)] transition-colors hover:bg-[var(--malts-inset)]"
                        aria-label={openSheetAria}
                      >
                        <span aria-hidden>▼</span>
                      </button>
                    </div>
                  </div>
                  {categoryPath.length > 0 ? (
                    renderPathSegmentButtons('mobile')
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCategoryPicker()}
                      className="w-full rounded-lg border border-dashed border-[var(--malts-hairline)] bg-transparent px-2 py-1.5 text-left text-xs font-medium text-[var(--malts-subtle)] transition-colors hover:border-[var(--malts-accent)]/35 hover:bg-[var(--malts-card)]/40 hover:text-[var(--malts-muted)]"
                    >
                      {locale === 'bg'
                        ? 'Избери категория'
                        : locale === 'en'
                          ? 'Choose category'
                          : 'Alege categoria'}
                    </button>
                  )}
                </div>

                {categorySheetOpen && typeof document !== 'undefined'
                  ? createPortal(
                      <>
                        {/*
                          Portal към body: иначе fixed е trapped от родител с backdrop-filter и изглежда „под“ sticky хедъра.
                        */}
                        <button
                          type="button"
                          className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] lg:hidden"
                          aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
                          onClick={() => setCategorySheetOpen(false)}
                        />
                        <div
                          ref={categorySheetPanelRef}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="order-category-sheet-title"
                          className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[min(calc(100dvh-7.5rem),540px)] flex-col rounded-t-2xl border border-[var(--malts-hairline)] border-b-0 bg-[var(--malts-card)] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] lg:hidden"
                        >
                      <div className="flex shrink-0 flex-col items-center pt-2">
                        <div className="h-1 w-12 rounded-full bg-[var(--malts-hairline)]" aria-hidden />
                      </div>
                      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--malts-hairline)] px-4 pb-3 pt-2">
                        <div className="min-w-0 flex-1">
                          <p id="order-category-sheet-title" className="text-base font-bold text-[var(--malts-ink)]">
                            {sheetTitle}
                          </p>
                          {categoryPath.length > 0 ? (
                            <div className="mt-0.5">{renderPathSegmentButtons('sheet')}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCategorySheetOpen(false)}
                          className="malts-btn-secondary shrink-0 rounded-lg px-3 py-1.5 text-lg leading-none"
                          aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
                        >
                          ×
                        </button>
                      </div>
                      <div
                        data-modal-scroll
                        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
                      >
                        {Array.from({ length: MALLS_MAX_CATEGORY_DEPTH }, (_, depth) =>
                          renderTierRow(
                            depth,
                            depth === 0
                              ? 'overflow-x-auto pb-1 [scrollbar-width:thin]'
                              : depth >= 2
                                ? 'overflow-x-auto border-t border-[var(--malts-hairline)]/60 pt-2 [scrollbar-width:thin]'
                                : 'overflow-x-auto border-t border-[var(--malts-hairline)]/60 pt-2 [scrollbar-width:thin]',
                            `flex min-w-max justify-start ${depth === 0 ? 'gap-2' : 'gap-1.5'} sm:gap-2`,
                            { closeCategorySheet: true, markHorizontalTier: true }
                          )
                        )}
                      </div>
                    </div>
                      </>,
                      document.body
                    )
                  : null}

                <div className="hidden space-y-3 lg:block">
                  {Array.from({ length: MALLS_MAX_CATEGORY_DEPTH }, (_, depth) =>
                    renderTierRow(
                      depth,
                      depth === 0 ? 'mb-3' : depth >= 2 ? 'mt-3' : '',
                      `mx-auto flex max-w-6xl flex-wrap justify-center ${depth === 0 ? 'gap-3' : 'gap-2'}`
                    )
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Menu */}
      <div className="container mx-auto px-4 py-8">
        {(() => {
          if (categoryProducts.length === 0) {
            return (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🔍</div>
                <button
                  type="button"
                  onClick={() => openCategoryPicker()}
                  className="malts-muted hover:text-[var(--malts-ink)] mx-auto max-w-xl text-balance text-xl underline-offset-4 transition-colors hover:underline"
                >
                  {needsDeeperDrillOrder
                    ? categoryPath.length === 1
                      ? locale === 'bg'
                        ? 'Избери подкатегория, за да видиш продуктите'
                        : locale === 'en'
                          ? 'Choose a subcategory to see products'
                          : 'Alege o subcategorie pentru a vedea produsele'
                      : locale === 'bg'
                        ? 'Избери под-подкатегория, за да видиш продуктите'
                        : locale === 'en'
                          ? 'Choose a sub-subcategory to see products'
                          : 'Alege sub-subcategoria pentru a vedea produsele'
                    : locale === 'bg'
                      ? 'Няма продукти в тази категория'
                      : locale === 'en'
                        ? 'No products in this category'
                        : 'Nu există produse în această categorie'}
                </button>
              </div>
            );
          }
          
          // Get category name for display
          const currentCategory = categories.find((c: any) => c.id === displayCategoryId);
          const categoryName = currentCategory 
            ? (locale === 'bg' ? currentCategory.nameBg : locale === 'en' ? currentCategory.nameEn : currentCategory.nameRo)
            : '';
          
          return (
            <div className="mb-8">
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 w-8 bg-[var(--malts-accent)] rounded-full"></div>
                <h2 className="text-3xl md:text-4xl font-bold text-[var(--malts-ink)]">{categoryName}</h2>
                <div className="flex-1 h-px bg-[var(--malts-hairline)]"></div>
              </div>
              
              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {categoryProducts.map((product: any) => {
                  const productName = locale === 'bg' ? product.nameBg : locale === 'en' ? product.nameEn : product.nameRo;
                  return (
                    <div
                      key={product.id}
                      className="group relative malts-card rounded-2xl overflow-hidden hover:border-[var(--malts-accent-tint-border)] hover:shadow-lg transition-all duration-300"
                    >
                      {product.isPromoted && (
                        <div className="absolute top-3 left-3 z-10 bg-[var(--malts-accent)] text-[#f5f0e6] px-2.5 py-1 rounded-full text-xs font-bold shadow-lg">
                          {locale === 'bg' ? 'Промо' : locale === 'en' ? 'Promo' : 'Promo'}
                        </div>
                      )}
                      {/* Product Image */}
                      {product.imageUrl && (
                        <div className="relative h-56 w-full overflow-hidden bg-[var(--malts-inset)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl}
                            alt={productName}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                      )}
                      
                      {/* Product Info */}
                      <div
                        className={`p-4 ${product.isPromoted && !product.imageUrl ? 'pt-11' : ''}`}
                      >
                        <h3 className="mb-3 text-xl font-bold leading-snug text-[var(--malts-ink)] transition-colors group-hover:text-[var(--malts-accent)] md:text-xl">
                          {productName}
                        </h3>
                        
                        {product.descriptionBg || product.descriptionEn || product.descriptionRo ? (
                          <p className="malts-muted text-sm mb-4 leading-relaxed break-words whitespace-pre-wrap">
                            {locale === 'bg' && product.descriptionBg ? product.descriptionBg :
                             locale === 'en' && product.descriptionEn ? product.descriptionEn :
                             locale === 'ro' && product.descriptionRo ? product.descriptionRo :
                             product.descriptionBg || product.descriptionEn || product.descriptionRo}
                          </p>
                        ) : null}
                      
                        <div className="flex justify-between items-end gap-2 border-t border-[var(--malts-hairline)] pt-4">
                          <div className="flex min-w-0 flex-col items-start gap-0.5">
                            {product.basePriceBgn != null && (
                              <span className="inline-block text-xs text-[var(--malts-subtle)] line-through md:text-sm">
                                <Price
                                  priceBgn={Number(product.basePriceBgn)}
                                  inline
                                  className="text-[var(--malts-subtle)]"
                                />
                              </span>
                            )}
                            <Price
                              priceBgn={Number(product.priceBgn)}
                              className="text-sm font-semibold text-[var(--malts-ink)] md:text-lg lg:text-xl md:font-bold"
                              showBoth={true}
                              inline={true}
                              unit={product.unit}
                              quantity={product.quantity}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all malts-btn-primary md:px-6 md:py-2 md:text-base"
                          >
                            {locale === 'bg' ? '+ Добави' : locale === 'en' ? '+ Add' : '+ Adaugă'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
          <div className="malts-card rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--malts-hairline)] flex justify-between items-center sticky top-0 bg-[var(--malts-card)]/95 backdrop-blur-sm">
              <h2 className="text-2xl font-bold">
                {locale === 'bg' ? 'Вашата поръчка' : locale === 'en' ? 'Your Order' : 'Comanda ta'}
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-[var(--malts-ink)] text-3xl hover:text-[var(--malts-accent)]"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {cart.length === 0 ? (
                <p className="malts-muted text-center py-8">
                  {locale === 'bg' ? 'Количката е празна' : locale === 'en' ? 'Cart is empty' : 'Coșul este gol'}
                </p>
              ) : (
                <>
                  {/* Approval Banner in Cart Modal */}
                  {requiresApproval && (
                    <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div className="flex-1">
                          <p className="font-semibold text-lg mb-2 text-yellow-200">
                            {locale === 'bg' ? 'Поръчката изисква одобрение' : 
                             locale === 'en' ? 'Order requires approval' : 
                             'Comanda necesită aprobare'}
                          </p>
                          <p className="text-sm mb-2 text-yellow-100">
                            {locale === 'bg' 
                              ? `Направени са ${approvalThresholdValue} поръчки за последните ${approvalWindowValue} минути. Заради съображения за сигурност и превантивно действие при потенциално неправомерни действия и хакерски атаки, тази поръчка изисква одобрение.`
                              : locale === 'en'
                              ? `${approvalThresholdValue} orders have been placed in the last ${approvalWindowValue} minutes. Due to security concerns and preventive action against potentially unauthorized actions and hacking attacks, this order requires approval.`
                              : `Au fost plasate ${approvalThresholdValue} comenzi în ultimele ${approvalWindowValue} minute. Din motive de securitate și ca măsură preventivă împotriva acțiunilor neautorizate și a atacurilor, această comandă necesită aprobare.`}
                          </p>
                          {approvalStatus === 'pending' && (
                            <p className="text-sm font-medium text-yellow-200">
                              {locale === 'bg' 
                                ? '⏳ Очакване на одобрение от администратор...'
                                : locale === 'en'
                                ? '⏳ Waiting for admin approval...'
                                : '⏳ Se așteaptă aprobarea administratorului...'}
                            </p>
                          )}
                          {approvalStatus === 'approved' && (
                            <p className="text-sm font-medium text-green-300">
                              {locale === 'bg' 
                                ? '✅ Поръчката е одобрена!'
                                : locale === 'en'
                                ? '✅ Order approved!'
                                : '✅ Comanda a fost aprobată!'}
                            </p>
                          )}
                          {approvalStatus === 'rejected' && (
                            <p className="text-sm font-medium text-red-300">
                              {locale === 'bg' 
                                ? '❌ Поръчката е отхвърлена'
                                : locale === 'en'
                                ? '❌ Order rejected'
                                : '❌ Comanda a fost respinsă'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-6">
                    {cart.map(item => {
                      const itemName = locale === 'bg' ? item.nameBg : locale === 'en' ? item.nameEn : item.nameRo;
                      return (
                      <div key={item.productId} className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{itemName}</h4>
                          {item.unit && item.productQuantity && (
                            <span className="text-sm malts-muted">
                              {item.productQuantity} {item.unit === 'pcs' ? 'бр.' : item.unit}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="malts-muted">
                            <Price priceBgn={item.priceBgn} inline className="malts-muted" />
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="w-8 h-8 bg-[var(--malts-card)] hover:bg-[var(--malts-card-hover)] border border-[var(--malts-hairline)] rounded-lg font-bold"
                            >
                              −
                            </button>
                            <span className="font-bold w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="w-8 h-8 malts-btn-primary rounded-lg font-bold"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="ml-2 text-[var(--malts-danger)]"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-[var(--malts-hairline)] pt-4 mb-6">
                    <div className="flex justify-between items-center text-xl font-bold">
                      <span>{locale === 'bg' ? 'Общо:' : locale === 'en' ? 'Total:' : 'Total:'}</span>
                      <Price priceBgn={cartTotal} className="text-2xl" />
                    </div>
                  </div>

                  <button
                    onClick={submitOrder}
                    disabled={submitting || cart.length === 0}
                    className="w-full px-8 py-4 malts-btn-primary disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                        <span>{locale === 'bg' ? 'Изпращане...' : locale === 'en' ? 'Sending...' : 'Se trimite...'}</span>
                      </>
                    ) : (
                      <>
                        ✅ {locale === 'bg' ? 'Изпрати поръчка' : locale === 'en' ? 'Send Order' : 'Trimite comanda'}
                      </>
                    )}
                  </button>

                  <p className="malts-muted text-sm text-center mt-4">
                    {locale === 'bg' ? 'Поръчката ще бъде изпратена към персонала' : 
                     locale === 'en' ? 'Order will be sent to staff' : 
                     'Comanda va fi trimisă către personal'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Call Waiter Button */}
      {tableNumber && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] md:left-auto md:right-4">
          <a
            href={`/${locale}/order/call-waiter?table=${tableNumber}`}
            className="block w-full rounded-xl px-6 py-3 text-center text-base font-bold shadow-2xl transition-all malts-btn-danger md:w-auto md:px-8 md:py-4 md:text-lg"
          >
            🔔 {locale === 'bg' ? 'Повикай сервитьор' : 
                 locale === 'en' ? 'Call Waiter' : 
                 'Cheamă chelnerul'}
          </a>
        </div>
      )}

      {sessionStatus !== 'valid' && (
        <div className="fixed inset-0 z-[60] bg-[var(--malts-paper)]/85 backdrop-blur-md px-6 flex items-center justify-center text-center">
          <div className="max-w-2xl">
            <div className="text-6xl mb-6">
              {sessionStatus === 'checking' ? '🔄' : '🔒'}
            </div>
            <h2 className="text-3xl font-bold mb-4">{sessionOverlayTitle}</h2>
            <p className="malts-muted text-lg mb-8 whitespace-pre-line">
              {sessionOverlayBody}
            </p>

            {sessionStatus === 'invalid' ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => validateSession()}
                  className="px-6 py-3 malts-btn-primary rounded-xl font-semibold transition-all"
                >
                  🔄 {locale === 'bg' ? 'Провери отново' : locale === 'en' ? 'Check again' : 'Verifică din nou'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 malts-btn-secondary rounded-xl font-semibold transition-all"
                >
                  ↻ {locale === 'bg' ? 'Обнови страницата' : locale === 'en' ? 'Refresh page' : 'Reîncarcă pagina'}
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-[var(--malts-accent)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function OrderPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  
  return (
    <Suspense fallback={<LoadingScreen locale={locale} />}>
      <OrderPageContent />
    </Suspense>
  );
}


