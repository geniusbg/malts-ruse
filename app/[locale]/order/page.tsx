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
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';
import { useLockScroll } from '@/lib/use-lock-scroll';
import ChefsPicksCarousel from '@/components/ChefsPicksCarousel';
import OrderTierHorizontalScroll from '@/components/OrderTierHorizontalScroll';
import OfferingCardIcon from '@/components/OfferingCardIcon';
import { formatDateForLocale } from '@/lib/date-utils';
import { eventCardImageUrl, eventDetailImageUrl } from '@/lib/event-images';
import { Rampart_One } from 'next/font/google';
import type { PromotionsUiSettings } from '@/lib/promotions-ui-settings';
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
  variantLabel?: string | null;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  priceBgn: number;
  quantity: number;
  unit?: string;
  productQuantity?: number;
}

const rampartOne = Rampart_One({ weight: '400', subsets: ['latin'] });

function OrderPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialTableNumber = searchParams.get('table');
  const [tableNumber, setTableNumber] = useState<string | null>(initialTableNumber);
  
  // Get locale from URL path
  const locale = pathname.split('/')[1] || 'bg';

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [homepageSettings, setHomepageSettings] = useState<any | null>(null);
  const [homepageCards, setHomepageCards] = useState<any[]>([]);
  const [upcomingEventsPreview, setUpcomingEventsPreview] = useState<any[]>([]);
  const [orderLocationSettings, setOrderLocationSettings] = useState<any | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [eventDetailModal, setEventDetailModal] = useState<any | null>(null);
  const [promotionsUiSettings, setPromotionsUiSettings] = useState<PromotionsUiSettings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [variantPicker, setVariantPicker] = useState<{
    open: boolean;
    product: any | null;
    options: string[];
    selected: string | null;
  }>({ open: false, product: null, options: [], selected: null });
  const [showCart, setShowCart] = useState(false);
  /** Мобилен bottom sheet за избор на категория (под lg). */
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  /** Кратък accent около лентата с раздели / sheet при „Избери“ / „Разгледай менюто“. */
  const [categoryNavHighlight, setCategoryNavHighlight] = useState(false);
  const categorySheetPanelRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [loadProgress, setLoadProgress] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; persistent?: boolean } | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  
  // Lock scroll when cart, session gate, or other full-screen overlays are open
  useLockScroll(
    showCart ||
      sessionStatus !== 'valid' ||
      categorySheetOpen ||
      contactModalOpen ||
      eventDetailModal !== null
  );
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

  const [publicOps, setPublicOps] = useState<{
    ordersEnabled: boolean;
    waiterCallEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/operational-settings/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) =>
        setPublicOps({
          ordersEnabled: d.ordersEnabled !== false,
          waiterCallEnabled: d.waiterCallEnabled !== false,
        })
      )
      .catch(() => setPublicOps({ ordersEnabled: true, waiterCallEnabled: true }));
  }, []);

  useEffect(() => {
    if (publicOps && !publicOps.ordersEnabled) {
      setCart([]);
      setShowCart(false);
    }
  }, [publicOps]);

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

  /** Мобилен: bottom sheet; всички: скрол до лентата (scroll-mt компенсира sticky хедъра). */
  const openCategoryPicker = useCallback(() => {
    if (typeof window === 'undefined') return;

    const navEl = document.getElementById('order-category-nav');
    if (navEl) {
      requestAnimationFrame(() => {
        navEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    const endHighlight = () => window.setTimeout(() => setCategoryNavHighlight(false), 2600);

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (!isDesktop) {
      setCategorySheetOpen(true);
      // Следващ кадър(ове): sheet + чиповете са в DOM, иначе анимацията стартира „върху празно“.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCategoryNavHighlight(true);
          endHighlight();
        });
      });
    } else {
      setCategoryNavHighlight(true);
      endHighlight();
    }
  }, []);

  /** След избор в bottom sheet: продуктите са в секцията „Меню“ — скрол там (мобилен). */
  const scrollOrderProductsSectionIntoView = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    window.setTimeout(() => {
      document.getElementById('order-products-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
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
        const homepageRes = fetch('/api/homepage-settings');
        const eventsRes = fetch('/api/events?published=true');
        const promoUiRes = fetch('/api/promotions-ui-settings');
        const locationRes = fetch('/api/location-settings');
        setLoadProgress(85);

        const [categoriesData, productsData, homepageData, eventsData, promoUiData, locationData] =
          await Promise.all([
            categoriesRes.json(),
            productsRes.json(),
            homepageRes.then((r) => r.json()).catch(() => null),
            eventsRes.then((r) => r.json()).catch(() => null),
            promoUiRes.then((r) => r.json()).catch(() => null),
            locationRes.then((r) => r.json()).catch(() => null),
          ]);

        const rawCats: any[] = categoriesData.categories || [];
        const cats = rawCats.map(normalizeCategoryRow);
        setCategories(cats);
        setProducts(productsData.products || []);

        // IMPORTANT: no default selected root category (user must pick).
        setCategoryPath([]);

        if (homepageData?.settings) {
          setHomepageSettings(homepageData.settings);
          setHomepageCards(Array.isArray(homepageData.cards) ? homepageData.cards : []);
        }

        if (locationData?.settings) {
          setOrderLocationSettings(locationData.settings);
        }

        if (eventsData?.events && Array.isArray(eventsData.events)) {
          const now = Date.now();
          const upcoming = eventsData.events
            .filter((e: any) => !!e?.eventDate && new Date(e.eventDate).getTime() >= now)
            .sort(
              (a: any, b: any) =>
                new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
            );
          setUpcomingEventsPreview(upcoming);
        }

        if (promoUiData?.settings) {
          setPromotionsUiSettings(promoUiData.settings);
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

  const highlightsLabel =
    locale === 'bg'
      ? homepageSettings?.highlightsLabelBg ?? 'Акценти'
      : locale === 'en'
        ? homepageSettings?.highlightsLabelEn ?? 'Highlights'
        : homepageSettings?.highlightsLabelRo ?? 'Accente';

  const promotionsHeading =
    locale === 'bg'
      ? promotionsUiSettings?.titleBg ?? 'Промоция'
      : locale === 'en'
        ? promotionsUiSettings?.titleEn ?? 'Promotion'
        : promotionsUiSettings?.titleRo ?? 'Promoție';

  const cardsHeading =
    locale === 'bg'
      ? homepageSettings?.cardsHeadingBg ?? ''
      : locale === 'en'
        ? homepageSettings?.cardsHeadingEn ?? ''
        : homepageSettings?.cardsHeadingRo ?? '';

  const addToCart = (product: any) => {
    if (publicOps && !publicOps.ordersEnabled) return;
    const variantsRaw = Array.isArray(product?.variants) ? product.variants : [];
    const variants = variantsRaw
      .map((v: any) => {
        if (typeof v === 'string') {
          const label = String(v || '').trim();
          return label ? { label, enabled: true } : null;
        }
        const label = String(v?.label ?? v?.name ?? '').trim();
        if (!label) return null;
        const enabled = v?.enabled !== false;
        return { label, enabled };
      })
      .filter(Boolean)
      .filter((v: any) => v.enabled)
      .map((v: any) => v.label) as string[];
    if (variants.length > 0) {
      setVariantPicker({
        open: true,
        product,
        options: variants,
        selected: variants[0] || null,
      });
      return;
    }
    if (variantsRaw.length > 0 && variants.length === 0) {
      const productName = locale === 'bg' ? product.nameBg : locale === 'en' ? product.nameEn : product.nameRo;
      setToast({
        message:
          locale === 'bg'
            ? `Няма налични варианти за ${productName}`
            : locale === 'en'
              ? `No available variants for ${productName}`
              : `Nu există variante disponibile pentru ${productName}`,
        type: 'error',
      });
      return;
    }
    addToCartResolved(product, null);
  };

  const addToCartResolved = (product: any, variantLabel: string | null) => {
    if (publicOps && !publicOps.ordersEnabled) return;
    setCart(prev => {
      const existing = prev.find(
        (item) => item.productId === product.id && String(item.variantLabel || '') === String(variantLabel || '')
      );
      if (existing) {
        return prev.map(item =>
          item.productId === product.id && String(item.variantLabel || '') === String(variantLabel || '')
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        variantLabel,
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
    const suffix = variantLabel ? ` (${variantLabel})` : '';
    setToast({
      message: `${productName}${suffix} ${locale === 'bg' ? 'добавено в кошницата' : locale === 'en' ? 'added to cart' : 'adăugat în coș'}`,
      type: 'success'
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number, variantLabel?: string | null) => {
    if (quantity <= 0) {
      setCart((prev) =>
        prev.filter(
          (item) =>
            !(item.productId === productId && String(item.variantLabel || '') === String(variantLabel || ''))
        )
      );
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.productId === productId && String(item.variantLabel || '') === String(variantLabel || '')
          ? { ...item, quantity }
          : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.priceBgn * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const PROMOTIONS_ROOT_ID = '__promotions__';
  const hasActivePromotions = useMemo(() => products.some((p: any) => !!p?.isPromoted), [products]);
  const isPromotionsMode = categoryPath[0] === PROMOTIONS_ROOT_ID;

  const parentCategories = useMemo(
    () =>
      categories
        .filter((c: any) => !c.parentCategoryId)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  const rootTierItems = useMemo(() => {
    if (!hasActivePromotions) return parentCategories;
    return [
      ...parentCategories,
      {
        id: PROMOTIONS_ROOT_ID,
        nameBg: 'Промоции',
        nameEn: 'Promotions',
        nameRo: 'Promoții',
        parentCategoryId: null,
      },
    ];
  }, [parentCategories, hasActivePromotions]);

  const displayCategoryId = isPromotionsMode ? PROMOTIONS_ROOT_ID : categoryPathLeafId(categoryPath);
  const categoryProducts = isPromotionsMode
    ? products.filter((p: any) => !!p?.isPromoted)
    : products.filter((p: any) => p.categoryId === displayCategoryId);
  const leafIdOrder = isPromotionsMode ? null : categoryPathLeafId(categoryPath);
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
        productName: item.nameBg, // Always use Bulgarian base name for orders
        variantLabel: item.variantLabel || null,
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

  const ordersEnabled = !publicOps || publicOps.ordersEnabled;
  const waiterCallEnabled = !publicOps || publicOps.waiterCallEnabled;

  if (showLoadingScreen) {
    return <ManagedLoadingScreen locale={locale} progress={loading ? loadProgress : undefined} />;
  }

  return (
    <main
      className={`min-h-screen malts-surface ${
        tableNumber && waiterCallEnabled ? 'pb-16 max-md:pb-24 md:pb-8' : 'pb-8'
      }`}
    >
      {/* Variant Picker */}
      {variantPicker.open && variantPicker.product ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-md rounded-2xl border border-[var(--malts-hairline)] bg-[var(--malts-card)] p-5 shadow-2xl">
            <div className="mb-3">
              <div className="text-sm malts-muted">
                {locale === 'bg' ? 'Избери вариант' : locale === 'en' ? 'Choose variant' : 'Alege variantă'}
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--malts-ink)]">
                {locale === 'bg'
                  ? variantPicker.product.nameBg
                  : locale === 'en'
                    ? variantPicker.product.nameEn
                    : variantPicker.product.nameRo}
              </div>
            </div>
            <div className="space-y-2">
              {variantPicker.options.map((opt) => {
                const active = opt === variantPicker.selected;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVariantPicker((p) => ({ ...p, selected: opt }))}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      active
                        ? 'border-[var(--malts-accent)] bg-[var(--malts-accent-tint)] text-[var(--malts-ink)]'
                        : 'border-[var(--malts-hairline)] bg-[var(--malts-paper)] hover:bg-[var(--malts-card-hover)] text-[var(--malts-ink)]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setVariantPicker({ open: false, product: null, options: [], selected: null })}
                className="flex-1 malts-btn-secondary rounded-xl px-4 py-2 font-semibold"
              >
                {locale === 'bg' ? 'Отказ' : locale === 'en' ? 'Cancel' : 'Anulează'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = variantPicker.product;
                  const v = variantPicker.selected;
                  setVariantPicker({ open: false, product: null, options: [], selected: null });
                  addToCartResolved(p, v || null);
                }}
                className="flex-1 malts-btn-primary rounded-xl px-4 py-2 font-semibold"
              >
                {locale === 'bg' ? 'Добави' : locale === 'en' ? 'Add' : 'Adaugă'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <MaltsInlineFeedback tone="warning" className="mt-2" role="status">
                    {locale === 'bg'
                      ? '⏳ Очакване на одобрение от администратор...'
                      : locale === 'en'
                        ? '⏳ Waiting for admin approval...'
                        : '⏳ Se așteaptă aprobarea administratorului...'}
                  </MaltsInlineFeedback>
                )}
                {approvalStatus === 'approved' && (
                  <MaltsInlineFeedback tone="success" className="mt-2" role="status">
                    {locale === 'bg'
                      ? '✅ Поръчката е одобрена!'
                      : locale === 'en'
                        ? '✅ Order approved!'
                        : '✅ Comanda a fost aprobată!'}
                  </MaltsInlineFeedback>
                )}
                {approvalStatus === 'rejected' && (
                  <MaltsInlineFeedback tone="error" className="mt-2" role="alert">
                    {locale === 'bg'
                      ? '❌ Поръчката е отхвърлена'
                      : locale === 'en'
                        ? '❌ Order rejected'
                        : '❌ Comanda a fost respinsă'}
                  </MaltsInlineFeedback>
                )}
                {approvalStatus === 'auto-rejected' && (
                  <MaltsInlineFeedback tone="error" className="mt-2" role="alert">
                    {locale === 'bg'
                      ? `⏱️ Поръчката беше автоматично отхвърлена след ${autoRejectMinutesValue} минути`
                      : locale === 'en'
                        ? `⏱️ Order was automatically rejected after ${autoRejectMinutesValue} minutes`
                        : `⏱️ Comanda a fost respinsă automat după ${autoRejectMinutesValue} minute`}
                  </MaltsInlineFeedback>
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
              className="flex h-[6.25rem] max-h-[6.25rem] min-w-0 shrink-0 items-center overflow-hidden sm:h-[5.75rem] sm:max-h-[5.75rem]"
            >
              <Image
                src="/malts-logo-nav.webp"
                alt="Malt's"
                width={400}
                height={331}
                sizes="(max-width: 640px) 360px, 320px"
                className="malts-brand-filter h-full w-auto max-h-[6.25rem] min-h-0 min-w-0 shrink-0 object-contain object-left sm:max-h-[5.75rem]"
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
                {ordersEnabled && (
                  <button
                    type="button"
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
                )}
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
        className="border-b border-[var(--malts-hairline)] bg-[var(--malts-paper)]/92 py-2 backdrop-blur-lg lg:py-4 scroll-mt-32"
      >
        <div className="container mx-auto px-4">
          {(() => {
            const tierBtnClass = (depth: number, isActive: boolean, sheet: boolean) =>
              sheet
                ? depth === 0
                  ? `rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 whitespace-nowrap sm:px-5 sm:py-3 sm:text-base ${
                      isActive
                        ? 'bg-[var(--malts-accent)] text-[#f5f0e6] shadow-md ring-2 ring-[var(--malts-accent)]/30'
                        : 'border-2 border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:border-[var(--malts-accent)]/40 hover:bg-[var(--malts-card-hover)]'
                    }`
                  : `rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap sm:px-4 sm:py-2.5 sm:text-[15px] ${
                      isActive
                        ? 'border-2 border-[var(--malts-accent)] bg-[var(--malts-accent)] text-[#f5f0e6] shadow-sm'
                        : 'border-2 border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:border-[var(--malts-accent)]/35 hover:bg-[var(--malts-card-hover)]'
                    }`
                : depth === 0
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

            const tierScrollLeftAria =
              locale === 'bg'
                ? 'Покажи предишни раздели'
                : locale === 'en'
                  ? 'Show previous items'
                  : 'Arată elementele anterioare';
            const tierScrollRightAria =
              locale === 'bg'
                ? 'Покажи следващи раздели'
                : locale === 'en'
                  ? 'Show more items'
                  : 'Arată mai multe elemente';

            const renderTierRow = (
              depth: number,
              wrapClass: string,
              flexClass: string,
              opts?: { closeCategorySheet?: boolean; markHorizontalTier?: boolean }
            ) => {
              const tierItems =
                depth === 0
                  ? rootTierItems
                  : isPromotionsMode
                    ? []
                    : categoryPath[depth - 1]
                    ? getChildrenOf(categories, categoryPath[depth - 1]!)
                    : [];
              if (tierItems.length === 0) return null;
              const sheet = !!(opts?.closeCategorySheet && opts?.markHorizontalTier);
              const tierButtons = tierItems.map((cat: any) => {
                const name = locale === 'bg' ? cat.nameBg : locale === 'en' ? cat.nameEn : cat.nameRo;
                const isActive = categoryPath[depth] === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    {...(sheet && isActive ? { 'data-order-tier-active': '' } : {})}
                    onClick={() => {
                      const nextPath =
                        depth === 0 && cat.id === PROMOTIONS_ROOT_ID
                          ? [PROMOTIONS_ROOT_ID]
                          : selectCategoryAtDepth(categoryPath, depth, cat.id);
                      setCategoryPath(nextPath);
                      if (opts?.closeCategorySheet) {
                        const leaf = categoryPathLeafId(nextPath);
                        if (leaf) {
                          const prodsHere = products.filter((p: any) => p.categoryId === leaf);
                          const subcats = getChildrenOf(categories, leaf);
                          if (prodsHere.length > 0 || subcats.length === 0) {
                            setCategorySheetOpen(false);
                            scrollOrderProductsSectionIntoView();
                          }
                        } else if (nextPath[0] === PROMOTIONS_ROOT_ID) {
                          setCategorySheetOpen(false);
                          scrollOrderProductsSectionIntoView();
                        }
                      }
                    }}
                    className={
                      tierBtnClass(depth, isActive, sheet) +
                      (categoryNavHighlight ? ' malts-order-category-btn-blink' : '')
                    }
                  >
                    {name}
                  </button>
                );
              });

              if (sheet) {
                return (
                  <OrderTierHorizontalScroll
                    key={`tier-${depth}`}
                    scrollClassName={wrapClass}
                    rowClassName={flexClass}
                    ariaScrollLeft={tierScrollLeftAria}
                    ariaScrollRight={tierScrollRightAria}
                    centerItemSelector="[data-order-tier-active]"
                  >
                    {tierButtons}
                  </OrderTierHorizontalScroll>
                );
              }

              return (
                <div
                  key={`tier-${depth}`}
                  className={wrapClass}
                  {...(opts?.markHorizontalTier ? { 'data-order-tier-hscroll': true } : {})}
                >
                  <div className={flexClass}>{tierButtons}</div>
                </div>
              );
            };

            const menuPickHeading =
              locale === 'bg'
                ? 'Избери категория от менюто'
                : locale === 'en'
                  ? 'Choose a category from the menu'
                  : 'Alege o categorie din meniu';
            const menuPickHint =
              locale === 'bg'
                ? 'След избор ястията се показват по-долу на страницата.'
                : locale === 'en'
                  ? 'After you pick a section, dishes appear further down the page.'
                  : 'După ce alegi secțiunea, preparatele apar mai jos pe pagină.';
            const pickActionLabel =
              locale === 'bg' ? 'Избери' : locale === 'en' ? 'Choose' : 'Alege';
            const openSheetAria =
              locale === 'bg' ? 'Отвори избор на раздел от менюто' : locale === 'en' ? 'Open menu sections' : 'Deschide secțiunile din meniu';
            const pathScrollLeftAria =
              locale === 'bg' ? 'Покажи предишния път' : locale === 'en' ? 'Scroll path left' : 'Derulează calea la stânga';
            const pathScrollRightAria =
              locale === 'bg' ? 'Покажи следващия път' : locale === 'en' ? 'Scroll path right' : 'Derulează calea la dreapta';

            const renderPathSegmentButtons = (variant: 'mobile' | 'sheet') => {
              const lastIdx = categoryPath.length - 1;
              const segments = categoryPath.map((id, idx) => {
                const c = categories.find((x: any) => x.id === id);
                if (!c) return null;
                const name = locale === 'bg' ? c.nameBg : locale === 'en' ? c.nameEn : c.nameRo;
                const isPathPivot = idx === lastIdx;
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
                      {...(isPathPivot ? { 'data-order-path-pivot': '' } : {})}
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
              });

              return (
                <OrderTierHorizontalScroll
                  scrollClassName="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]"
                  rowClassName="flex min-w-max items-center gap-x-1 gap-y-1"
                  ariaScrollLeft={pathScrollLeftAria}
                  ariaScrollRight={pathScrollRightAria}
                  centerItemSelector="[data-order-path-pivot]"
                >
                  {segments}
                </OrderTierHorizontalScroll>
              );
            };

            return (
              <>
                <div className="mb-0 flex w-full flex-col gap-1.5 rounded-xl border border-[var(--malts-hairline)] bg-[var(--malts-inset)]/50 px-3 py-2.5 lg:hidden">
                  <div className="flex w-full min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="text-base font-bold leading-snug text-[var(--malts-ink)] sm:text-lg">
                        {menuPickHeading}
                      </p>
                    </div>
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
                  <p className="text-[11px] leading-snug text-[var(--malts-muted)] sm:text-xs">{menuPickHint}</p>
                  {categoryPath.length > 0 ? (
                    renderPathSegmentButtons('mobile')
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCategoryPicker()}
                      className="w-full rounded-lg border border-dashed border-[var(--malts-hairline)] bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-[var(--malts-ink)] transition-colors hover:border-[var(--malts-accent)]/35 hover:bg-[var(--malts-card)]/40 sm:text-base"
                    >
                      {menuPickHeading}
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
                          <p id="order-category-sheet-title" className="text-lg font-bold leading-snug text-[var(--malts-ink)] sm:text-xl">
                            {menuPickHeading}
                          </p>
                          <p className="mt-1 text-xs leading-snug text-[var(--malts-muted)] sm:text-sm">{menuPickHint}</p>
                          {categoryPath.length > 0 ? (
                            <div className="mt-2">{renderPathSegmentButtons('sheet')}</div>
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
          const sectionLabel =
              locale === 'bg'
                ? homepageSettings?.sectionLabelBg ?? 'Предложения'
                : locale === 'en'
                  ? homepageSettings?.sectionLabelEn ?? 'Experiences'
                  : homepageSettings?.sectionLabelRo ?? 'Experiențe';
            const offeringsTitle =
              locale === 'bg'
                ? homepageSettings?.titleBg ?? 'Какво предлагаме'
                : locale === 'en'
                  ? homepageSettings?.titleEn ?? 'What We Offer'
                  : homepageSettings?.titleRo ?? 'Ce oferim';
            const offeringsSubtitle =
              locale === 'bg'
                ? homepageSettings?.subtitleBg ?? 'Открий нашето разнообразие'
                : locale === 'en'
                  ? homepageSettings?.subtitleEn ?? 'Discover our variety'
                  : homepageSettings?.subtitleRo ?? 'Descoperă varietatea noastră';
            const offeringsDescription =
              locale === 'bg'
                ? homepageSettings?.descriptionBg
                : locale === 'en'
                  ? homepageSettings?.descriptionEn
                  : homepageSettings?.descriptionRo;
            const offeringsNote =
              locale === 'bg'
                ? homepageSettings?.offeringsNoteBg
                : locale === 'en'
                  ? homepageSettings?.offeringsNoteEn
                  : homepageSettings?.offeringsNoteRo;
            const stats: { label: string; value: string }[] =
              (locale === 'bg'
                ? homepageSettings?.stats?.bg
                : locale === 'en'
                  ? homepageSettings?.stats?.en
                  : homepageSettings?.stats?.ro) ?? [];

            const cards =
              homepageCards.length > 0
                ? homepageCards.map((card: any) => ({
                    id: card.id,
                    icon: card.icon,
                    title:
                      locale === 'bg'
                        ? card.titleBg
                        : locale === 'en'
                          ? card.titleEn
                          : card.titleRo,
                    description:
                      locale === 'bg'
                        ? card.descriptionBg
                        : locale === 'en'
                          ? card.descriptionEn
                          : card.descriptionRo,
                    highlights:
                      locale === 'bg'
                        ? card.highlights?.bg ?? []
                        : locale === 'en'
                          ? card.highlights?.en ?? []
                          : card.highlights?.ro ?? [],
                    badge:
                      locale === 'bg'
                        ? card.badgeBg
                        : locale === 'en'
                          ? card.badgeEn
                          : card.badgeRo,
                  }))
                : [];

            const featuredProducts = products.filter((p: any) => p?.isFeatured);
            const promotedProducts = products.filter((p: any) => !!p?.isPromoted);

            // Get category name for display (when a category with products is selected)
            const currentCategory = isPromotionsMode ? null : categories.find((c: any) => c.id === displayCategoryId);
            const categoryName = isPromotionsMode
              ? (locale === 'bg' ? 'Промоции' : locale === 'en' ? 'Promotions' : 'Promoții')
              : currentCategory
                ? (locale === 'bg'
                    ? currentCategory.nameBg
                    : locale === 'en'
                      ? currentCategory.nameEn
                      : currentCategory.nameRo)
                : '';

            return (
              <div
                id="order-products-section"
                className="pb-10 scroll-mt-28 md:scroll-mt-32"
              >
                {categoryProducts.length === 0 ? (
                  <div className="text-center pt-8 pb-6 md:pt-10 md:pb-8">
                    <div className="text-6xl mb-2">🔍</div>
                    <button
                      type="button"
                      onClick={() => openCategoryPicker()}
                      className="malts-muted hover:text-[var(--malts-ink)] mx-auto max-w-xl text-balance text-xl underline-offset-4 transition-colors hover:underline"
                    >
                      {categoryPath.length === 0
                        ? locale === 'bg'
                          ? 'Изберете раздел от менюто, за да разгледате предложенията ни.'
                          : locale === 'en'
                            ? 'Pick a menu section above to explore what we serve.'
                            : 'Alege o secțiune din meniu pentru a vedea oferta noastră.'
                        : needsDeeperDrillOrder
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
                    <div className="mt-5 flex justify-center">
                      <Image
                        src="/malts-logo-hero.webp"
                        alt="Malt's"
                        width={320}
                        height={311}
                        className="malts-brand-filter h-auto w-[210px] max-w-[70vw] object-contain opacity-95"
                        priority={false}
                      />
                    </div>
                  </div>
                ) : null}

                {categoryProducts.length > 0 ? (
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
                        const variantsRaw = Array.isArray(product?.variants) ? product.variants : [];
                        const variants = variantsRaw
                          .map((v: any) => (typeof v === 'string' ? v : (v?.label ?? v?.name ?? '')))
                          .map((s: any) => String(s || '').trim())
                          .filter(Boolean);
                        return (
                          <div
                            key={product.id}
                            className="group relative malts-card rounded-2xl overflow-hidden hover:border-[var(--malts-accent-tint-border)] hover:shadow-lg transition-all duration-300"
                          >
                            {product.isPromoted && (
                              <div className="absolute top-3 left-3 z-10 bg-[var(--malts-accent)] text-[#f5f0e6] px-2.5 py-1 rounded-full text-xs font-bold shadow-lg">
                                {product.promotionLabel?.trim()
                                  ? product.promotionLabel
                                  : locale === 'bg'
                                    ? 'Промо'
                                    : locale === 'en'
                                      ? 'Promo'
                                      : 'Promo'}
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
                              {variants.length > 0 ? (
                                <div className="-mt-2 mb-3">
                                  <div className="flex flex-wrap gap-2">
                                    {variants.map((v: string) => (
                                      <span
                                        key={v}
                                        className="inline-flex items-center rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-3 py-1.5 text-sm font-semibold text-[var(--malts-ink)]"
                                      >
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {product.descriptionBg || product.descriptionEn || product.descriptionRo ? (
                                <p className="malts-muted text-sm mb-4 leading-relaxed break-words whitespace-pre-wrap">
                                  {locale === 'bg' && product.descriptionBg ? product.descriptionBg :
                                   locale === 'en' && product.descriptionEn ? product.descriptionEn :
                                   locale === 'ro' && product.descriptionRo ? product.descriptionRo :
                                   product.descriptionBg || product.descriptionEn || product.descriptionRo}
                                </p>
                              ) : null}

                              {(
                                (locale === 'bg' ? product.allergensBg : locale === 'en' ? product.allergensEn : product.allergensRo) ||
                                ''
                              ).trim() ? (
                                <div className="mb-4">
                                  <div className="text-[11px] uppercase tracking-wide malts-muted mb-1">
                                    {locale === 'bg' ? 'Алергени' : locale === 'en' ? 'Allergens' : 'Alergeni'}
                                  </div>
                                  <p className="text-sm text-[var(--malts-ink)]/85 leading-relaxed whitespace-pre-line break-words">
                                    {locale === 'bg'
                                      ? product.allergensBg
                                      : locale === 'en'
                                        ? product.allergensEn
                                        : product.allergensRo}
                                  </p>
                                </div>
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
                                {ordersEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() => addToCart(product)}
                                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all malts-btn-primary md:px-6 md:py-2 md:text-base"
                                  >
                                    {locale === 'bg' ? '+ Добави' : locale === 'en' ? '+ Add' : '+ Adaugă'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-10 flex justify-center lg:hidden">
                      <button
                        type="button"
                        onClick={() => openCategoryPicker()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--malts-hairline)] bg-[var(--malts-card)] px-6 py-3 text-sm font-semibold text-[var(--malts-ink)] shadow-sm transition hover:border-[var(--malts-accent)]/50 hover:bg-[var(--malts-card-hover)] sm:px-8 sm:text-base"
                      >
                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h10M4 18h16"
                          />
                        </svg>
                        {locale === 'bg'
                          ? 'Избери друга категория от менюто'
                          : locale === 'en'
                            ? 'Choose another category from the menu'
                            : 'Alege altă categorie din meniu'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Homepage-like sections (1:1) shown after category picker */}
                <div>
                  {/* Offerings Section */}
                  {homepageSettings && (
                    <section className="mt-10 md:mt-14 relative">
                      <div className="relative overflow-hidden malts-card px-6 py-10 md:px-16 md:py-14">
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute -top-24 right-0 w-72 h-72 bg-[var(--malts-accent-tint)] blur-3xl opacity-60"></div>
                          <div className="absolute -bottom-10 left-10 w-56 h-56 bg-[rgba(22,101,52,0.10)] blur-3xl opacity-60"></div>
                        </div>

                        <div className="relative flex flex-col items-center text-center max-w-4xl mx-auto">
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-base md:text-lg lg:text-xl font-semibold uppercase tracking-[0.18em] md:tracking-[0.22em] text-[var(--malts-accent)] bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] malts-section-label-font">
                            {sectionLabel}
                          </span>
                          <h2 className="mt-6 text-3xl md:text-5xl font-semibold tracking-tight malts-display">
                            {offeringsTitle}
                          </h2>
                          <p className="mt-4 text-lg md:text-xl malts-muted malts-display-secondary">
                            {offeringsSubtitle}
                          </p>
                          {offeringsDescription ? (
                            <p className="mt-6 text-base md:text-lg malts-muted leading-relaxed max-w-3xl whitespace-pre-line">
                              {offeringsDescription}
                            </p>
                          ) : null}
                          {offeringsNote ? (
                            <p className="mt-8 text-lg md:text-xl font-light italic max-w-3xl malts-muted whitespace-pre-line">
                              {offeringsNote}
                            </p>
                          ) : null}
                        </div>

                        {stats.length > 0 && (
                          <div className="relative mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {stats.map((stat) => (
                              <div
                                key={stat.label}
                                className="rounded-2xl border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-6 py-5 text-center"
                              >
                                <div className="text-3xl md:text-4xl font-semibold">{stat.value}</div>
                                <div className="mt-2 text-sm uppercase tracking-[0.2em] malts-subtle">
                                  {stat.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Promotions cards (only when there is at least one active promotion) */}
                        {promotedProducts.length > 0 && (
                          <div className="relative mt-12">
                            <div className="mb-6 text-center">
                              <p
                                className={`text-3xl md:text-4xl tracking-wide text-[#c41e3a] animate-pulse drop-shadow-[0_8px_18px_rgba(196,30,58,0.30)] ${rampartOne.className}`}
                              >
                                {promotionsHeading}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                              {promotedProducts.map((p: any) => {
                                const name =
                                  locale === 'bg' ? p.nameBg : locale === 'en' ? p.nameEn : p.nameRo;
                                const desc =
                                  locale === 'bg'
                                    ? p.descriptionBg
                                    : locale === 'en'
                                      ? p.descriptionEn
                                      : p.descriptionRo;
                                const variantsRaw = Array.isArray(p?.variants) ? p.variants : [];
                                const variants = variantsRaw
                                  .map((v: any) => (typeof v === 'string' ? v : (v?.label ?? v?.name ?? '')))
                                  .map((s: any) => String(s || '').trim())
                                  .filter(Boolean);
                                return (
                                  <div key={p.id} className="group malts-card rounded-2xl overflow-hidden relative">
                                    <div className="absolute top-4 left-3 z-10 bg-[var(--malts-accent)] text-[#f5f0e6] px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                                      {p.promotionLabel?.trim()
                                        ? p.promotionLabel
                                        : locale === 'bg'
                                          ? 'Промо'
                                          : 'Promo'}
                                    </div>
                                    {p.imageUrl ? (
                                      <div className="relative h-48 w-full overflow-hidden bg-[var(--malts-inset)]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={p.imageUrl}
                                          alt={name}
                                          loading="lazy"
                                          decoding="async"
                                          className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                        />
                                      </div>
                                    ) : null}
                                    <div className="p-4">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-[var(--malts-ink)] truncate">{name}</p>
                                        {variants.length > 0 ? (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {variants.map((v: string) => (
                                              <span
                                                key={v}
                                                className="inline-flex items-center rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-3 py-1.5 text-sm font-semibold text-[var(--malts-ink)]"
                                              >
                                                {v}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                        {desc ? (
                                          <p className="mt-2 text-xs malts-muted whitespace-pre-line">{desc}</p>
                                        ) : null}
                                      </div>
                                        <div className="mt-3 flex items-end justify-between gap-3">
                                        <div className="min-w-0">
                                          {p.basePriceBgn != null && (
                                            <div className="text-xs text-[var(--malts-subtle)] line-through">
                                              <Price priceBgn={Number(p.basePriceBgn)} inline />
                                            </div>
                                          )}
                                            <div className="text-sm font-semibold text-[var(--malts-ink)] whitespace-nowrap">
                                            <Price
                                              priceBgn={Number(p.priceBgn)}
                                              inline
                                              showBoth
                                              unit={p.unit}
                                              quantity={p.quantity}
                                            />
                                          </div>
                                        </div>
                                        {ordersEnabled ? (
                                          <button
                                            type="button"
                                            onClick={() => addToCart(p)}
                                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all malts-btn-primary"
                                          >
                                            {locale === 'bg' ? '+ Добави' : locale === 'en' ? '+ Add' : '+ Adaugă'}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {cards.length > 0 && (
                          <>
                            {cardsHeading?.trim() ? (
                              <div className="relative mt-10 text-center">
                                <p className="text-2xl md:text-4xl font-semibold tracking-tight malts-display">
                                  {cardsHeading}
                                </p>
                              </div>
                            ) : null}
                            <div className="relative mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {cards.map((card: any) => (
                              <div
                                key={card.id}
                                className="group flex flex-col malts-card p-6 md:p-7 hover:-translate-y-[6px] transition-all duration-300"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="relative group/icon">
                                    <div className="absolute inset-0 w-16 h-16 rounded-full bg-[var(--malts-accent-tint)] blur-md transition-all duration-300 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"></div>
                                    <div className="relative w-16 h-16 rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] flex items-center justify-center transition-all duration-300">
                                      <div className="flex items-center justify-center transform group-hover/icon:scale-110 transition-transform duration-300">
                                        <OfferingCardIcon icon={card.icon} />
                                      </div>
                                    </div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity duration-300 z-10">
                                      <div className="bg-[var(--malts-card)]/92 backdrop-blur-sm border border-[var(--malts-hairline)] rounded-lg px-4 py-2 whitespace-nowrap">
                                        <p className="text-xs text-[var(--malts-ink)] font-medium">
                                          {Array.isArray(card.highlights) ? card.highlights.slice(0, 3).join(' • ') : ''}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--malts-accent)] bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] px-3 py-1 rounded-full transition-colors">
                                    {card.badge}
                                  </span>
                                </div>
                                <h3 className="mt-6 text-2xl font-semibold transition-colors">{card.title}</h3>
                                <p className="mt-3 malts-muted text-sm md:text-base leading-relaxed transition-colors">
                                  {card.description}
                                </p>

                                {Array.isArray(card.highlights) && card.highlights.length > 0 ? (
                                  <div className="mt-6">
                                    <p className="text-xs uppercase tracking-[0.3em] malts-subtle mb-3 transition-colors">
                                      {highlightsLabel}
                                    </p>
                                    <ul className="space-y-2 text-sm md:text-base text-[var(--malts-ink)]">
                                      {card.highlights.map((item: string, index: number) => (
                                        <li
                                          key={`${card.id}-${index}`}
                                          className="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-200"
                                          style={{ transitionDelay: `${index * 50}ms` }}
                                        >
                                          <span className="inline-block h-[2px] w-6 bg-[var(--malts-hairline)] group-hover:bg-[var(--malts-accent-tint-border)] group-hover:w-8 transition-all"></span>
                                          <span className="truncate transition-colors">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            </div>
                          </>
                        )}

                        <div className="relative mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                          <button
                            type="button"
                            onClick={() => openCategoryPicker()}
                            className="inline-flex items-center justify-center gap-2 rounded-full malts-btn-primary px-8 py-3 font-semibold tracking-wide transition"
                          >
                            {locale === 'bg'
                              ? homepageSettings?.ctaPrimaryBg ?? 'Разгледай менюто'
                              : locale === 'en'
                                ? homepageSettings?.ctaPrimaryEn ?? 'View the menu'
                                : homepageSettings?.ctaPrimaryRo ?? 'Vezi meniul'}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setContactModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-full malts-btn-secondary px-8 py-3 font-semibold tracking-wide transition"
                          >
                            {locale === 'bg'
                              ? homepageSettings?.ctaSecondaryBg ?? 'Резервации'
                              : locale === 'en'
                                ? homepageSettings?.ctaSecondaryEn ?? 'Book an evening'
                                : homepageSettings?.ctaSecondaryRo ?? 'Rezervă o seară'}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Chef's Picks Carousel */}
                  {featuredProducts.length > 0 && (
                    <ChefsPicksCarousel
                      products={featuredProducts.map((p: any) => {
                        const cat = categories.find((c: any) => c.id === p.categoryId);
                        return {
                          id: p.id,
                          slug: p.slug,
                          nameBg: p.nameBg,
                          nameEn: p.nameEn,
                          nameRo: p.nameRo,
                          descriptionBg: p.descriptionBg,
                          descriptionEn: p.descriptionEn,
                          descriptionRo: p.descriptionRo,
                          priceBgn: Number(p.priceBgn),
                          quantity: p.quantity ?? 1,
                          unit: p.unit ?? 'pcs',
                          imageUrl: p.imageUrl,
                          categoryId: p.categoryId,
                          categorySlug: cat?.slug ?? '',
                          category: {
                            nameBg: cat?.nameBg ?? '',
                            nameEn: cat?.nameEn ?? '',
                            nameRo: cat?.nameRo ?? '',
                          },
                        };
                      })}
                      locale={locale}
                      orderAddMode
                      hideScrollHint
                      addDisabled={!ordersEnabled}
                      onAddToCart={(mini) => {
                        const full = products.find((x: any) => x.id === mini.id);
                        if (full) addToCart(full);
                      }}
                    />
                  )}

                  {/* Upcoming Events Preview */}
                  {upcomingEventsPreview.length > 0 && (
                    <div className="mt-16 md:mt-24">
                      <div className="mb-10 md:mb-12">
                        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight malts-display mb-2">
                          {locale === 'bg'
                            ? 'Предстоящи събития'
                            : locale === 'en'
                              ? 'Upcoming Events'
                              : 'Evenimente viitoare'}
                        </h2>
                        <p className="text-lg md:text-xl malts-muted malts-display-secondary max-w-3xl">
                          {locale === 'bg'
                            ? "Не пропускайте предстоящи събития — при нас в MALT'S или при наши партньори."
                            : locale === 'en'
                              ? "Don’t miss upcoming events — with us at MALT'S or with our partners."
                              : "Nu ratați evenimentele viitoare — la MALT'S sau la partenerii noștri."}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {upcomingEventsPreview.map((event: any) => {
                          const eventTitle =
                            locale === 'bg' ? event.titleBg : locale === 'en' ? event.titleEn : event.titleRo;
                          const eventDesc =
                            locale === 'bg'
                              ? event.descriptionBg
                              : locale === 'en'
                                ? event.descriptionEn
                                : event.descriptionRo;
                          const eventDate = new Date(event.eventDate);
                          const cardImageSrc = eventCardImageUrl(event);

                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setEventDetailModal(event)}
                              className="group malts-card overflow-hidden transition-all duration-300 transform hover:-translate-y-1 block w-full text-left cursor-pointer"
                            >
                              {cardImageSrc && (
                                <div className="relative h-56 w-full overflow-hidden bg-[var(--malts-inset)]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={cardImageSrc}
                                    alt={eventTitle}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,24,16,0.65)] via-transparent to-transparent opacity-60"></div>
                                </div>
                              )}

                              <div className="p-6">
                                <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] rounded-full w-fit backdrop-blur-sm">
                                  <svg className="w-4 h-4 text-[var(--malts-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-[var(--malts-ink)] text-sm font-medium">
                                    {formatDateForLocale(eventDate, locale as 'bg' | 'en' | 'ro')}
                                  </span>
                                </div>

                                <h3 className="text-xl md:text-2xl font-bold mb-3 transition-colors line-clamp-2">
                                  {eventTitle}
                                </h3>

                                {eventDesc && (
                                  <p className="malts-muted text-sm md:text-base line-clamp-2 mb-4">
                                    {eventDesc}
                                  </p>
                                )}

                                <div className="flex items-center text-[var(--malts-accent)] font-semibold text-sm group-hover:gap-3 gap-2 transition-all">
                                  {locale === 'bg' ? 'Научи повече' : locale === 'en' ? 'Learn more' : 'Află mai mult'}
                                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
        })()}
      </div>

      {/* Cart Modal */}
      {showCart && ordersEnabled && (
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
                            <MaltsInlineFeedback tone="warning" className="mt-2" role="status">
                              {locale === 'bg'
                                ? '⏳ Очакване на одобрение от администратор...'
                                : locale === 'en'
                                  ? '⏳ Waiting for admin approval...'
                                  : '⏳ Se așteaptă aprobarea administratorului...'}
                            </MaltsInlineFeedback>
                          )}
                          {approvalStatus === 'approved' && (
                            <MaltsInlineFeedback tone="success" className="mt-2" role="status">
                              {locale === 'bg'
                                ? '✅ Поръчката е одобрена!'
                                : locale === 'en'
                                  ? '✅ Order approved!'
                                  : '✅ Comanda a fost aprobată!'}
                            </MaltsInlineFeedback>
                          )}
                          {approvalStatus === 'rejected' && (
                            <MaltsInlineFeedback tone="error" className="mt-2" role="alert">
                              {locale === 'bg'
                                ? '❌ Поръчката е отхвърлена'
                                : locale === 'en'
                                  ? '❌ Order rejected'
                                  : '❌ Comanda a fost respinsă'}
                            </MaltsInlineFeedback>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-6">
                    {cart.map(item => {
                      const baseName = locale === 'bg' ? item.nameBg : locale === 'en' ? item.nameEn : item.nameRo;
                      const itemName = `${baseName}${item.variantLabel ? ` (${item.variantLabel})` : ''}`;
                      return (
                      <div
                        key={`${item.productId}::${String(item.variantLabel || '')}`}
                        className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 flex flex-col"
                      >
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
                              onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantLabel)}
                              className="w-8 h-8 bg-[var(--malts-card)] hover:bg-[var(--malts-card-hover)] border border-[var(--malts-hairline)] rounded-lg font-bold"
                            >
                              −
                            </button>
                            <span className="font-bold w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantLabel)}
                              className="w-8 h-8 malts-btn-primary rounded-lg font-bold"
                            >
                              +
                            </button>
                            <button
                              onClick={() => setCart((prev) =>
                                prev.filter(
                                  (x) =>
                                    !(x.productId === item.productId && String(x.variantLabel || '') === String(item.variantLabel || ''))
                                )
                              )}
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
      {tableNumber && waiterCallEnabled && (
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

      {/* Контакти / резервации — същите данни като страницата Контакти */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end md:items-center justify-center bg-[var(--malts-paper)]/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-contact-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
            onClick={() => setContactModalOpen(false)}
          />
          <div className="relative malts-card w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-3xl md:rounded-3xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--malts-hairline)] px-5 py-4 shrink-0 bg-[var(--malts-card)]">
              <h2 id="order-contact-modal-title" className="text-xl font-bold pr-8">
                {locale === 'bg' ? 'Контакти' : locale === 'en' ? 'Contact' : 'Date de contact'}
              </h2>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-3xl leading-none text-[var(--malts-ink)] hover:text-[var(--malts-accent)] shrink-0"
                aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-5 md:p-6 flex-1 space-y-6">
              {orderLocationSettings ? (
                <>
                  <div className="flex items-start gap-4">
                    <svg
                      className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-[var(--malts-ink)] font-semibold">
                        {locale === 'bg' ? 'Адрес' : locale === 'en' ? 'Address' : 'Adres'}
                      </p>
                      <p className="malts-muted whitespace-pre-line">
                        {locale === 'bg'
                          ? orderLocationSettings.addressBg
                          : locale === 'en'
                            ? orderLocationSettings.addressEn
                            : orderLocationSettings.addressRo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <svg
                      className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <div>
                      <p className="text-[var(--malts-ink)] font-semibold">
                        {locale === 'bg' ? 'Телефон' : locale === 'en' ? 'Phone' : 'Telefon'}
                      </p>
                      {orderLocationSettings.phone?.trim() ? (
                        <a
                          href={`tel:${String(orderLocationSettings.phone).replace(/[^\d+]/g, '')}`}
                          className="text-[var(--malts-ink)] hover:text-[var(--malts-accent)] transition-colors"
                        >
                          {orderLocationSettings.phone}
                        </a>
                      ) : (
                        <p className="malts-muted text-sm">
                          {locale === 'bg' ? '—' : locale === 'en' ? '—' : '—'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[var(--malts-ink)] font-semibold">Instagram</p>
                      {orderLocationSettings.instagramUrl?.trim() ? (
                        <a
                          href={orderLocationSettings.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--malts-accent)] break-all hover:underline"
                        >
                          {orderLocationSettings.instagramUrl}
                        </a>
                      ) : (
                        <p className="malts-muted text-sm">—</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[var(--malts-ink)] font-semibold">Facebook</p>
                      {orderLocationSettings.facebookUrl?.trim() ? (
                        <a
                          href={orderLocationSettings.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--malts-accent)] break-all hover:underline"
                        >
                          {orderLocationSettings.facebookUrl}
                        </a>
                      ) : (
                        <p className="malts-muted text-sm">—</p>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const addr =
                      locale === 'bg'
                        ? orderLocationSettings.addressBg
                        : locale === 'en'
                          ? orderLocationSettings.addressEn
                          : orderLocationSettings.addressRo;
                    const lat = orderLocationSettings.latitude as number | null | undefined;
                    const lng = orderLocationSettings.longitude as number | null | undefined;
                    const hasCoords =
                      typeof lat === 'number' &&
                      Number.isFinite(lat) &&
                      typeof lng === 'number' &&
                      Number.isFinite(lng);
                    const mapQueryAddress = (addr || '').trim();
                    const mapSrc = hasCoords
                      ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=17&output=embed`
                      : mapQueryAddress
                        ? `https://www.google.com/maps?q=${encodeURIComponent(mapQueryAddress)}&output=embed`
                        : 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2889.8!2d25.95!3d43.85!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDPCsDUxJzAwLjAiTiAyNcKwNTcnMDAuMCJF!5e0!3m2!1sen!2sbg!4v1234567890';
                    return (
                      <div className="malts-card rounded-xl overflow-hidden border border-[var(--malts-hairline)]">
                        <iframe
                          src={mapSrc}
                          width="100%"
                          height={220}
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          title={locale === 'bg' ? 'Карта' : locale === 'en' ? 'Map' : 'Hartă'}
                          className="w-full"
                        />
                      </div>
                    );
                  })()}
                </>
              ) : loading ? (
                <p className="malts-muted text-center py-8">
                  {locale === 'bg' ? 'Зареждане…' : locale === 'en' ? 'Loading…' : 'Se încarcă…'}
                </p>
              ) : (
                <p className="malts-muted text-center py-8">
                  {locale === 'bg'
                    ? 'Информацията не е налична.'
                    : locale === 'en'
                      ? 'Information is not available.'
                      : 'Informațiile nu sunt disponibile.'}
                </p>
              )}
            </div>
            <div className="border-t border-[var(--malts-hairline)] p-4 shrink-0 bg-[var(--malts-card)]">
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="w-full rounded-xl malts-btn-primary py-3 font-semibold"
              >
                {locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventDetailModal && (
        <div
          className="fixed inset-0 z-[55] flex items-end md:items-center justify-center bg-[var(--malts-paper)]/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-event-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
            onClick={() => setEventDetailModal(null)}
          />
          <div className="relative malts-card w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-hidden rounded-t-3xl md:rounded-3xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--malts-hairline)] px-5 py-4 shrink-0 bg-[var(--malts-card)]">
              <h2 id="order-event-modal-title" className="text-lg md:text-xl font-bold pr-8 line-clamp-2">
                {locale === 'bg'
                  ? eventDetailModal.titleBg
                  : locale === 'en'
                    ? eventDetailModal.titleEn
                    : eventDetailModal.titleRo}
              </h2>
              <button
                type="button"
                onClick={() => setEventDetailModal(null)}
                className="text-3xl leading-none text-[var(--malts-ink)] hover:text-[var(--malts-accent)] shrink-0"
                aria-label={locale === 'bg' ? 'Затвори' : locale === 'en' ? 'Close' : 'Închide'}
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-5 md:p-6 flex-1 space-y-5">
              {eventDetailImageUrl(eventDetailModal) ? (
                <div className="relative w-full overflow-hidden rounded-xl bg-[var(--malts-inset)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={eventDetailImageUrl(eventDetailModal)!}
                    alt=""
                    className="mx-auto block max-h-[min(40vh,360px)] w-auto max-w-full object-contain"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={
                    eventDetailModal.isExternal
                      ? 'px-3 py-1 rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-inset)]'
                      : 'px-3 py-1 rounded-full border border-[var(--malts-accent-tint-border)] bg-[var(--malts-accent-tint)] text-[var(--malts-accent)]'
                  }
                >
                  {eventDetailModal.isExternal
                    ? locale === 'bg'
                      ? 'Партньорско'
                      : locale === 'en'
                        ? 'Partner'
                        : 'Partener'
                    : locale === 'bg'
                      ? 'При нас'
                      : locale === 'en'
                        ? 'At Malts'
                        : 'La Malts'}
                </span>
                <span className="malts-muted">
                  {formatDateForLocale(new Date(eventDetailModal.eventDate), locale as 'bg' | 'en' | 'ro')}
                </span>
              </div>
              <div>
                <p className="text-sm malts-muted mb-1">
                  {locale === 'bg' ? 'Локация' : locale === 'en' ? 'Location' : 'Locație'}
                </p>
                <p className="font-medium text-[var(--malts-ink)]">
                  {eventDetailModal.isExternal
                    ? locale === 'bg'
                      ? eventDetailModal.locationBg || eventDetailModal.location
                      : locale === 'en'
                        ? eventDetailModal.locationEn || eventDetailModal.location
                        : eventDetailModal.locationRo || eventDetailModal.location
                    : eventDetailModal.location}
                </p>
              </div>
              <p className="text-[var(--malts-ink)] leading-relaxed whitespace-pre-line">
                {locale === 'bg'
                  ? eventDetailModal.descriptionBg
                  : locale === 'en'
                    ? eventDetailModal.descriptionEn
                    : eventDetailModal.descriptionRo}
              </p>
              {eventDetailModal.isExternal && eventDetailModal.externalUrl ? (
                <a
                  href={eventDetailModal.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[var(--malts-accent)] font-medium hover:underline break-all"
                >
                  {eventDetailModal.externalUrl}
                </a>
              ) : null}
              {eventDetailModal.contactInfo ? (
                <p className="text-sm malts-muted whitespace-pre-line border-t border-[var(--malts-hairline)] pt-4">
                  {eventDetailModal.contactInfo}
                </p>
              ) : null}
            </div>
            <div className="border-t border-[var(--malts-hairline)] p-4 shrink-0 bg-[var(--malts-card)]">
              <button
                type="button"
                onClick={() => setEventDetailModal(null)}
                className="w-full rounded-xl malts-btn-primary py-3 font-semibold"
              >
                OK
              </button>
            </div>
          </div>
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
    <Suspense fallback={<ManagedLoadingScreen locale={locale} />}>
      <OrderPageContent />
    </Suspense>
  );
}


