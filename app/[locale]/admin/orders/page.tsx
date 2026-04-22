'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Price from '@/components/Price';
import Toast from '@/components/Toast';
import { getPusherClient } from '@/lib/pusher-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PendingApprovalsBanner from '@/components/PendingApprovalsBanner';
import { useLockScroll } from '@/lib/use-lock-scroll';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';
import { formatBulgarianDateTime, formatBulgarianDate, formatBulgarianDateRange, formatBulgarianTime } from '@/lib/date-utils';
import { displayPrice } from '@/lib/currency';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

type OrderTab = 'active' | 'history' | 'stats' | 'approvals';

function AdminOrdersPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = pathname.split('/')[1] || 'bg';
  
  // Check URL params for tab and approval ID
  const urlTab = searchParams?.get('tab') as OrderTab | null;
  const approvalId = searchParams?.get('approval');
  
  const [activeTab, setActiveTab] = useState<OrderTab>(urlTab && ['active', 'history', 'stats', 'approvals'].includes(urlTab) ? urlTab : 'active');
  const [orders, setOrders] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pendingDeleteOrderId, setPendingDeleteOrderId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    approvalOrderThreshold: 5,
    approvalTimeWindowMinutes: 5,
    autoRejectMinutes: 30
  });
  const approvalWindowMinutes = securitySettings?.approvalTimeWindowMinutes ?? 5;
  const autoRejectMinutes = securitySettings?.autoRejectMinutes ?? 30;
  
  // CSV Export functions
  const generateCSVExport = async () => {
    try {
      // Fetch orders directly from API for the selected date range
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Large limit to get all orders
        status: 'completed',
        ...(statsFilters.dateFrom && { dateFrom: statsFilters.dateFrom }),
        ...(statsFilters.dateTo && { dateTo: statsFilters.dateTo }),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      const response = await fetch(`/api/orders/history?${params}`);
      const data = await response.json();
      const filteredOrders = data.orders || [];
      
      const headers = ['Поръчка #', 'Маса', 'Дата/Час', 'Продукт', 'Количество', 'Цена', 'Общо поръчка', 'Статус'];
      const rows = filteredOrders.flatMap((order: any) => {
        const orderDate = new Date(order.createdAt);
        const formattedDateTime = formatBulgarianDateTime(orderDate);
        // formatBulgarianDateTime returns "23.12.2025 г., 17:51", split by comma to get date and time
        const [formattedDate, formattedTime] = formattedDateTime.split(', ');
        const dateTime = `${formattedDate} ${formattedTime}`;
        
        // Format prices with dot as decimal separator (e.g., 2.55)
        const formatPrice = (price: number) => {
          return Number(price || 0).toFixed(2).replace(',', '.');
        };
        
        const orderTotal = formatPrice(order.totalBgn);
        const orderStatus = String(order.status || 'completed');
        
        return order.items.map((item: any) => {
          // Ensure all fields have values
          const productName = String(item.productName || item.product?.nameBg || '');
          const quantity = String(item.quantity || '1');
          const price = formatPrice(item.priceBgn);
          
          return [
            String(order.orderNumber || ''),
            String(order.tableNumber || ''),
            dateTime,
            productName,
            quantity,
            price,
            orderTotal, // Show total on every row for easier reading
            orderStatus // Show status on every row
          ];
        });
      });
      
      return [headers, ...rows];
    } catch (error) {
      console.error('CSV export error:', error);
      return [['Грешка при експорт на данни']];
    }
  };
  
  const downloadCSV = (data: any[][], filename: string) => {
    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const csvContent = data.map(row => row.map(escapeCSV).join(',')).join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Filters for history (temporary state - not applied yet)
  const [tempFilters, setTempFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0], // Today
    dateTo: new Date().toISOString().split('T')[0],
    tableNumbers: [] as string[],
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  // Applied filters (used for API calls)
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    tableNumbers: [] as string[],
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  
  const [historyRevenue, setHistoryRevenue] = useState({
    totalBgn: 0,
    totalEur: 0,
    ordersCount: 0
  });
  
  // Stats data
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [productStats, setProductStats] = useState<any>(null);
  const [tableStats, setTableStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [qrScanStats, setQrScanStats] = useState<any[]>([]);
  const [qrScanStatsLoading, setQrScanStatsLoading] = useState(false);
  const [qrScanChartData, setQrScanChartData] = useState<any>(null);
  
  // Stats filters - temporary (before applying)
  const [tempStatsFilters, setTempStatsFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0], // Today
    dateTo: new Date().toISOString().split('T')[0]
  });
  
  // Applied stats filters (used for API calls)
  const [statsFilters, setStatsFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0], // Today
    dateTo: new Date().toISOString().split('T')[0]
  });

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date as YYYY-MM-DD in a specific IANA timezone (reliable on iOS Safari).
  const formatDateInTimeZone = (date: Date, timeZone: string): string => {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);

      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;

      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // Fallback below
    }
    return formatLocalDate(date);
  };

  // Quick filter presets
  const setQuickFilter = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    // Get current date in Bulgarian timezone as YYYY-MM-DD string
    const now = new Date();
    const bgTodayStr = formatDateInTimeZone(now, 'Europe/Sofia');
    
    let dateFromStr: string;
    let dateToStr: string;
    
    switch (preset) {
      case 'today':
        dateFromStr = bgTodayStr;
        dateToStr = bgTodayStr;
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFromStr = formatDateInTimeZone(yesterday, 'Europe/Sofia');
        dateToStr = dateFromStr;
        break;
      }
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFromStr = formatDateInTimeZone(weekAgo, 'Europe/Sofia');
        dateToStr = bgTodayStr;
        break;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFromStr = formatDateInTimeZone(monthAgo, 'Europe/Sofia');
        dateToStr = bgTodayStr;
        break;
      }
      default:
        dateFromStr = bgTodayStr;
        dateToStr = bgTodayStr;
    }
    
    const newFilters = {
      dateFrom: dateFromStr,
      dateTo: dateToStr
    };
    
    setTempStatsFilters(newFilters);
    setStatsFilters(newFilters);
  };
  
  // Selected order for modal
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  
  // Lock scroll when modals are open (backdrop locked, modals can scroll)
  useLockScroll(showCancelModal || showApprovalModal || showOrderModal);

  const loadActiveOrders = useCallback(async () => {
    try {
      // Use /api/orders/active to get ALL active orders (not just today's)
      const response = await fetch('/api/orders/active');
      const data = await response.json();
      setOrders(data.orders || []);
      setLoading(false);
    } catch (error) {
      console.error('Load active orders error:', error);
      setToast({ message: 'Грешка при зареждане на поръчките', type: 'error' });
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(appliedFilters.dateFrom && { dateFrom: appliedFilters.dateFrom }),
        ...(appliedFilters.dateTo && { dateTo: appliedFilters.dateTo }),
        ...(appliedFilters.tableNumbers.length > 0 && { tableNumbers: appliedFilters.tableNumbers.join(',') }),
        ...(appliedFilters.status && { status: appliedFilters.status }),
        sortBy: appliedFilters.sortBy,
        sortOrder: appliedFilters.sortOrder
      });
      
      const response = await fetch(`/api/orders/history?${params}`);
      const data = await response.json();
      
      setHistoryOrders(data.orders || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
      setHistoryRevenue(data.revenue);
      setHistoryLoading(false);
    } catch (error) {
      console.error('Load history error:', error);
      setToast({ message: 'Грешка при зареждане на историята', type: 'error' });
      setHistoryLoading(false);
    }
  }, [appliedFilters, pagination.page, pagination.limit]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statsFilters.dateFrom) params.append('dateFrom', statsFilters.dateFrom);
      if (statsFilters.dateTo) params.append('dateTo', statsFilters.dateTo);
      
      const [revenueRes, productsRes, tablesRes] = await Promise.all([
        fetch(`/api/stats/revenue?${params.toString()}`),
        fetch(`/api/stats/products?${params.toString()}`),
        fetch(`/api/stats/tables?${params.toString()}`)
      ]);
      
      const [revenueData, productsData, tablesData] = await Promise.all([
        revenueRes.json(),
        productsRes.json(),
        tablesRes.json()
      ]);
      
      setRevenueStats(revenueData);
      setProductStats(productsData);
      setTableStats(tablesData);
      setStatsLoading(false);
    } catch (error) {
      console.error('Load stats error:', error);
      setToast({ message: 'Грешка при зареждане на статистиките', type: 'error' });
      setStatsLoading(false);
    }
  }, [statsFilters.dateFrom, statsFilters.dateTo]);

  const loadQrScanStats = useCallback(async () => {
    setQrScanStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statsFilters.dateFrom) params.append('dateFrom', statsFilters.dateFrom);
      if (statsFilters.dateTo) params.append('dateTo', statsFilters.dateTo);
      
      const response = await fetch(`/api/qr/redirects?${params.toString()}`);
      const data = await response.json();
      setQrScanStats(data.tables || []);
      setQrScanStatsLoading(false);
    } catch (error) {
      console.error('Load QR scan stats error:', error);
      setQrScanStatsLoading(false);
    }
  }, [statsFilters.dateFrom, statsFilters.dateTo]);

  const loadPendingApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const response = await fetch('/api/orders/pending-approval');
      if (response.ok) {
        const data = await response.json();
        setPendingApprovals(data.approvals || []);
      } else {
        setToast({ message: 'Грешка при зареждане на одобренията', type: 'error' });
      }
    } catch (error) {
      console.error('Load pending approvals error:', error);
      setToast({ message: 'Грешка при зареждане на одобренията', type: 'error' });
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  // Load active orders and pending approvals on mount
  useEffect(() => {
    loadActiveOrders();
    loadPendingApprovals(); // Load pending approvals to show banner
    
    // Setup Pusher for real-time updates
    const pusher = getPusherClient();
    const channel = pusher.subscribe('staff-channel');
    
    channel.bind('new-order', (data: any) => {
      setOrders(prev => [data, ...prev]);
    });
    
    channel.bind('order-status-change', (data: any) => {
      setOrders(prev => prev.map(order => 
        order.id === data.orderId 
          ? { ...order, status: data.status }
          : order
      ));
    });
    
    return () => {
      channel.unbind_all();
      pusher.unsubscribe('staff-channel');
    };
  }, [loadActiveOrders, loadPendingApprovals]);

  // Listen for approval notifications (admin channel)
  useEffect(() => {
    const pusher = getPusherClient();
    const adminChannel = pusher.subscribe('admin-channel');

    adminChannel.bind('order-approval-needed', (data: any) => {
      // Reload pending approvals when new one arrives (always, to update banner)
      loadPendingApprovals();
    });

    // Listen for auto-rejections
    adminChannel.bind('auto-rejections', (data: any) => {
      // Reload pending approvals and active orders when auto-rejections occur (always, to update banner)
      loadPendingApprovals();
      loadActiveOrders();
      if (activeTab === 'history') {
        loadHistory();
      }
    });

    // Listen for approval status changes
    adminChannel.bind('order-approval-status', (data: any) => {
      // Reload pending approvals when status changes (always, to update banner)
      loadPendingApprovals();
    });

    return () => {
      adminChannel.unbind_all();
      pusher.unsubscribe('admin-channel');
    };
  }, [activeTab, loadActiveOrders, loadHistory, loadPendingApprovals]);

  // Auto-reject expired approvals (configurable)
  useEffect(() => {
    const checkAndAutoReject = async () => {
      try {
        const response = await fetch('/api/orders/auto-reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.rejectedCount > 0) {
            // Reload pending approvals if we're on that tab
            if (activeTab === 'approvals') {
              loadPendingApprovals();
            }
            // Reload active orders
            loadActiveOrders();
            // Show notification
            setToast({ 
              message: `✅ Автоматично отхвърлени ${data.rejectedCount} поръчки (над ${autoRejectMinutes} мин без одобрение)`, 
              type: 'success' 
            });
          }
        }
      } catch (error) {
        console.error('Auto-reject check failed:', error);
      }
    };

    // Check immediately on page load
    checkAndAutoReject();

    // Then check every 5 minutes
    const interval = setInterval(checkAndAutoReject, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeTab, autoRejectMinutes, loadPendingApprovals, loadActiveOrders]);
  
  // Load history when applied filters or page changes
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);
  
  // Load stats when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
      loadQrScanStats();
    }
  }, [activeTab, loadStats, loadQrScanStats]);

  // Load pending approvals when approvals tab is opened
  useEffect(() => {
    if (activeTab === 'approvals') {
      loadPendingApprovals();
    }
  }, [activeTab, loadPendingApprovals]);

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
        // use defaults if request fails
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle URL params - open approvals tab if specified
  useEffect(() => {
    if (urlTab === 'approvals') {
      setActiveTab('approvals');
      loadPendingApprovals();
    }
  }, [urlTab, loadPendingApprovals]);

  // Auto-open approval modal if approval ID is in URL
  useEffect(() => {
    if (approvalId && pendingApprovals.length > 0) {
      const approval = pendingApprovals.find((a: any) => a.orderId === approvalId);
      if (approval) {
        setSelectedApproval(approval);
        setShowApprovalModal(true);
        setActiveTab('approvals');
      }
    }
  }, [approvalId, pendingApprovals]);

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
        loadPendingApprovals();
        // Also reload active orders to show the newly approved order
        if (activeTab === 'active') {
          loadActiveOrders();
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
        loadPendingApprovals();
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

  const handleFilterChange = (key: string, value: string) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  };

  const [tables, setTables] = useState<Array<{ id: string; tableNumber: number; tableName?: string | null; isActive?: boolean }>>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesDropdownOpen, setTablesDropdownOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== 'history') return;
    let cancelled = false;

    const run = async () => {
      setTablesLoading(true);
      try {
        const res = await fetch('/api/tables');
        const data = await res.json();
        const list = (data?.tables || []) as Array<{ id: string; tableNumber: number; tableName?: string | null; isActive?: boolean }>;
        if (!cancelled) setTables(list);
      } catch {
        if (!cancelled) setTables([]);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const toggleTableSelection = (tableNumber: number) => {
    const value = String(tableNumber);
    setTempFilters(prev => {
      const set = new Set(prev.tableNumbers);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, tableNumbers: Array.from(set).sort((a, b) => Number(a) - Number(b)) };
    });
  };

  const clearTableSelection = () => {
    setTempFilters(prev => ({ ...prev, tableNumbers: [] }));
  };
  
  const applyFilters = () => {
    setAppliedFilters(tempFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
  };

  // Helper function to format date period
  const formatDatePeriod = () => {
    if (statsFilters.dateFrom && statsFilters.dateTo) {
      // Parse dates correctly to avoid timezone issues
      const fromParts = statsFilters.dateFrom.split('-');
      const toParts = statsFilters.dateTo.split('-');
      
      const fromDate = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2]));
      const toDate = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]));
      
      return formatBulgarianDateRange(fromDate, toDate);
    }
    return 'днес';
  };

  const executeDeleteOrder = async () => {
    if (!pendingDeleteOrderId) return;
    const orderId = pendingDeleteOrderId;
    setPendingDeleteOrderId(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/delete`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setToast({ message: '✅ Поръчката е изтрита успешно', type: 'success' });
        setShowOrderModal(false);
        if (activeTab === 'active') {
          loadActiveOrders();
        } else {
          loadHistory();
        }
      } else {
        const data = await response.json();
        setToast({ message: data.error || 'Грешка при изтриване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    }
  };

  const executeBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);

    if (selectedOrderIds.size === 0) {
      setToast({ message: 'Моля, изберете поне една поръчка', type: 'error' });
      return;
    }

    setBulkDeleting(true);
    try {
      const response = await fetch('/api/orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) })
      });

      if (response.ok) {
        const data = await response.json();
        setToast({ message: `✅ ${data.message}`, type: 'success' });
        setSelectedOrderIds(new Set());
        loadHistory();
      } else {
        const data = await response.json();
        setToast({ message: data.error || 'Грешка при масово изтриване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при връзка', type: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === historyOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(historyOrders.map((o: any) => o.id)));
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string, cancellationReason?: string) => {
    setUpdatingStatus(prev => ({ ...prev, [orderId]: true }));
    
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
      setUpdatingStatus(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCancelOrder = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = () => {
    if (cancelOrderId) {
      handleUpdateOrderStatus(cancelOrderId, 'cancelled', cancelReason);
      setShowCancelModal(false);
      setCancelOrderId(null);
      setCancelReason('');
    }
  };

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const completedTodayOrders = orders.filter(o => o.status === 'completed');

  if (loading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="malts-card w-full max-w-md">
            <div className="p-6 border-b border-[var(--malts-hairline)]">
              <h2 className="text-2xl font-bold">Откажи поръчка</h2>
              <p className="malts-muted text-sm mt-1">Моля, посочете причина за отказ</p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium malts-subtle mb-2">
                Причина за отказ
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
      
      {/* Global Pending Approvals Banner - Always visible (sticky) */}
      <PendingApprovalsBanner 
        locale={locale}
        onApprovalClick={(approval) => {
          setSelectedApproval(approval);
          setShowApprovalModal(true);
          setActiveTab('approvals');
        }}
        showButtons={true}
      />

      {/* Header with Tabs */}
      <div className="mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title mb-6">Поръчки & Статистики</h1>
        
        <div className="flex gap-2 bg-[var(--malts-inset)] p-1 rounded-lg overflow-x-auto scrollbar-hide border border-[var(--malts-hairline)]">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-shrink-0 px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
              activeTab === 'active'
                ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
            }`}
          >
            🟢 Активни ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-shrink-0 px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
            }`}
          >
            📋 История
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-shrink-0 px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
            }`}
          >
            📊 Статистики
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex-shrink-0 px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base whitespace-nowrap relative ${
              activeTab === 'approvals'
                ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
            }`}
          >
            ⚠️ Одобрения
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--malts-danger)] text-[#f5f0e6] rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Orders Tab */}
      {activeTab === 'active' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">
              Активни поръчки ({activeOrders.length})
            </h2>
          </div>
          
          {activeOrders.length === 0 ? (
            <div className="text-center py-20 malts-card">
              <p className="malts-muted text-xl">Няма активни поръчки</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeOrders.map((order: any) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowOrderModal(true);
                  }}
                  className="malts-card p-6 border-2 border-[var(--malts-hairline)] cursor-pointer hover:border-[var(--malts-accent-tint-border)] transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-2xl font-bold">
                        Поръчка #{order.orderNumber}
                      </div>
                      <div className="text-lg malts-muted">
                        Маса {order.tableNumber}
                      </div>
                      {order.createdAt && (
                        <div className="text-sm malts-muted mt-1">
                          {formatBulgarianDateTime(order.createdAt)}
                        </div>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                      order.status === 'preparing' ? 'bg-blue-500/20 text-blue-300' :
                      order.status === 'ready' ? 'bg-green-500/20 text-green-300' : ''
                    }`}>
                      {order.status === 'pending' ? 'Нова' :
                       order.status === 'preparing' ? 'В процес' :
                       order.status === 'ready' ? 'Готова' : order.status}
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    {order.items && order.items.slice(0, 3).map((item: any) => (
                      <div key={item.id} className="flex justify-between malts-muted text-sm">
                        <span>{item.quantity}x {item.productName}</span>
                        <Price priceBgn={Number(item.priceBgn)} className="malts-muted" />
                      </div>
                    ))}
                    {order.items && order.items.length > 3 && (
                      <div className="malts-muted text-sm">
                        +{order.items.length - 3} още...
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--malts-hairline)] pt-3 mb-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Общо:</span>
                      <Price priceBgn={Number(order.totalBgn)} className="text-xl font-bold" />
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-secondary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {updatingStatus[order.id] ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Приготвяме</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                    {order.status === 'preparing' && (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-secondary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {updatingStatus[order.id] ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span>Готова</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                    {order.status === 'ready' && (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-primary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          {updatingStatus[order.id] ? (
                            <div className="w-4 h-4 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            '✓ Завърши'
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={updatingStatus[order.id]}
                          className="px-3 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          ✗ Откажи
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Today's Completed */}
          <div className="mt-10">
            <h2 className="text-2xl font-bold mb-4">
              Завършени днес ({completedTodayOrders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedTodayOrders.slice(0, 6).map((order: any) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowOrderModal(true);
                  }}
                  className="malts-card rounded-xl p-6 border-2 border-green-500/30 opacity-90 cursor-pointer hover:opacity-100 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-2xl font-bold">
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

                  <div className="border-t border-[var(--malts-hairline)] pt-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Общо:</span>
                      <Price priceBgn={Number(order.totalBgn)} className="text-xl font-bold" />
                    </div>
                    {order.completedAt && (
                      <p className="text-sm malts-muted mt-2">
                        {formatBulgarianTime(order.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="malts-card p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Филтри</h3>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm malts-subtle mb-2">От дата</label>
                <input
                  type="date"
                  value={tempFilters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-4 py-2 malts-inset rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                />
              </div>
              <div>
                <label className="block text-sm malts-subtle mb-2">До дата</label>
                <input
                  type="date"
                  value={tempFilters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-4 py-2 malts-inset rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                />
              </div>
              <div>
                <label className="block text-sm malts-subtle mb-2">Маси</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTablesDropdownOpen(v => !v)}
                    className="w-full px-4 py-2 malts-inset rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)] text-left flex items-center justify-between gap-3"
                  >
                    <span className="truncate">
                      {tempFilters.tableNumbers.length === 0
                        ? (tablesLoading ? 'Зареждане...' : 'Всички')
                        : tempFilters.tableNumbers.length === 1
                          ? `Маса ${tempFilters.tableNumbers[0]}`
                          : `${tempFilters.tableNumbers.length} маси избрани`}
                    </span>
                    <span className="malts-subtle text-sm">{tablesDropdownOpen ? '▲' : '▼'}</span>
                  </button>

                  {tablesDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full malts-card rounded-lg p-3 max-h-64 overflow-auto">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-semibold text-[var(--malts-ink)]">Избери маси</div>
                        {tempFilters.tableNumbers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearTableSelection()}
                            className="text-sm malts-muted underline underline-offset-2"
                          >
                            Изчисти
                          </button>
                        )}
                      </div>

                      {tablesLoading ? (
                        <div className="text-sm malts-muted py-2">Зареждане...</div>
                      ) : tables.length === 0 ? (
                        <div className="text-sm malts-muted py-2">Няма налични маси</div>
                      ) : (
                        <div className="space-y-2">
                          {tables.map((t) => {
                            const selected = tempFilters.tableNumbers.includes(String(t.tableNumber));
                            const label = t.tableName ? `Маса ${t.tableNumber} — ${t.tableName}` : `Маса ${t.tableNumber}`;
                            return (
                              <label key={t.id} className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleTableSelection(t.tableNumber)}
                                  className="mt-1 w-4 h-4 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
                                />
                                <span className="text-sm text-[var(--malts-ink)] leading-5">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-[var(--malts-hairline)] flex justify-end">
                        <button
                          type="button"
                          onClick={() => setTablesDropdownOpen(false)}
                          className="px-3 py-2 malts-btn-secondary rounded-lg font-semibold transition-all text-sm"
                        >
                          Готово
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm malts-subtle mb-2">Статус</label>
                <select
                  value={tempFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2 malts-inset rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                >
                  <option value="">Всички</option>
                  <option value="completed">Завършени</option>
                  <option value="cancelled">Отменени</option>
                  <option value="pending">Чакащи</option>
                  <option value="preparing">В процес</option>
                  <option value="ready">Готови</option>
                </select>
              </div>
            </div>
            
            {/* Search Button */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={applyFilters}
                className="malts-btn-primary malts-btn-admin-compact rounded-lg font-semibold shadow-lg transition-all"
              >
                🔍 Търси
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setTempFilters({
                    dateFrom: today,
                    dateTo: today,
                    tableNumbers: [],
                    status: '',
                    sortBy: 'createdAt',
                    sortOrder: 'desc'
                  });
                  setAppliedFilters({
                    dateFrom: today,
                    dateTo: today,
                    tableNumbers: [],
                    status: '',
                    sortBy: 'createdAt',
                    sortOrder: 'desc'
                  });
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="malts-btn-secondary malts-btn-admin-compact rounded-lg font-semibold transition-all"
              >
                🔄 Изчисти
              </button>
            </div>
            
            {/* Revenue Summary */}
              <div className="mt-6 pt-6 border-t border-[var(--malts-hairline)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
                  <p className="malts-subtle text-sm mb-1">Общ приход</p>
                  <p className="text-2xl font-bold">
                    <Price priceBgn={Number(historyRevenue.totalBgn)} />
                  </p>
                </div>
                <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
                  <p className="malts-subtle text-sm mb-1">Брой поръчки</p>
                  <p className="text-2xl font-bold">
                    {historyRevenue.ordersCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="malts-card overflow-hidden">
            {historyLoading ? (
              <div className="min-h-[60vh] flex items-center justify-center">
                <ManagedLoadingScreen 
                  locale={locale} 
                  inline={true}
                  message="Зареждане на история..."
                  logoSize="small"
                />
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="text-center py-20">
                <p className="malts-muted text-xl">Няма поръчки за избрания период</p>
              </div>
            ) : (
              <div>
                {/* Bulk Actions Bar */}
                {selectedOrderIds.size > 0 && (
                  <div className="mb-4 p-4 bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg flex items-center justify-between">
                    <span className="text-[var(--malts-ink)] font-semibold">
                      Избрани: {selectedOrderIds.size} поръчки
                    </span>
                    <button
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      disabled={bulkDeleting}
                      className="px-6 py-2 malts-btn-danger rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkDeleting ? 'Изтриване...' : `🗑️ Изтрий избраните (${selectedOrderIds.size})`}
                    </button>
                  </div>
                )}

                {/* Orders Table - Desktop */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full">
                    <thead className="bg-[var(--malts-inset)] border-b border-[var(--malts-hairline)]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.size === historyOrders.length && historyOrders.length > 0}
                            onChange={handleSelectAll}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">#</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Маса</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Дата/Час</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Продукти</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Статус</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold malts-subtle uppercase">Сума</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--malts-hairline)]">
                      {historyOrders.map((order: any, index: number) => (
                        <tr
                          key={order.id}
                          className="hover:bg-[var(--malts-accent-tint)] transition-colors"
                        >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.has(order.id)}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
                            />
                          </td>
                          <td
                            className="px-6 py-4 text-[var(--malts-ink)] font-medium cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            {(pagination.page - 1) * pagination.limit + index + 1}
                          </td>
                          <td
                            className="px-6 py-4 text-[var(--malts-ink)] cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            {order.tableNumber}
                          </td>
                          <td
                            className="px-6 py-4 malts-muted text-sm cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            {formatBulgarianDateTime(order.createdAt)}
                          </td>
                          <td
                            className="px-6 py-4 malts-muted cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            {order.items?.length || 0} бр.
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.status === 'completed'
                                  ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                                  : order.status === 'cancelled'
                                    ? 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                                    : 'bg-[var(--malts-inset)] text-[var(--malts-ink)] border border-[var(--malts-hairline)]'
                              }`}
                            >
                              {order.status === 'completed'
                                ? '✓ Завършена'
                                : order.status === 'cancelled'
                                  ? '✗ Отменена'
                                  : order.status}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 text-right cursor-pointer"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            <Price priceBgn={Number(order.totalBgn)} className="text-[var(--malts-ink)] font-semibold" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Orders Cards - Mobile */}
                <div className="md:hidden p-4 space-y-3">
                  {/* Mobile select-all */}
                  <div className="flex items-center justify-between bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg px-3 py-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.size === historyOrders.length && historyOrders.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
                      />
                      <span className="text-sm font-semibold text-[var(--malts-ink)]">Избери всички</span>
                    </label>
                    <span className="text-xs malts-muted">{historyOrders.length} поръчки</span>
                  </div>

                  {historyOrders.map((order: any, index: number) => {
                    const statusLabel =
                      order.status === 'completed'
                        ? '✓ Завършена'
                        : order.status === 'cancelled'
                          ? '✗ Отменена'
                          : String(order.status || '');

                    const statusClass =
                      order.status === 'completed'
                        ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                        : order.status === 'cancelled'
                          ? 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                          : 'bg-[var(--malts-inset)] text-[var(--malts-ink)] border border-[var(--malts-hairline)]';

                    return (
                      <div
                        key={order.id}
                        className="malts-card rounded-xl p-4"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowOrderModal(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div onClick={(e) => e.stopPropagation()} className="pt-1">
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order.id)}
                                onChange={() => handleToggleSelectOrder(order.id)}
                                className="w-4 h-4 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-bold text-[var(--malts-ink)]">
                                  #{(pagination.page - 1) * pagination.limit + index + 1}
                                </div>
                                <div className="text-sm malts-muted">Маса {order.tableNumber}</div>
                              </div>
                              <div className="text-sm malts-muted mt-1 truncate">
                                {formatBulgarianDateTime(order.createdAt)}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3">
                            <div className="text-xs malts-subtle">Продукти</div>
                            <div className="text-lg font-bold text-[var(--malts-ink)]">
                              {order.items?.length || 0}
                            </div>
                          </div>
                          <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 text-right">
                            <div className="text-xs malts-subtle">Сума</div>
                            <div className="text-lg font-bold text-[var(--malts-ink)]">
                              <Price priceBgn={Number(order.totalBgn)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--malts-hairline)]">
                  <p className="malts-muted text-sm">
                    Страница {pagination.page} от {pagination.totalPages} ({pagination.totalCount} общо)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={!pagination.hasPrev}
                      className="px-4 py-2 malts-btn-secondary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      ← Назад
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.hasNext}
                      className="px-4 py-2 malts-btn-secondary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Напред →
                    </button>
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div>
          {/* Stats Filters */}
          <div className="malts-card p-6 mb-6">
            <h3 className="text-xl font-bold text-[var(--malts-ink)] mb-4">Филтър за период</h3>
            
            {/* Quick filter buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <button
                onClick={() => setQuickFilter('today')}
                className="px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-colors text-sm"
              >
                Днес
              </button>
              <button
                onClick={() => setQuickFilter('yesterday')}
                className="px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-colors text-sm"
              >
                Вчера
              </button>
              <button
                onClick={() => setQuickFilter('week')}
                className="px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-colors text-sm"
              >
                Седмица
              </button>
              <button
                onClick={() => setQuickFilter('month')}
                className="px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-colors text-sm"
              >
                Месец
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="malts-label">От дата</label>
                <input
                  type="date"
                  value={tempStatsFilters.dateFrom}
                  onChange={(e) => setTempStatsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="malts-field"
                />
              </div>
              <div>
                <label className="malts-label">До дата</label>
                <input
                  type="date"
                  value={tempStatsFilters.dateTo}
                  onChange={(e) => setTempStatsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="malts-field"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setStatsFilters(tempStatsFilters)}
                  className="w-full px-6 py-2 malts-btn-primary rounded-lg font-semibold transition-all"
                >
                  Приложи
                </button>
              </div>
            </div>
          </div>
          
          {statsLoading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <ManagedLoadingScreen 
                locale={locale} 
                inline={true}
                message="Зареждане на статистики..."
                logoSize="small"
              />
            </div>
          ) : revenueStats ? (
            <div className="space-y-8">
              {/* Revenue Cards */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">💰 Приходи</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="malts-card p-6 border border-[rgba(22,101,52,0.25)] bg-[rgba(22,101,52,0.08)]">
                    <p className="text-[var(--malts-success)] text-sm mb-2">{formatDatePeriod()}</p>
                    <p className="text-3xl font-bold text-[var(--malts-ink)] mb-1">
                      <Price priceBgn={Number(revenueStats.today.revenue || 0)} />
                    </p>
                    <p className="malts-muted text-sm">
                      {revenueStats.today.orders} поръчки
                    </p>
                  </div>
                  
                  <div className="malts-card p-6 border border-[rgba(29,78,216,0.25)] bg-[rgba(29,78,216,0.06)]">
                    <p className="text-[var(--malts-info)] text-sm mb-2">Тази седмица</p>
                    <p className="text-3xl font-bold text-[var(--malts-ink)] mb-1">
                      <Price priceBgn={Number(revenueStats.week.revenue || 0)} />
                    </p>
                    <p className="malts-muted text-sm">
                      {revenueStats.week.orders} поръчки
                    </p>
                  </div>
                  
                  <div className="malts-card p-6 border border-[rgba(107,33,168,0.22)] bg-[rgba(107,33,168,0.05)]">
                    <p className="text-[var(--malts-ink)] text-sm mb-2">Този месец</p>
                    <p className="text-3xl font-bold text-[var(--malts-ink)] mb-1">
                      <Price priceBgn={Number(revenueStats.month.revenue || 0)} />
                    </p>
                    <p className="malts-muted text-sm">
                      {revenueStats.month.orders} поръчки
                    </p>
                  </div>
                </div>
              </div>

              {/* Sales by Days Chart */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">📈 Продажби по дни - {formatDatePeriod()}</h2>
                <style jsx global>{`
                  .recharts-bar-rectangle:hover {
                    opacity: 0.8 !important;
                    filter: brightness(1.2) !important;
                  }
                `}</style>
                <div className="malts-card p-6">
                  {revenueStats.last7Days && revenueStats.last7Days.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={revenueStats.last7Days.map((day: any) => ({
                          date: formatBulgarianDate(day.date).replace(/ г\./g, '').trim(), // Get just date part without "г."
                          revenue: Number(day.revenue || 0),
                          orders: day.orders
                        }))}
                        margin={{ top: 20, right: 10, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9CA3AF"
                          tick={{ fill: '#9CA3AF' }}
                        />
                        <YAxis 
                          stroke="#9CA3AF"
                          tick={{ fill: '#9CA3AF' }}
                          label={{ value: 'Приход (€ / лв)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', style: { fontSize: '12px' } }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          cursor={{ fill: 'transparent' }}
                          formatter={(value: any) => {
                            const b = Number(value);
                            return [
                              `${displayPrice(b, 'EUR')} / ${displayPrice(b, 'BGN')}`,
                              'Приход',
                            ];
                          }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                              const orders = payload[0].payload.orders;
                              return `Дата: ${label} | Поръчки: ${orders}`;
                            }
                            return `Дата: ${label}`;
                          }}
                        />
                        <Bar 
                          dataKey="revenue" 
                          fill="#22C55E" 
                          radius={[8, 8, 0, 0]}
                          style={{ cursor: 'pointer' }}
                        >
                          {revenueStats.last7Days.map((day: any, index: number) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={Number(day.revenue || 0) > 0 ? '#22C55E' : '#374151'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-20">
                      <p className="malts-muted">Няма данни за избрания период</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Products */}
              {productStats && productStats.topProducts && productStats.topProducts.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">🏆 Топ продукти ({formatDatePeriod()})</h2>
                  <div className="malts-card overflow-hidden">
                    {/* Top Products Table - Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--malts-inset)] border-b border-[var(--malts-hairline)]">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">#</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Продукт</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold malts-subtle uppercase">Категория</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold malts-subtle uppercase">Продадени</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold malts-subtle uppercase">Приход</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--malts-hairline)]">
                          {productStats.topProducts.slice(0, 10).map((product: any, idx: number) => (
                            <tr key={product.productId} className="hover:bg-[var(--malts-accent-tint)] transition-colors">
                              <td className="px-6 py-4 malts-muted font-medium">{idx + 1}</td>
                              <td className="px-6 py-4 text-[var(--malts-ink)] font-medium">{product.productName}</td>
                              <td className="px-6 py-4 malts-muted text-sm">{product.category}</td>
                              <td className="px-6 py-4 text-center text-[var(--malts-ink)] font-semibold">
                                {product.quantitySold}
                              </td>
                              <td className="px-6 py-4 text-right text-[var(--malts-ink)] font-semibold">
                                <Price priceBgn={Number(product.revenue || 0)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Top Products Cards - Mobile */}
                    <div className="md:hidden p-4 space-y-3">
                      {productStats.topProducts.slice(0, 10).map((product: any, idx: number) => (
                        <div key={product.productId} className="malts-card rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] text-[var(--malts-accent)] font-bold">
                                  {idx + 1}
                                </span>
                                <div className="font-bold text-[var(--malts-ink)] truncate">{product.productName}</div>
                              </div>
                              <div className="text-sm malts-muted mt-2">{product.category}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs malts-subtle">Приход</div>
                              <div className="text-lg font-bold text-[var(--malts-ink)]">
                                <Price priceBgn={Number(product.revenue || 0)} />
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 flex items-center justify-between">
                            <span className="text-sm malts-subtle">Продадени</span>
                            <span className="text-lg font-bold text-[var(--malts-ink)]">{product.quantitySold}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Table Performance */}
              {tableStats && tableStats.tables && tableStats.tables.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">🪑 Маси ({formatDatePeriod()})</h2>
                  <div className="malts-card p-6 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
                        <p className="malts-subtle text-sm mb-1">Общо маси</p>
                        <p className="text-2xl font-bold text-[var(--malts-ink)]">
                          {tableStats.summary.totalTables}
                        </p>
                      </div>
                      <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
                        <p className="malts-subtle text-sm mb-1">Активни</p>
                        <p className="text-2xl font-bold text-[var(--malts-ink)]">
                          {tableStats.summary.activeTables}
                        </p>
                      </div>
                      <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
                        <p className="malts-subtle text-sm mb-1">Заетост</p>
                        <p className="text-2xl font-bold text-[var(--malts-ink)]">
                          {tableStats.summary.utilizationPercent}%
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tableStats.tables.slice(0, 6).map((table: any) => (
                      <div key={table.tableNumber} className="malts-card p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-[var(--malts-ink)]">
                              Маса {table.tableNumber}
                            </h3>
                            <p className="malts-muted text-sm">{table.location}</p>
                          </div>
                          <div className="text-2xl">🪑</div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="malts-muted">Поръчки:</span>
                            <span className="text-[var(--malts-ink)] font-semibold">{table.ordersCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="malts-muted">Приход:</span>
                            <span className="text-[var(--malts-ink)] font-semibold">
                              <Price priceBgn={Number(table.totalRevenue || 0)} />
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="malts-muted">Ср. поръчка:</span>
                            <span className="text-[var(--malts-ink)] font-semibold">
                              <Price priceBgn={Number(table.avgOrderValue || 0)} />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Section */}
              <div className="mt-8 malts-card p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-2">Експорт на данни</h3>
                    <p className="text-sm malts-muted">
                      Изтегли поръчките за избрания период в CSV формат за по-нататъшна обработка
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const csvData = await generateCSVExport();
                        if (csvData.length > 1) {
                          downloadCSV(csvData, `malts-orders-${statsFilters.dateFrom || new Date().toISOString().split('T')[0]}.csv`);
                          setToast({ message: '✅ Експорт завършен успешно!', type: 'success' });
                        } else {
                          setToast({ message: '⚠️ Няма данни за експорт за избрания период', type: 'error' });
                        }
                      } catch (error) {
                        setToast({ message: '❌ Грешка при експорт на данни', type: 'error' });
                      }
                    }}
                    className="malts-btn-primary malts-btn-admin-compact flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Изтегли CSV
                  </button>
                </div>
              </div>

              {/* QR Code Scan Statistics */}
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">📱 QR Сканирания</h2>
                
                {qrScanStatsLoading ? (
                  <div className="text-center py-8">
                    <ManagedLoadingScreen inline={true} message="Зареждане на статистика..." />
                  </div>
                ) : qrScanStats.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="malts-muted">Няма сканирания за избрания период</p>
                  </div>
                ) : (
                  <>
                  
                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 md:p-4">
                      <div className="malts-subtle text-xs md:text-sm mb-1">Всички маси</div>
                      <div className="text-2xl md:text-3xl font-bold text-[var(--malts-ink)]">{qrScanStats.length}</div>
                    </div>
                    <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 md:p-4">
                      <div className="malts-subtle text-xs md:text-sm mb-1">Активни</div>
                      <div className="text-2xl md:text-3xl font-bold text-[var(--malts-success)]">
                        {qrScanStats.filter(t => t.isActive).length}
                      </div>
                    </div>
                    <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 md:p-4">
                      <div className="malts-subtle text-xs md:text-sm mb-1">Деактивирани</div>
                      <div className="text-2xl md:text-3xl font-bold text-[var(--malts-danger)]">
                        {qrScanStats.filter(t => !t.isActive).length}
                      </div>
                    </div>
                    <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 md:p-4">
                      <div className="malts-subtle text-xs md:text-sm mb-1">Общо сканирания</div>
                      <div className="text-2xl md:text-3xl font-bold text-[var(--malts-info)]">
                        {qrScanStats.reduce((sum, t) => sum + (t.scanCount || 0), 0)}
                      </div>
                    </div>
                  </div>

                  {/* QR Scans Chart */}
                  {qrScanChartData && qrScanChartData.daily && qrScanChartData.daily.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-[var(--malts-ink)] mb-4">📊 Сканирания по дни</h3>
                      <div className="malts-card p-6">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={qrScanChartData.daily.map((day: any) => ({
                              date: formatBulgarianDate(day.date).replace(/ г\./g, '').trim(), // Get just date part without "г."
                              scans: day.scans
                            }))}
                            margin={{ top: 20, right: 10, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#9CA3AF"
                              tick={{ fill: '#9CA3AF' }}
                            />
                            <YAxis 
                              stroke="#9CA3AF"
                              tick={{ fill: '#9CA3AF' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--malts-card)',
                                border: '1px solid var(--malts-hairline)',
                                borderRadius: '8px',
                                color: 'var(--malts-ink)'
                              }}
                            />
                            <Bar dataKey="scans" radius={[8, 8, 0, 0]}>
                              {qrScanChartData.daily.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill="var(--malts-info)" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Scan Statistics Table - Desktop */}
                  <div className="malts-card overflow-hidden mb-4 hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--malts-inset)] border-b border-[var(--malts-hairline)]">
                          <tr>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold text-xs uppercase">Маса</th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold text-xs uppercase">Име</th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold text-xs uppercase">Статус</th>
                            <th className="text-right px-4 py-3 malts-subtle font-semibold text-xs uppercase">Сканирания</th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold text-xs uppercase">Последно сканиране</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--malts-hairline)]">
                          {qrScanStats.map((table) => (
                            <tr key={table.id} className={!table.isActive ? 'opacity-50' : 'hover:bg-[var(--malts-accent-tint)] transition-colors'}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-[var(--malts-ink)]">
                                  Маса {table.tableNumber}
                                </div>
                                {table.tableName && (
                                  <div className="text-sm malts-muted">{table.tableName}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {table.tableName ? (
                                  <span className="malts-muted">{table.tableName}</span>
                                ) : (
                                  <span className="malts-subtle">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  table.isActive
                                    ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                                    : 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                                }`}>
                                  {table.isActive ? '✓ Активна' : '✗ Спряна'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-[var(--malts-info)] font-bold text-lg">{table.scanCount || 0}</span>
                              </td>
                              <td className="px-4 py-3 text-sm malts-muted">
                                {table.lastScannedAt 
                                  ? formatBulgarianDateTime(table.lastScannedAt)
                                  : 'Никога'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Scan Statistics Cards - Mobile */}
                  <div className="md:hidden space-y-4">
                    {qrScanStats.map((table) => (
                      <div key={table.id} className={`malts-card rounded-lg p-4 ${!table.isActive ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-[var(--malts-ink)] text-lg">
                              Маса {table.tableNumber}
                            </div>
                            {table.tableName && (
                              <div className="text-sm malts-muted mt-1">{table.tableName}</div>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            table.isActive
                              ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                              : 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                          }`}>
                            {table.isActive ? 'Активна' : 'Спряна'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="malts-subtle text-sm">Сканирания:</span>
                            <span className="text-[var(--malts-info)] font-bold text-lg">{table.scanCount || 0}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="malts-subtle text-sm">Последно:</span>
                            <span className="malts-muted text-sm">
                              {table.lastScannedAt 
                                ? formatBulgarianDateTime(table.lastScannedAt)
                                : 'Никога'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 malts-card rounded-xl">
              <p className="malts-muted text-xl">Няма данни за статистики</p>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal - Coming in next response */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="malts-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--malts-ink)] mb-2">
                    Поръчка #{selectedOrder.orderNumber}
                  </h2>
                  <p className="malts-muted">
                    Маса {selectedOrder.tableNumber}
                  </p>
                </div>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-[var(--malts-subtle)] hover:text-[var(--malts-ink)] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Order Details */}
              <div className="space-y-6">
                {/* Items */}
                <div>
                  <h3 className="text-xl font-semibold text-[var(--malts-ink)] mb-3">Продукти</h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center bg-[var(--malts-inset)] border border-[var(--malts-hairline)] p-4 rounded-lg">
                        <div className="flex-1">
                          <p className="text-[var(--malts-ink)] font-medium">{item.productName}</p>
                          <p className="malts-muted text-sm">Количество: {item.quantity}</p>
                        </div>
                        <Price priceBgn={Number(item.priceBgn) * item.quantity} className="text-[var(--malts-ink)] font-semibold" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-[var(--malts-hairline)] pt-4">
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span className="text-[var(--malts-ink)]">Общо:</span>
                    <Price priceBgn={Number(selectedOrder.totalBgn)} className="text-[var(--malts-ink)]" />
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 space-y-2">
                  <p className="malts-muted text-sm">
                    Създадена: {formatBulgarianDateTime(selectedOrder.createdAt)}
                  </p>
                  {selectedOrder.completedAt && (
                    <p className="malts-muted text-sm">
                      Завършена: {formatBulgarianDateTime(selectedOrder.completedAt)}
                    </p>
                  )}
                  <p className="malts-muted text-sm">
                    Статус: <span className="font-semibold text-[var(--malts-ink)]">{selectedOrder.status}</span>
                  </p>
                  {selectedOrder.status === 'cancelled' && selectedOrder.cancellationReason && (
                    <div className="mt-3 pt-3 border-t border-[var(--malts-hairline)]">
                      <p className="malts-muted text-sm font-semibold mb-1">Причина за отказ:</p>
                      <MaltsInlineFeedback tone="error" className="text-sm" role="alert">
                        {selectedOrder.cancellationReason}
                      </MaltsInlineFeedback>
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                <div className="flex gap-4">
                    <button
                      onClick={() => setPendingDeleteOrderId(selectedOrder.id)}
                      className="malts-btn-danger malts-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
                    >
                      🗑️ Изтрий поръчка
                    </button>
                  <button
                    onClick={() => setShowOrderModal(false)}
                    className="malts-btn-secondary malts-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
                  >
                    Затвори
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">
              Поръчки изискващи одобрение ({pendingApprovals.length})
            </h2>
          </div>

          {approvalsLoading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <ManagedLoadingScreen 
                locale={locale} 
                inline={true}
                message="Зареждане на одобрения..."
                logoSize="small"
              />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-20 malts-card rounded-xl">
              <p className="malts-muted text-xl">Няма поръчки изискващи одобрение</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((approval: any) => (
                <div
                  key={approval.id}
                  className="malts-card rounded-xl p-6 border-2 border-[rgba(146,64,14,0.35)] bg-[rgba(146,64,14,0.08)] hover:bg-[rgba(146,64,14,0.10)] transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedApproval(approval);
                    setShowApprovalModal(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[var(--malts-ink)] mb-2">
                        Поръчка #{approval.order.orderNumber} - Маса {approval.tableNumber}
                      </h3>
                      <p className="text-[var(--malts-warning)] text-sm">
                        {approval.orderCount} поръчки за последните {approvalWindowMinutes} минути
                      </p>
                      <p className="malts-muted text-sm mt-1">
                        Заявена: {formatBulgarianDateTime(approval.requestedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[var(--malts-ink)]">
                        <Price priceBgn={Number(approval.order.totalBgn)} />
                      </p>
                      <p className="malts-muted text-sm">
                        {approval.order.items.length} артикула
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproveOrder(approval.orderId);
                      }}
                      className="flex-1 px-4 py-2 malts-btn-primary rounded-lg font-semibold transition-colors"
                    >
                      ✅ Одобри
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApproval(approval);
                        setShowApprovalModal(true);
                      }}
                      className="flex-1 px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-colors"
                    >
                      ❌ Откажи
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedApproval && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="malts-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--malts-hairline)]">
              <h2 className="text-2xl font-bold text-[var(--malts-ink)] mb-2">
                ⚠️ Поръчка изисква одобрение
              </h2>
              <p className="malts-muted">
                Маса {selectedApproval.tableNumber} - {selectedApproval.orderCount} поръчки за {approvalWindowMinutes} минути
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4">
                  Поръчка #{selectedApproval.order.orderNumber}
                </h3>
                <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="malts-muted">Маса:</span>
                    <span className="text-[var(--malts-ink)] font-semibold">{selectedApproval.order.tableNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="malts-muted">Дата/Час:</span>
                    <span className="text-[var(--malts-ink)] font-semibold">
                      {formatBulgarianDateTime(selectedApproval.order.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="malts-muted">Общо:</span>
                    <span className="text-[var(--malts-ink)] font-semibold text-lg">
                      <Price priceBgn={Number(selectedApproval.order.totalBgn)} />
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-md font-semibold text-[var(--malts-ink)] mb-3">Артикули:</h4>
                <div className="space-y-2">
                  {selectedApproval.order.items.map((item: any) => (
                    <div key={item.id} className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3 flex justify-between">
                      <span className="text-[var(--malts-ink)]">{item.productName} x {item.quantity}</span>
                      <span className="text-[var(--malts-ink)] font-semibold">
                        <Price priceBgn={Number(item.priceBgn) * item.quantity} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[rgba(146,64,14,0.08)] border border-[rgba(146,64,14,0.35)] rounded-lg p-4 mb-6">
                <p className="text-[var(--malts-warning)] text-sm">
                  <strong>Причина:</strong> Направени са {selectedApproval.orderCount} поръчки за последните {approvalWindowMinutes} минути. 
                  Заради съображения за сигурност и превантивно действие при потенциално неправомерни действия 
                  и хакерски атаки, тази поръчка изисква одобрение.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleApproveOrder(selectedApproval.orderId)}
                  disabled={processingApproval}
                  className="malts-btn-primary malts-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingApproval ? 'Обработване...' : '✅ Одобри'}
                </button>
                <button
                  onClick={() => handleRejectOrder(selectedApproval.orderId)}
                  disabled={processingApproval}
                  className="malts-btn-danger malts-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingApproval ? 'Обработване...' : '❌ Откажи'}
                </button>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedApproval(null);
                  }}
                  disabled={processingApproval}
                  className="malts-btn-secondary malts-btn-admin-compact rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Затвори
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!pendingDeleteOrderId}
        title="Изтриване на поръчка"
        message="Сигурен ли си, че искаш да изтриеш тази поръчка?\n\nТова действие е необратимо!"
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setPendingDeleteOrderId(null)}
        onConfirm={executeDeleteOrder}
      />

      <ConfirmModal
        open={showBulkDeleteConfirm}
        title="Масово изтриване"
        message={`Сигурен ли си, че искаш да изтриеш ${selectedOrderIds.size} поръчки?\n\nТова действие е необратимо!`}
        confirmLabel="Изтрий всички"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setShowBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
      />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={<ManagedLoadingScreen locale="bg" />}
    >
      <AdminOrdersPageContent />
    </Suspense>
  );
}

