'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';
import { useLockScroll } from '@/lib/use-lock-scroll';
import { formatBulgarianDateTime } from '@/lib/date-utils';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

interface QRCodeSettings {
  /** Фон на цялата картка (лого, рамка, текст). */
  backgroundColor: string;
  /** Фон на светлите полета на QR матрицата (и на SVG изображението). Може да се различава от фона на картата. */
  qrCodeBackgroundColor: string;
  textColor: string;
  qrCodeColor: string;
  qrCodeSize: number;
  qrCodeMargin: number; // отстояние на QR кода (margin в px)
  orientation: 'portrait' | 'landscape';
  logoUrl?: string;
  useLogo: boolean;
  logoText: string;
  logoSize: number;
  logoMargin: number; // отстояние на логото (margin в px)
  scanTextBg: string;
  scanTextEn: string;
  scanTextSize: number; // размер на текста в px
  scanTextMargin: number; // отстояние на текста (margin в px)
  cardWidth: number; // в cm
  cardHeight: number; // в cm
}

const DEFAULT_SETTINGS: QRCodeSettings = {
  backgroundColor: '#FFFFFF',
  qrCodeBackgroundColor: '#FFFFFF',
  textColor: '#000000',
  qrCodeColor: '#000000',
  qrCodeSize: 400,
  qrCodeMargin: 0, // px
  orientation: 'portrait',
  logoUrl: '',
  useLogo: false,
  logoText: "Malt's\nРесторант - Русе",
  logoSize: 80,
  logoMargin: 0, // px
  scanTextBg: 'Сканирай за меню и поръчка',
  scanTextEn: 'Scan for menu & order',
  scanTextSize: 20, // px
  scanTextMargin: 0, // px
  cardWidth: 8.5, // cm
  cardHeight: 5.5 // cm
};

// Logo Section Component with Collapsible functionality
function LogoSection({ settings, setSettings }: { settings: QRCodeSettings; setSettings: (s: QRCodeSettings) => void }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="malts-card rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--malts-card-hover)] transition-colors"
      >
        <h3 className="text-lg font-semibold text-[var(--malts-ink)] flex items-center gap-2">
          <span className="text-2xl">🖼️</span>
          Лого настройки
        </h3>
        <svg
          className={`w-5 h-5 text-[var(--malts-subtle)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="malts-label mb-3">
              Лого или текст
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="useLogo"
                  checked={!settings.useLogo}
                  onChange={() => setSettings({ ...settings, useLogo: false })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="malts-muted">📝 Текст</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="useLogo"
                  checked={settings.useLogo}
                  onChange={() => setSettings({ ...settings, useLogo: true })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="malts-muted">🖼️ Лого (изображение)</span>
              </label>
            </div>
          </div>
          
          {!settings.useLogo ? (
            <div>
              <label className="malts-label">
                Текст за лого
              </label>
              <textarea
                value={settings.logoText}
                onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                rows={3}
                className="malts-field"
                placeholder="Malt's&#10;Ресторант - Русе"
              />
              <p className="malts-help mt-1">Използвай нов ред (Enter) за нов ред в текста</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="malts-label">
                  URL на лого
                </label>
                <input
                  type="text"
                  value={settings.logoUrl || ''}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  className="malts-field"
                  placeholder="https://example.com/logo.png или /logo.png"
                />
                <p className="malts-help mt-1">Въведи пълен URL или път към изображението</p>
              </div>
              
              {settings.logoUrl && settings.logoUrl.trim() !== '' && (
                <div className="space-y-4 pt-2 border-t border-[var(--malts-hairline)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="malts-label">
                        Размер на логото (px)
                      </label>
                      <input
                        type="number"
                        min="40"
                        max="800"
                        step="10"
                        value={settings.logoSize}
                        onChange={(e) => setSettings({ ...settings, logoSize: parseInt(e.target.value) || 80 })}
                        className="malts-field"
                      />
                    </div>
                    <div>
                      <label className="malts-label">
                        Отстояние на логото (px)
                      </label>
                      <input
                        type="number"
                        min="-100"
                        max="100"
                        step="1"
                        value={settings.logoMargin}
                        onChange={(e) => setSettings({ ...settings, logoMargin: parseInt(e.target.value) || 0 })}
                        className="malts-field"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <p className="malts-help mb-2">Preview на логото (фон: {settings.backgroundColor}):</p>
                    <div className="relative inline-block">
                      <img 
                        src={settings.logoUrl} 
                        alt="Logo preview" 
                        className="object-contain border border-[var(--malts-hairline)] rounded p-2 bg-[var(--malts-card)]"
                        style={{
                          backgroundColor: settings.backgroundColor,
                          maxWidth: `${settings.logoSize}px`,
                          maxHeight: `${settings.logoSize}px`,
                          width: `${settings.logoSize}px`,
                          height: `${settings.logoSize}px`
                        }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector('.logo-error')) {
                            const errorMsg = document.createElement('div');
                            errorMsg.className = 'logo-error text-red-500 text-xs mt-1 p-2 border border-red-500 rounded bg-red-500/10';
                            errorMsg.textContent = `❌ Логото не може да се зареди: ${settings.logoUrl}`;
                            parent.appendChild(errorMsg);
                          }
                        }}
                        onLoad={() => {
                          const errorMsg = document.querySelector('.logo-error');
                          if (errorMsg) {
                            errorMsg.remove();
                          }
                        }}
                      />
                    </div>
                    <p className="malts-help mt-2 break-all">URL: {settings.logoUrl}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QRTable {
  id: string;
  tableNumber: number;
  tableName: string | null;
  isActive: boolean;
  redirectUrl: string | null;
  scanCount: number;
  lastScannedAt: string | null;
  qrCodeUrl: string | null;
}

export default function QRCodesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnsavedGenerateModal, setShowUnsavedGenerateModal] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [showRedirectsModal, setShowRedirectsModal] = useState(false);
  const [settings, setSettings] = useState<QRCodeSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<QRCodeSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // QR Redirects modal state
  const [redirectTables, setRedirectTables] = useState<QRTable[]>([]);
  const [redirectsLoading, setRedirectsLoading] = useState(false);
  const [editingTable, setEditingTable] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editTableName, setEditTableName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [redirectsToast, setRedirectsToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add table form state
  const [addTableNumber, setAddTableNumber] = useState<string>('');
  const [addTableName, setAddTableName] = useState<string>('');
  const [addingTable, setAddingTable] = useState(false);
  const [togglingTableId, setTogglingTableId] = useState<string | null>(null);
  const [deactivateTableConfirm, setDeactivateTableConfirm] = useState<QRTable | null>(null);
  
  // Filter and sort state
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'tableNumber' | 'scanCount' | 'lastScanned'>('tableNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useLockScroll(
    showConfirmModal || showRedirectsModal || showUnsavedGenerateModal || !!deactivateTableConfirm
  );

  // Load settings from API on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/qr/settings', {
          credentials: 'include' // Include cookies for authentication
        });
        const data = await response.json();
        
        if (data.success && data.settings) {
          const raw = data.settings as Partial<QRCodeSettings>;
          const loadedSettings: QRCodeSettings = {
            ...DEFAULT_SETTINGS,
            ...raw,
            qrCodeBackgroundColor:
              raw.qrCodeBackgroundColor != null && String(raw.qrCodeBackgroundColor).trim() !== ''
                ? String(raw.qrCodeBackgroundColor)
                : (raw.backgroundColor ?? DEFAULT_SETTINGS.backgroundColor),
          };
          setSettings(loadedSettings);
          setSavedSettings(loadedSettings); // Track saved settings
        } else {
          // Use default settings if none exist in database
          setSettings(DEFAULT_SETTINGS);
          setSavedSettings(DEFAULT_SETTINGS);
        }
      } catch (error) {
        // Error loading QR settings, use defaults
        setSettings(DEFAULT_SETTINGS);
        setSavedSettings(DEFAULT_SETTINGS);
      }
    };
    
    loadSettings();
    
    // Clean up any existing fallback messages
    const fallbacks = document.querySelectorAll('.logo-fallback');
    fallbacks.forEach(fb => fb.remove());
  }, []);

  // Load existing QR codes on mount
  useEffect(() => {
    loadExistingQRCodes();
  }, []);

  // Check if settings have been modified
  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Save settings to API
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSettingsSaveError(null);
    try {
      const response = await fetch('/api/qr/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ settings })
      });
      
      if (response.ok) {
        setSavedSettings(settings); // Update saved settings
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000); // Hide success message after 2 seconds
      } else {
        console.error('Failed to save QR settings:', response.status, response.statusText);
        setSettingsSaveError('Грешка при запазване на настройките. Моля опитайте отново.');
      }
    } catch (error) {
      console.error('Error saving QR settings:', error);
      setSettingsSaveError('Грешка при запазване на настройките. Моля опитайте отново.');
    } finally {
      setSaving(false);
    }
  };

  const loadExistingQRCodes = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      // Fetch all tables from database
      const response = await fetch('/api/tables');
      const data = await response.json();
      
      if (data.tables && data.tables.length > 0) {
        // Filter tables that have QR codes already generated
        const tablesWithQR = data.tables.filter((t: any) => t.qrCodeDataUrl);
        
        if (tablesWithQR.length > 0) {
          setTables(tablesWithQR);
          setGenerated(true);
        }
      }
    } catch (error) {
      // Error loading QR codes
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const generateQRCodes = async (confirmed: boolean = false) => {
    // Warn if there are unsaved changes
    if (hasUnsavedChanges && !confirmed) {
      setShowUnsavedGenerateModal(true);
      return;
    }

    if (generated && !confirmed) {
      setShowConfirmModal(true);
      return;
    }

    setLoading(true);
    setShowConfirmModal(false);
    try {
      // Use saved settings if no unsaved changes, otherwise use current settings
      const settingsToUse = hasUnsavedChanges ? settings : savedSettings;
      const response = await fetch('/api/qr/generate', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: {
            backgroundColor: settingsToUse.backgroundColor,
            qrCodeBackgroundColor: settingsToUse.qrCodeBackgroundColor,
            textColor: settingsToUse.textColor,
            qrCodeColor: settingsToUse.qrCodeColor,
            qrCodeSize: settingsToUse.qrCodeSize,
          },
        })
      });
      const data = await response.json();
      setTables(data.tables);
      setGenerated(true);
      // If unsaved changes were used, save them automatically after successful generation
      if (hasUnsavedChanges) {
        setSavedSettings(settings);
      }
    } catch (error) {
      // Error generating QR codes
    } finally {
      setLoading(false);
    }
  };

  const printAllQRCodes = () => {
    window.print();
  };

  // QR Redirects functions
  const loadRedirectTables = async () => {
    setRedirectsLoading(true);
    try {
      const response = await fetch('/api/qr/redirects');
      const data = await response.json();
      setRedirectTables(data.tables || []);
    } catch (error) {
      setRedirectsToast({ message: 'Грешка при зареждане', type: 'error' });
    } finally {
      setRedirectsLoading(false);
    }
  };

  const createTable = async () => {
    const n = Number(addTableNumber);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      setRedirectsToast({ message: 'Невалиден номер на маса', type: 'error' });
      return;
    }
    setAddingTable(true);
    try {
      const res = await fetch('/api/qr/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: n,
          tableName: addTableName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRedirectsToast({ message: data?.error || 'Грешка при добавяне', type: 'error' });
        return;
      }
      if (data.qrGenerated === false) {
        setRedirectsToast({
          message: '✅ Масата е добавена, но QR изображението не беше генерирано. Опитайте „Генерирай QR кодове“ за тази маса.',
          type: 'error',
        });
      } else {
        setRedirectsToast({ message: '✅ Масата е добавена и QR кодът е генериран', type: 'success' });
      }
      setAddTableNumber('');
      setAddTableName('');
      await loadRedirectTables();
      await loadExistingQRCodes({ silent: true });
    } catch (e) {
      setRedirectsToast({ message: 'Грешка при добавяне', type: 'error' });
    } finally {
      setAddingTable(false);
    }
  };

  const startEditingRedirect = (table: QRTable) => {
    setEditingTable(table.tableNumber);
    setEditUrl(table.redirectUrl || `/order?table=${table.tableNumber}`);
    setEditTableName(table.tableName || '');
    setEditIsActive(table.isActive);
  };

  const cancelEditingRedirect = () => {
    setEditingTable(null);
    setEditUrl('');
    setEditTableName('');
    setEditIsActive(true);
  };

  const saveRedirect = async (tableNumber: number) => {
    try {
      const response = await fetch('/api/qr/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          redirectUrl: editUrl,
          tableName: editTableName || null,
          isActive: editIsActive
        })
      });

      if (response.ok) {
        setRedirectsToast({ message: '✅ Успешно запазено', type: 'success' });
        await loadRedirectTables();
        cancelEditingRedirect();
        // Auto-close toast after 3 seconds
        setTimeout(() => {
          setRedirectsToast(null);
        }, 3000);
      } else {
        setRedirectsToast({ message: 'Грешка при запазване', type: 'error' });
        // Auto-close error toast after 5 seconds
        setTimeout(() => {
          setRedirectsToast(null);
        }, 5000);
      }
    } catch (error) {
      setRedirectsToast({ message: 'Грешка при запазване', type: 'error' });
      // Auto-close error toast after 5 seconds
      setTimeout(() => {
        setRedirectsToast(null);
      }, 5000);
    }
  };

  const performTableActiveChange = async (table: QRTable, nextActive: boolean) => {
    setTogglingTableId(table.id);
    try {
      const response = await fetch('/api/qr/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: table.tableNumber,
          isActive: nextActive,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRedirectsToast({ message: data?.error || 'Грешка при промяна на статуса', type: 'error' });
        setTimeout(() => setRedirectsToast(null), 5000);
        return;
      }
      setRedirectsToast({
        message: nextActive ? '✅ Масата е активирана' : '⛔ Масата е деактивирана',
        type: 'success',
      });
      await loadRedirectTables();
      setTimeout(() => setRedirectsToast(null), 3000);
    } catch {
      setRedirectsToast({ message: 'Грешка при промяна на статуса', type: 'error' });
      setTimeout(() => setRedirectsToast(null), 5000);
    } finally {
      setTogglingTableId(null);
    }
  };

  const toggleTableActive = (table: QRTable) => {
    const nextActive = !table.isActive;
    if (!nextActive) {
      setDeactivateTableConfirm(table);
      return;
    }
    void performTableActiveChange(table, true);
  };

  // Use global date formatter from lib/date-utils
  const formatDate = formatBulgarianDateTime;

  // Filter and sort tables
  const getFilteredAndSortedTables = () => {
    let filtered = [...redirectTables];

    // Apply status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(t => t.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(t => !t.isActive);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'tableNumber') {
        comparison = a.tableNumber - b.tableNumber;
      } else if (sortBy === 'scanCount') {
        comparison = a.scanCount - b.scanCount;
      } else if (sortBy === 'lastScanned') {
        const aDate = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
        const bDate = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;
        comparison = aDate - bDate;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredTables = getFilteredAndSortedTables();

  const downloadAllQRCodes = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      
      setLoading(true);
      
      const cards = document.querySelectorAll('.qr-card');
      if (cards.length === 0) return;
      
      // Temporarily remove borders for PDF generation
      const originalBorders: string[] = [];
      cards.forEach((card, index) => {
        const htmlCard = card as HTMLElement;
        originalBorders[index] = htmlCard.style.border || '';
        htmlCard.style.border = 'none';
        // Also remove border-4 class styling
        htmlCard.style.borderWidth = '0';
        htmlCard.style.borderStyle = 'none';
      });
      
      const pdf = new jsPDF({
        orientation: settings.orientation === 'portrait' ? 'portrait' : 'landscape',
        unit: 'cm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth(); // в cm
      const pageHeight = pdf.internal.pageSize.getHeight(); // в cm
      
      // Конвертираме cm в px за html2canvas (1cm ≈ 37.8px при 96 DPI)
      const cardWidthPx = settings.cardWidth * 37.8;
      const cardHeightPx = settings.cardHeight * 37.8;
      
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i] as HTMLElement;
        
        // Запазваме оригиналния размер
        const originalWidth = card.style.width;
        const originalHeight = card.style.height;
        const originalBoxSizing = card.style.boxSizing;
        
        // Задаваме точния размер за изтегляне
        card.style.width = `${cardWidthPx}px`;
        card.style.height = `${cardHeightPx}px`;
        card.style.boxSizing = 'border-box';
        
        const canvas = await html2canvas(card, {
          backgroundColor: settings.backgroundColor,
          scale: 2,
          logging: false,
          useCORS: true,
          width: cardWidthPx,
          height: cardHeightPx,
          ignoreElements: (element) => {
            return element.classList.contains('no-print');
          }
        });
        
        // Възстановяваме оригиналния размер
        card.style.width = originalWidth;
        card.style.height = originalHeight;
        card.style.boxSizing = originalBoxSizing;
        
        const imgData = canvas.toDataURL('image/png');
        
        // Центрираме картата на страницата
        const x = (pageWidth - settings.cardWidth) / 2;
        const y = (pageHeight - settings.cardHeight) / 2;
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'PNG', x, y, settings.cardWidth, settings.cardHeight);
      }
      
      // Restore original borders
      cards.forEach((card, index) => {
        const htmlCard = card as HTMLElement;
        if (originalBorders[index]) {
          htmlCard.style.border = originalBorders[index];
        } else {
          htmlCard.style.border = '';
          htmlCard.style.borderWidth = '';
          htmlCard.style.borderStyle = '';
        }
      });
      
      pdf.save(`qr-codes-${new Date().toISOString().split('T')[0]}.pdf`);
      setLoading(false);
    } catch (error) {
      // Error downloading QR codes
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 md:mb-8 no-print">
        <div className="mb-4">
          <h1 className="malts-admin-heading-font malts-admin-page-title mb-2">QR Кодове за маси</h1>
          {generated && tables.length > 0 && (
            <p className="malts-muted text-sm md:text-base">
              ✅ {tables.length} QR кода запазени в базата
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
          <button
            onClick={() => {
              setShowRedirectsModal(true);
              loadRedirectTables();
            }}
            className="malts-btn-secondary malts-btn-admin-compact rounded-lg font-semibold transition-all"
          >
            🔗 Пренасочвания
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="malts-btn-secondary malts-btn-admin-compact rounded-lg font-semibold transition-all"
          >
            {showSettings ? '❌ Затвори настройки' : '⚙️ Настройки'}
          </button>
          <button
            onClick={() => generateQRCodes(false)}
            disabled={loading}
            className="malts-btn-primary malts-btn-admin-compact rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Генериране...' : generated ? '🔄 Регенерирай' : '✨ Генерирай'}
          </button>
          {generated && (
            <>
              <button
                onClick={downloadAllQRCodes}
                disabled={loading}
                className="malts-btn-primary malts-btn-admin-compact rounded-lg font-semibold transition-all disabled:opacity-50"
              >
                {loading ? 'Изтегляне...' : '⬇️ Изтегли PDF'}
              </button>
              <button
                onClick={printAllQRCodes}
                className="malts-btn-primary malts-btn-admin-compact rounded-lg font-semibold transition-all"
              >
                🖨️ Принтирай
              </button>
            </>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 md:mb-8 malts-card p-4 md:p-6 no-print">
          <h2 className="text-xl md:text-2xl font-bold mb-6">Настройки на QR кодове</h2>
          
          <div className="space-y-6">
            {/* Section 1: Colors */}
            <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                Цветове
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Фон картка | Фон QR матрица | Тъмни модули | Текст */}
            <div>
              <label className="block text-sm font-medium malts-subtle mb-2">
                Фон на картата
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="flex-1 px-3 py-2 malts-inset rounded border border-[var(--malts-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium malts-subtle mb-2">
                Фон на QR кода
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.qrCodeBackgroundColor}
                  onChange={(e) => setSettings({ ...settings, qrCodeBackgroundColor: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.qrCodeBackgroundColor}
                  onChange={(e) => setSettings({ ...settings, qrCodeBackgroundColor: e.target.value })}
                  className="flex-1 px-3 py-2 malts-inset rounded border border-[var(--malts-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  placeholder="#FFFFFF"
                />
              </div>
              <p className="malts-help mt-1 text-xs">
                Светлите полета на матрицата; може да е различен от фона на картата.
              </p>
            </div>

            {/* QR Code Color (dark modules) */}
            <div>
              <label className="malts-label">
                Цвят на модулите (QR)
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.qrCodeColor}
                  onChange={(e) => setSettings({ ...settings, qrCodeColor: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.qrCodeColor}
                  onChange={(e) => setSettings({ ...settings, qrCodeColor: e.target.value })}
                  className="malts-field"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label className="malts-label">
                Цвят на буквите
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="malts-field"
                  placeholder="#000000"
                />
              </div>
            </div>

              </div>
            </div>

            {/* Section 2: Sizes and Spacing */}
            <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
              <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4 flex items-center gap-2">
                <span className="text-2xl">📐</span>
                Размери и отстояния
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="malts-label">
                    Размер на QR кода (px)
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="800"
                    step="50"
                    value={settings.qrCodeSize}
                    onChange={(e) => setSettings({ ...settings, qrCodeSize: parseInt(e.target.value) || 400 })}
                    className="malts-field"
                  />
                </div>

                <div>
                  <label className="malts-label">
                    Отстояние на QR кода (px)
                  </label>
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    step="1"
                    value={settings.qrCodeMargin}
                    onChange={(e) => setSettings({ ...settings, qrCodeMargin: parseInt(e.target.value) || 0 })}
                    className="malts-field"
                  />
                </div>

                <div>
                  <label className="malts-label">
                    Размер на текста (px)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="50"
                    step="1"
                    value={settings.scanTextSize}
                    onChange={(e) => setSettings({ ...settings, scanTextSize: parseInt(e.target.value) || 20 })}
                    className="malts-field"
                  />
                </div>

                <div>
                  <label className="malts-label">
                    Отстояние на текста (px)
                  </label>
                  <input
                    type="number"
                    min="-50"
                    max="50"
                    step="1"
                    value={settings.scanTextMargin}
                    onChange={(e) => setSettings({ ...settings, scanTextMargin: parseInt(e.target.value) || 0 })}
                    className="malts-field"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Card Layout */}
            <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
              <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4 flex items-center gap-2">
                <span className="text-2xl">📄</span>
                Ориентация и размери на картата
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="malts-label mb-3">
                    Ориентация на картата
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="orientation"
                        value="portrait"
                        checked={settings.orientation === 'portrait'}
                        onChange={(e) => setSettings({ ...settings, orientation: e.target.value as 'portrait' | 'landscape' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="malts-muted">📄 Портретна (продълговата / вертикална)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="orientation"
                        value="landscape"
                        checked={settings.orientation === 'landscape'}
                        onChange={(e) => setSettings({ ...settings, orientation: e.target.value as 'portrait' | 'landscape' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="malts-muted">🖼️ Ландшафтна (широка / хоризонтална)</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="malts-label">
                      Ширина на табелката (cm)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      step="0.5"
                      value={settings.cardWidth}
                      onChange={(e) => setSettings({ ...settings, cardWidth: parseFloat(e.target.value) || 8.5 })}
                      className="malts-field"
                    />
                    <p className="malts-help mt-1">Използва се при принтиране и PDF изтегляне</p>
                  </div>
                  <div>
                    <label className="malts-label">
                      Височина на табелката (cm)
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="15"
                      step="0.5"
                      value={settings.cardHeight}
                      onChange={(e) => setSettings({ ...settings, cardHeight: parseFloat(e.target.value) || 5.5 })}
                      className="malts-field"
                    />
                    <p className="malts-help mt-1">Използва се при принтиране и PDF изтегляне</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Scan Text */}
            <div className="bg-[var(--malts-inset)] rounded-lg p-4 border border-[var(--malts-hairline)]">
              <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4 flex items-center gap-2">
                <span className="text-2xl">📝</span>
                Текстове за сканиране
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="malts-label">
                    Текст за сканиране (Български)
                  </label>
                  <input
                    type="text"
                    value={settings.scanTextBg}
                    onChange={(e) => setSettings({ ...settings, scanTextBg: e.target.value })}
                    className="malts-field"
                    placeholder="Сканирай за меню и поръчка"
                  />
                </div>
                <div>
                  <label className="malts-label">
                    Текст за сканиране (English)
                  </label>
                  <input
                    type="text"
                    value={settings.scanTextEn}
                    onChange={(e) => setSettings({ ...settings, scanTextEn: e.target.value })}
                    className="malts-field"
                    placeholder="Scan for menu & order"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Logo Settings - Collapsible */}
            <LogoSection settings={settings} setSettings={setSettings} />
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--malts-hairline)]">
            {settingsSaveError && (
              <MaltsInlineFeedback tone="error" className="mb-4" role="alert">
                {settingsSaveError}
              </MaltsInlineFeedback>
            )}
            {hasUnsavedChanges && (
              <MaltsInlineFeedback tone="warning" className="mb-4" role="status">
                ⚠️ Има незаписани промени. Не забравяйте да натиснете &quot;Запази&quot; за да запазите настройките.
              </MaltsInlineFeedback>
            )}
            {saveSuccess && (
              <MaltsInlineFeedback tone="success" className="mb-4" role="status">
                ✅ Настройките са запазени успешно!
              </MaltsInlineFeedback>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm malts-muted flex-1">
                💡 Запазете настройките преди генериране/регенериране на QR кодовете. При генериране ще се използват запазените настройки.
              </p>
              <button
                onClick={handleSaveSettings}
                disabled={!hasUnsavedChanges || saving}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  hasUnsavedChanges && !saving
                    ? 'malts-btn-primary cursor-pointer'
                    : 'malts-btn-secondary opacity-50 cursor-not-allowed'
                }`}
              >
                {saving ? 'Запазване...' : '💾 Запази'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 no-print">
          <div className="malts-card p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4">⚠️ Потвърждение</h3>
            <p className="malts-muted mb-6">
              Сигурни ли сте, че искате да регенерирате всички QR кодове? 
              Това ще презапише текущите QR кодове с новите настройки.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 malts-btn-secondary rounded-lg font-semibold transition-all"
              >
                Отказ
              </button>
              <button
                onClick={() => generateQRCodes(true)}
                className="flex-1 px-4 py-2 malts-btn-danger rounded-lg font-semibold transition-all"
              >
                Да, регенерирай
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showUnsavedGenerateModal}
        title="Незаписани настройки"
        message={`Има незаписани промени в настройките. При генериране ще се използват текущите (незаписани) настройки.

Искате ли да продължите?`}
        confirmLabel="Продължи"
        cancelLabel="Отказ"
        tone="default"
        onCancel={() => setShowUnsavedGenerateModal(false)}
        onConfirm={() => {
          setShowUnsavedGenerateModal(false);
          void generateQRCodes(true);
        }}
      />

      <ConfirmModal
        open={!!deactivateTableConfirm}
        title="Деактивиране на маса"
        message={
          deactivateTableConfirm
            ? `Сигурни ли сте, че искате да деактивирате маса ${deactivateTableConfirm.tableNumber}? QR сканиранията няма да работят, докато не я активирате отново.`
            : ''
        }
        confirmLabel="Да, спри масата"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeactivateTableConfirm(null)}
        onConfirm={() => {
          const t = deactivateTableConfirm;
          setDeactivateTableConfirm(null);
          if (t) void performTableActiveChange(t, false);
        }}
      />

      {loading && !generated && (
        <ManagedLoadingScreen locale="bg" />
      )}

      {!loading && !generated && (
        <div className="text-center py-20 malts-card rounded-xl">
          <div className="text-6xl mb-4">📱</div>
          <p className="text-[var(--malts-ink)] text-xl mb-4">
            Няма генерирани QR кодове
          </p>
          <p className="malts-muted text-sm mb-2">
            Кликнете "Генерирай QR кодове" за да създадете QR кодове за всички 30 маси
          </p>
          <p className="malts-muted text-sm">
            QR кодовете ще се запазят в базата данни и ще са достъпни винаги
          </p>
        </div>
      )}

      {generated && (
        <>
          <style jsx global>{`
            /* Safari / mobile: QR matrix scales down inside card (fixed px was clipping) */
            @media screen {
              .qr-card .qr-code-container {
                min-width: 0;
                max-width: 100%;
              }
              .qr-card .qr-code-container img[data-qr-matrix="1"] {
                width: min(100%, ${settings.qrCodeSize || 400}px) !important;
                height: auto !important;
                max-width: 100% !important;
                aspect-ratio: 1 / 1;
                object-fit: contain;
                -webkit-user-select: none;
                user-select: none;
              }
            }
            @media (max-width: 640px) {
              .qr-card {
                max-width: calc(100vw - 2rem) !important;
                width: auto !important;
                height: auto !important;
                aspect-ratio: ${settings.cardWidth} / ${settings.cardHeight} !important;
              }
            }
            
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print,
              .no-print * {
                display: none !important;
                visibility: hidden !important;
              }
              .qr-card,
              .qr-card * {
                visibility: visible !important;
              }
              .grid {
                display: grid !important;
                grid-template-columns: ${settings.orientation === 'portrait' ? 'repeat(1, 1fr)' : 'repeat(1, 1fr)'} !important;
                gap: 1rem !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
              }
              .qr-card { 
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: auto !important;
                margin: 0 auto !important;
                width: ${settings.cardWidth}cm !important;
                height: ${settings.cardHeight}cm !important;
                max-width: ${settings.cardWidth}cm !important;
                max-height: ${settings.cardHeight}cm !important;
                box-sizing: border-box !important;
                background-color: ${settings.backgroundColor} !important;
                color: ${settings.textColor} !important;
                border: none !important;
                box-shadow: none !important;
                overflow: hidden !important;
              }
              .qr-card .flex-shrink-0 {
                flex-shrink: 0 !important;
              }
              .qr-card .flex-1 {
                flex: 1 !important;
              }
              .qr-card * {
                color: ${settings.textColor} !important;
              }
              .qr-card img {
                max-width: 100% !important;
                height: auto !important;
                border: none !important;
              }
              .qr-card p {
                margin: 0.125rem 0 !important;
                padding: 0 !important;
                line-height: 1.3 !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                font-size: ${settings.scanTextSize}px !important;
              }
              .qr-card > div {
                margin-bottom: 0.5rem !important;
              }
              .qr-card > div:last-child {
                margin-bottom: 0 !important;
              }
              .qr-card .flex {
                gap: 0.5rem !important;
              }
              .qr-card .border-t-2 {
                margin-top: 0.75rem !important;
                padding-top: 0.5rem !important;
              }
              .qr-card .qr-code-container {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                background-color: ${settings.qrCodeBackgroundColor} !important;
              }
              @page {
                size: ${settings.orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape'};
                margin: 10mm;
              }
            }
          `}</style>

          <div className={`grid grid-cols-1 ${settings.orientation === 'portrait' ? 'sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3' : 'sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'} gap-6 md:gap-8`}>
            {tables.map((table) => (
              <div
                key={`${table.tableNumber}-${settings.qrCodeSize}-${settings.orientation}-${settings.qrCodeBackgroundColor}-${settings.qrCodeColor}`}
                className="qr-card"
                style={{ 
                  backgroundColor: settings.backgroundColor,
                  color: settings.textColor,
                  border: '2px dashed #9ca3af',
                  boxShadow: 'none',
                  margin: '0 auto',
                  width: `${settings.cardWidth}cm`,
                  height: `${settings.cardHeight}cm`,
                  maxWidth: `${settings.cardWidth}cm`,
                  maxHeight: `${settings.cardHeight}cm`,
                  padding: '1rem 1.5rem',
                  boxSizing: 'border-box',
                  display: settings.orientation === 'portrait' ? 'flex' : 'flex',
                  flexDirection: settings.orientation === 'portrait' ? 'column' : 'row',
                  alignItems: settings.orientation === 'portrait' ? 'stretch' : 'flex-start',
                  textAlign: settings.orientation === 'portrait' ? 'center' : 'left',
                  gap: settings.orientation === 'landscape' ? '1.5rem' : '0',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {settings.orientation === 'portrait' ? (
                  <>
                    {/* Logo */}
                    {settings.useLogo && settings.logoUrl && settings.logoUrl.trim() !== '' ? (
                      <div style={{ margin: `${settings.logoMargin}px`, paddingTop: '0', paddingBottom: '0', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <img 
                          src={settings.logoUrl} 
                          alt="Logo" 
                          style={{ 
                            maxWidth: '100%', 
                            display: 'block',
                            width: `${settings.logoSize}px`,
                            height: 'auto',
                            margin: '0'
                          }}
                          onError={(e) => {
                            // Logo failed to load
                          }}
                          onLoad={(e) => {
                            // Logo loaded successfully
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ margin: `${settings.logoMargin}px`, paddingTop: '0', paddingBottom: '0' }}>
                        {settings.logoText.split('\n').map((line, i) => (
                          <div key={i} style={{ color: settings.textColor, margin: '0' }} className={i === 0 ? "text-2xl md:text-4xl font-bold" : "text-xs md:text-sm"}>
                            {line}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* QR code */}
                    <div 
                      className="qr-code-container"
                      style={{ 
                        border: 'none',
                        padding: '0', 
                        margin: `${settings.qrCodeMargin}px`,
                        display: 'block', 
                        width: '100%', 
                        textAlign: 'center',
                        backgroundColor: settings.qrCodeBackgroundColor,
                      }}
                    >
                      <img
                        data-qr-matrix="1"
                        src={table.qrCodeDataUrl}
                        alt={`QR Code Маса ${table.tableNumber}`}
                        style={{ 
                          border: 'none',
                          display: 'block',
                          margin: '0 auto',
                          backgroundColor: 'transparent',
                          borderRadius: '0'
                        }}
                      />
                    </div>
                    
                    {/* Scan instructions with border on top - pushed to bottom, full width */}
                    <div 
                      className="border-t-2 mt-auto" 
                      style={{ 
                        borderColor: settings.backgroundColor === '#000000' || settings.backgroundColor === '#000' ? '#374151' : '#cbd5e1', 
                        width: '100%',
                        marginLeft: '-1rem',
                        marginRight: '-1rem',
                        marginTop: `${settings.scanTextMargin}px`,
                        paddingTop: '0.025rem',
                        paddingLeft: '1rem',
                        paddingRight: '1rem',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="flex items-center gap-3" style={{ width: '100%', minWidth: '0' }}>
                        <img 
                          src="/smartphone_10450488.png" 
                          alt="Smartphone" 
                          className="flex-shrink-0"
                          style={{ 
                            width: '4rem', 
                            height: '5rem', 
                            objectFit: 'contain'
                          }}
                        />
                        <div style={{ flex: '1 1 0%', minWidth: '0', width: '100%' }}>
                          <p style={{ 
                            color: settings.textColor, 
                            fontSize: `${settings.scanTextSize}px`,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            margin: '0',
                            padding: '0',
                            lineHeight: '1.3'
                          }} className="font-semibold mb-1">
                            {settings.scanTextBg}
                          </p>
                          <p style={{ 
                            color: settings.textColor, 
                            fontSize: `${settings.scanTextSize}px`,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            margin: '0',
                            padding: '0',
                            lineHeight: '1.3'
                          }} className="font-semibold">
                            {settings.scanTextEn}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-shrink-0">
                      <div 
                        className="qr-code-container"
                        style={{ 
                          border: 'none',
                          backgroundColor: settings.qrCodeBackgroundColor,
                          padding: '0',
                          margin: `${settings.qrCodeMargin}px`,
                          borderRadius: '0'
                        }}
                      >
                        <img
                          data-qr-matrix="1"
                          src={table.qrCodeDataUrl}
                          alt={`QR Code Маса ${table.tableNumber}`}
                          style={{ 
                            border: 'none', 
                            display: 'block',
                            margin: '0',
                            backgroundColor: 'transparent',
                            borderRadius: '0'
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      {/* Logo */}
                      {settings.useLogo && settings.logoUrl && settings.logoUrl.trim() !== '' ? (
                        <div style={{ margin: `${settings.logoMargin}px`, padding: '0' }}>
                          <img 
                            src={settings.logoUrl} 
                            alt="Logo" 
                            className="object-contain"
                            style={{ 
                              maxWidth: '100%', 
                              display: 'block',
                              width: `${settings.logoSize}px`,
                              height: 'auto',
                              margin: '0',
                              padding: '0'
                            }}
                            onError={(e) => {
                              // Logo failed to load
                            }}
                            onLoad={(e) => {
                              // Logo loaded successfully
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ margin: `${settings.logoMargin}px`, padding: '0' }}>
                          {settings.logoText.split('\n').map((line, i) => (
                            <div key={i} style={{ color: settings.textColor, margin: '0', padding: '0' }} className={i === 0 ? "text-2xl md:text-4xl font-bold" : "text-xs md:text-sm"}>
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Scan instructions with border on top - pushed to bottom, full width - OUTSIDE flex div */}
                    <div 
                      className="border-t-2" 
                      style={{ 
                        borderColor: settings.backgroundColor === '#000000' || settings.backgroundColor === '#000' ? '#374151' : '#cbd5e1', 
                        position: 'absolute',
                        bottom: `${1 + settings.scanTextMargin / 16}rem`,
                        left: '0',
                        right: '0',
                        width: '100%',
                        paddingTop: '0.025rem',
                        paddingLeft: '1rem',
                        paddingRight: '1rem',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="flex items-center gap-3" style={{ width: '100%', minWidth: '0' }}>
                        <img 
                          src="/smartphone_10450488.png" 
                          alt="Smartphone" 
                          className="flex-shrink-0"
                          style={{ 
                            width: '4rem', 
                            height: '5rem', 
                            objectFit: 'contain'
                          }}
                        />
                        <div style={{ flex: '1 1 0%', minWidth: '0', width: '100%' }}>
                          <p style={{ 
                            color: settings.textColor, 
                            fontSize: `${settings.scanTextSize}px`,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            margin: '0',
                            padding: '0',
                            lineHeight: '1.3'
                          }} className="font-semibold mb-1">
                            {settings.scanTextBg}
                          </p>
                          <p style={{ 
                            color: settings.textColor, 
                            fontSize: `${settings.scanTextSize}px`,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            margin: '0',
                            padding: '0',
                            lineHeight: '1.3'
                          }} className="font-semibold">
                            {settings.scanTextEn}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* QR Redirects Modal */}
      {showRedirectsModal && (
        <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="malts-card rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-[var(--malts-hairline)] flex justify-between items-start md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl md:text-2xl font-bold">🔗 Пренасочвания</h2>
                <p className="malts-muted text-xs md:text-sm mt-1">
                  Управление на URL адресите на QR кодовете. Промените се прилагат веднага без да принтирате нови кодове.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRedirectsModal(false);
                  cancelEditingRedirect();
                }}
                className="text-[var(--malts-ink)] text-2xl md:text-3xl hover:text-[var(--malts-accent)] transition-colors flex-shrink-0"
                aria-label="Затвори"
              >
                ×
              </button>
            </div>

            {/* Toast Notification */}
            {redirectsToast && (
              <MaltsInlineFeedback
                tone={redirectsToast.type === 'success' ? 'success' : 'error'}
                className="mx-4 mt-4 flex items-center justify-between gap-3"
                role={redirectsToast.type === 'success' ? 'status' : 'alert'}
              >
                <span className="min-w-0 leading-snug">{redirectsToast.message}</span>
                <button
                  type="button"
                  onClick={() => setRedirectsToast(null)}
                  className="ml-4 shrink-0 text-[var(--malts-subtle)] hover:text-[var(--malts-ink)] transition-colors text-xl font-bold"
                  aria-label="Затвори"
                >
                  ×
                </button>
              </MaltsInlineFeedback>
            )}

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {redirectsLoading ? (
                <div className="text-center py-12">
                  <p className="malts-muted">Зареждане...</p>
                </div>
              ) : (
                <>
                  {/* Add Table */}
                  <div className="malts-card rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                    <h3 className="text-lg font-bold text-[var(--malts-ink)] mb-3">➕ Добави маса</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="malts-label">Номер *</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={addTableNumber}
                          onChange={(e) => setAddTableNumber(e.target.value)}
                          className="malts-field"
                          placeholder="напр. 20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="malts-label">Етикет (по избор)</label>
                        <input
                          type="text"
                          value={addTableName}
                          onChange={(e) => setAddTableName(e.target.value.slice(0, 18))}
                          className="malts-field"
                          placeholder="напр. Тераса"
                        />
                        <p className="malts-help mt-1">До 18 символа.</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={createTable}
                        disabled={addingTable}
                        className="malts-btn-primary malts-btn-admin-compact rounded-lg font-semibold disabled:opacity-50"
                      >
                        {addingTable ? 'Добавяне...' : 'Добави'}
                      </button>
                    </div>
                  </div>

                  {/* Statistics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 md:mb-6">
                    <div className="malts-card rounded-lg p-4">
                      <div className="malts-subtle text-sm mb-1">Всички маси</div>
                      <div className="text-3xl font-bold">{redirectTables.length}</div>
                    </div>
                    <div className="malts-card rounded-lg p-4">
                      <div className="malts-subtle text-sm mb-1">Активни</div>
                      <div className="text-3xl font-bold text-green-500">
                        {redirectTables.filter(t => t.isActive).length}
                      </div>
                    </div>
                    <div className="malts-card rounded-lg p-4">
                      <div className="malts-subtle text-sm mb-1">Деактивирани</div>
                      <div className="text-3xl font-bold text-red-500">
                        {redirectTables.filter(t => !t.isActive).length}
                      </div>
                    </div>
                    <div className="malts-card rounded-lg p-4">
                      <div className="malts-subtle text-sm mb-1">Общо сканирания</div>
                      <div className="text-3xl font-bold text-blue-500">
                        {redirectTables.reduce((sum, t) => sum + t.scanCount, 0)}
                      </div>
                    </div>
                  </div>

                  {/* Filters and Sort */}
                  <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 md:p-6 mb-4 md:mb-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                      <div className="flex flex-col sm:flex-row gap-3 flex-1">
                        {/* Status Filter */}
                        <div className="flex-1">
                          <label className="malts-label text-xs md:text-sm">Филтър по статус</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setFilterStatus('all')}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                filterStatus === 'all'
                                  ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                                  : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
                              }`}
                            >
                              Всички
                            </button>
                            <button
                              onClick={() => setFilterStatus('active')}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                filterStatus === 'active'
                                  ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                                  : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
                              }`}
                            >
                              Активни
                            </button>
                            <button
                              onClick={() => setFilterStatus('inactive')}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                filterStatus === 'inactive'
                                  ? 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                                  : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
                              }`}
                            >
                              Деактивирани
                            </button>
                          </div>
                        </div>

                        {/* Sort By */}
                        <div className="flex-1">
                          <label className="malts-label text-xs md:text-sm">Сортиране по</label>
                          <div className="flex gap-2">
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'tableNumber' | 'scanCount' | 'lastScanned')}
                              className="malts-field"
                            >
                              <option value="tableNumber">Номер на маса</option>
                              <option value="scanCount">Брой сканирания</option>
                              <option value="lastScanned">Последно сканиране</option>
                            </select>
                            <button
                              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                              className="px-4 py-2 malts-btn-secondary rounded-lg text-[var(--malts-ink)] text-sm transition-colors"
                              title={sortOrder === 'asc' ? 'Възходящо' : 'Низходящо'}
                            >
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Results count */}
                      <div className="text-right">
                        <div className="text-xs md:text-sm malts-muted">
                          Показва се {filteredTables.length} от {redirectTables.length} маси
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tables List */}
                  <div className="malts-card overflow-hidden">
                    {/* Desktop Table View - hidden on mobile */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--malts-inset)] border-b border-[var(--malts-hairline)]">
                          <tr>
                            <th 
                              className="text-left px-4 py-3 malts-subtle font-semibold cursor-pointer hover:text-[var(--malts-ink)] transition-colors" 
                              onClick={() => { setSortBy('tableNumber'); setSortOrder(sortBy === 'tableNumber' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                            >
                              Маса {sortBy === 'tableNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="text-left px-2 py-3 malts-subtle font-semibold w-[1%] whitespace-nowrap">Статус</th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold">QR Link</th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold">Redirect URL</th>
                            <th 
                              className="text-left px-4 py-3 malts-subtle font-semibold cursor-pointer hover:text-[var(--malts-ink)] transition-colors" 
                              onClick={() => { setSortBy('scanCount'); setSortOrder(sortBy === 'scanCount' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                            >
                              Сканирания {sortBy === 'scanCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                              className="text-left px-4 py-3 malts-subtle font-semibold cursor-pointer hover:text-[var(--malts-ink)] transition-colors" 
                              onClick={() => { setSortBy('lastScanned'); setSortOrder(sortBy === 'lastScanned' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                            >
                              Последно {sortBy === 'lastScanned' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="text-left px-4 py-3 malts-subtle font-semibold">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--malts-hairline)]">
                          {filteredTables.map((table) => (
                            <tr key={table.id} className={!table.isActive ? 'opacity-50' : ''}>
                              <td className="px-4 py-3">
                                {editingTable === table.tableNumber ? (
                                  <input
                                    type="text"
                                    value={editTableName}
                                    onChange={(e) => setEditTableName(e.target.value)}
                                    placeholder={`Маса ${table.tableNumber}`}
                                    className="malts-field"
                                  />
                                ) : (
                                  <>
                                    <div className="font-semibold text-[var(--malts-ink)]">
                                      Маса {table.tableNumber}
                                    </div>
                                    {table.tableName && (
                                      <div className="text-sm malts-muted">{table.tableName}</div>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="px-2 py-3 align-middle">
                                {editingTable === table.tableNumber ? (
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editIsActive}
                                      onChange={(e) => setEditIsActive(e.target.checked)}
                                      className="w-4 h-4 shrink-0 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)]"
                                    />
                                    <span className="text-[var(--malts-ink)] text-[11px] sm:text-xs leading-tight">
                                      {editIsActive ? 'Активна' : 'Спряна'}
                                    </span>
                                  </label>
                                ) : (
                                  <span
                                    className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none sm:px-2 sm:py-1 sm:text-xs ${
                                      table.isActive
                                        ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                                        : 'bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)]'
                                    }`}
                                    title={table.isActive ? 'Активна' : 'Спряна'}
                                  >
                                    {table.isActive ? 'Активна' : 'Спряна'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <code className="text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded break-all">
                                  /t/{table.tableNumber}
                                </code>
                              </td>
                              <td className="px-4 py-3">
                                {editingTable === table.tableNumber ? (
                                  <input
                                    type="text"
                                    value={editUrl}
                                    onChange={(e) => setEditUrl(e.target.value)}
                                    className="malts-field"
                                    placeholder="/order?table=1"
                                  />
                                ) : (
                                  <code className="text-sm malts-muted break-all">
                                    {table.redirectUrl || `/order?table=${table.tableNumber}`}
                                  </code>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[var(--malts-ink)] font-semibold">{table.scanCount}</span>
                              </td>
                              <td className="px-4 py-3 text-sm malts-muted">
                                {formatDate(table.lastScannedAt)}
                              </td>
                              <td className="px-4 py-3">
                                {editingTable === table.tableNumber ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveRedirect(table.tableNumber)}
                                      className="px-3 py-1 malts-btn-primary text-sm rounded transition-colors"
                                    >
                                      ✓ Запази
                                    </button>
                                    <button
                                      onClick={cancelEditingRedirect}
                                      className="px-3 py-1 malts-btn-secondary text-sm rounded transition-colors"
                                    >
                                      ✗ Откажи
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startEditingRedirect(table)}
                                      disabled={togglingTableId === table.id}
                                      className="px-3 py-1 malts-btn-secondary text-sm rounded transition-colors disabled:opacity-50"
                                    >
                                      ✎ Редактирай
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleTableActive(table)}
                                      disabled={togglingTableId === table.id}
                                      className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
                                        table.isActive
                                          ? 'border border-[rgba(153,27,27,0.35)] text-[var(--malts-danger)] bg-[rgba(153,27,27,0.08)] hover:bg-[rgba(153,27,27,0.14)]'
                                          : 'malts-btn-primary'
                                      }`}
                                    >
                                      {togglingTableId === table.id
                                        ? '…'
                                        : table.isActive
                                          ? '⏸ Спри маса'
                                          : '▶ Активирай'}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View - visible only on mobile */}
                    <div className="md:hidden space-y-4 p-4">
                      {filteredTables.map((table) => (
                        <div
                          key={table.id}
                          className={`bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-4 space-y-3 ${!table.isActive ? 'opacity-50' : ''}`}
                        >
                          {/* Header: Table Number & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {editingTable === table.tableNumber ? (
                                <input
                                  type="text"
                                  value={editTableName}
                                  onChange={(e) => setEditTableName(e.target.value)}
                                  placeholder={`Маса ${table.tableNumber}`}
                                  className="malts-field"
                                />
                              ) : (
                                <>
                                  <div className="font-semibold text-[var(--malts-ink)] text-lg">
                                    Маса {table.tableNumber}
                                  </div>
                                  {table.tableName && (
                                    <div className="text-sm malts-muted mt-1">{table.tableName}</div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="shrink-0 self-start">
                              {editingTable === table.tableNumber ? (
                                <label className="flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={editIsActive}
                                    onChange={(e) => setEditIsActive(e.target.checked)}
                                    className="h-5 w-5 shrink-0 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)]"
                                  />
                                  <span className="text-[11px] leading-tight text-[var(--malts-ink)] sm:text-xs">
                                    {editIsActive ? 'Активна' : 'Спряна'}
                                  </span>
                                </label>
                              ) : (
                                <span
                                  className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none sm:px-2 sm:py-1 sm:text-xs ${
                                    table.isActive
                                      ? 'border border-[rgba(22,101,52,0.25)] bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)]'
                                      : 'border border-[rgba(153,27,27,0.25)] bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)]'
                                  }`}
                                  title={table.isActive ? 'Активна' : 'Спряна'}
                                >
                                  {table.isActive ? 'Активна' : 'Спряна'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* QR Link */}
                          <div>
                            <div className="text-xs malts-muted mb-1">QR Link</div>
                            <code className="text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded break-all block">
                              /t/{table.tableNumber}
                            </code>
                          </div>

                          {/* Redirect URL */}
                          <div>
                            <div className="text-xs malts-muted mb-1">Redirect URL</div>
                            {editingTable === table.tableNumber ? (
                              <input
                                type="text"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                className="malts-field"
                                placeholder="/order?table=1"
                              />
                            ) : (
                              <code className="text-sm malts-muted break-all block bg-[var(--malts-card)] px-2 py-1 rounded border border-[var(--malts-hairline)]">
                                {table.redirectUrl || `/order?table=${table.tableNumber}`}
                              </code>
                            )}
                          </div>

                          {/* Stats Row */}
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--malts-hairline)]">
                            <div>
                              <div className="text-xs malts-muted mb-1">Сканирания</div>
                              <div className="text-[var(--malts-ink)] font-semibold">{table.scanCount}</div>
                            </div>
                            <div>
                              <div className="text-xs malts-muted mb-1">Последно</div>
                              <div className="text-sm malts-muted">{formatDate(table.lastScannedAt)}</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-2">
                            {editingTable === table.tableNumber ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveRedirect(table.tableNumber)}
                                  className="flex-1 px-4 py-2 malts-btn-primary text-sm rounded transition-colors font-semibold"
                                >
                                  ✓ Запази
                                </button>
                                <button
                                  onClick={cancelEditingRedirect}
                                  className="flex-1 px-4 py-2 malts-btn-secondary text-sm rounded transition-colors font-semibold"
                                >
                                  ✗ Откажи
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditingRedirect(table)}
                                  disabled={togglingTableId === table.id}
                                  className="flex-1 px-4 py-2 malts-btn-secondary text-sm rounded transition-colors font-semibold disabled:opacity-50"
                                >
                                  ✎ Редактирай
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleTableActive(table)}
                                  disabled={togglingTableId === table.id}
                                  className={`flex-1 px-4 py-2 text-sm rounded transition-colors font-semibold disabled:opacity-50 ${
                                    table.isActive
                                      ? 'border border-[rgba(153,27,27,0.35)] text-[var(--malts-danger)] bg-[rgba(153,27,27,0.08)]'
                                      : 'malts-btn-primary'
                                  }`}
                                >
                                  {togglingTableId === table.id
                                    ? '…'
                                    : table.isActive
                                      ? '⏸ Спри'
                                      : '▶ Включи'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-4 md:mt-6 border border-[var(--malts-hairline)] rounded-lg bg-[var(--malts-inset)] p-4 md:p-6">
                    <h3 className="mb-3 text-sm font-semibold text-[var(--malts-ink)] md:text-base">
                      💡 Как работят динамичните QR кодове?
                    </h3>
                    <ul className="space-y-3 text-xs leading-relaxed text-[var(--malts-ink)] md:text-sm">
                      <li>
                        <strong className="text-[var(--malts-ink)]">QR линк</strong> — краткият адрес{' '}
                        <code className="rounded bg-[var(--malts-card)] px-1.5 py-0.5 text-[var(--malts-ink)] ring-1 ring-[var(--malts-hairline)]">
                          /t/[номер]
                        </code>{' '}
                        е <strong>вграден в QR кода</strong> (статичен). Ако го смените, трябва <strong>нов</strong> отпечатан/генериран код.
                      </li>
                      <li>
                        <strong className="text-[var(--malts-ink)]">Redirect URL</strong> — към него сочи{' '}
                        <code className="rounded bg-[var(--malts-card)] px-1.5 py-0.5 text-[var(--malts-ink)] ring-1 ring-[var(--malts-hairline)]">
                          /t/[номер]
                        </code>
                        ; сменяте го <strong>тук, без</strong> нова щампа на QR.
                      </li>
                      <li>
                        Можете да <strong>деактивирате</strong> маса временно; в таблицата се виждат <strong>сканиранията</strong> по маса.
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


