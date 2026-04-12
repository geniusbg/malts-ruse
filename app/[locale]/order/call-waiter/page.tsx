'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Toast from '@/components/Toast';
import { useLockScroll } from '@/lib/use-lock-scroll';

function CallWaiterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialTableNumber = searchParams.get('table');
  const [tableNumber, setTableNumber] = useState<string | null>(initialTableNumber);
  
  // Get locale from URL path
  const locale = pathname.split('/')[1] || 'bg';

  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useLockScroll(sessionStatus !== 'valid');

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
        return { ok: true as const };
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
        : 'Așteptați verificarea conexiunii.')
    : (sessionMessage || getSessionMessageForReason());
  
  const callWaiter = async (callType: string) => {
    if (calling || sessionStatus !== 'valid') {
      setToast({
        message: sessionMessage || getSessionMessageForReason(),
        type: 'error'
      });
      return;
    }
    
    setCalling(true);

    try {
      const sessionCheck = await validateSession({ silent: true });
      if (!sessionCheck.ok) {
        setToast({
          message: getSessionMessageForReason(sessionCheck.reason),
          type: 'error'
        });
        setCalling(false);
        return;
      }

      const messages = {
        payment_cash: {
          bg: 'Плащане с брой',
          en: 'Payment with cash',
          ro: 'Plată numerar',
        },
        payment_card: {
          bg: 'Плащане с карта',
          en: 'Payment with card',
          ro: 'Plată cu cardul',
        },
        help: {
          bg: 'Нужна помощ',
          en: 'Need help',
          ro: 'Am nevoie de ajutor',
        },
      };

      const message = messages[callType as keyof typeof messages][locale as 'bg' | 'en' | 'ro'];

      const response = await fetch('/api/waiter-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: parseInt(tableNumber || '0'),
          callType,
          message
        })
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        setCalled(true);
        setTimeout(() => {
          router.back();
        }, 3000);
      } else {
        if (response.status === 401) {
          const messageText = getSessionMessageForReason(responseData.reason);
          setSessionStatus('invalid');
          setSessionMessage(messageText);
          setToast({ message: messageText, type: 'error' });
        } else {
          const errorMsg = locale === 'bg' ? '❌ Грешка при повикване' : 
                          locale === 'en' ? '❌ Error calling waiter' : 
                          '❌ Fehler beim Anrufen des Kellners';
          setToast({ message: errorMsg, type: 'error' });
        }
      }
    } catch (error) {
      const errorMsg = locale === 'bg' ? '❌ Грешка при повикване' : 
                      locale === 'en' ? '❌ Error calling waiter' : 
                      '❌ Fehler beim Anrufen des Kellners';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setCalling(false);
    }
  };

  if (called) {
    return (
      <div className="min-h-screen malts-surface flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-8">✅</div>
          <h1 className="text-4xl font-bold mb-4">
            {locale === 'bg' ? 'Сервитьорът е повикан!' : 
             locale === 'en' ? 'Waiter has been called!' : 
             'Kellner wurde gerufen!'}
          </h1>
          <p className="text-xl malts-muted">
            {locale === 'bg' ? 'Маса' : locale === 'en' ? 'Table' : 'Tisch'} {tableNumber}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen malts-surface">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              {locale === 'bg' ? 'Повикай сервитьор' : 
               locale === 'en' ? 'Call Waiter' : 
               'Kellner rufen'}
            </h1>
            <p className="text-2xl malts-muted">
              {locale === 'bg' ? 'Маса' : locale === 'en' ? 'Table' : 'Tisch'} {tableNumber}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Cash */}
            <button
              onClick={() => callWaiter('payment_cash')}
              disabled={calling || sessionStatus !== 'valid'}
              className="malts-card p-12 hover:bg-[var(--malts-card-hover)] transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calling ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-[var(--malts-accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Изпращане...' : locale === 'en' ? 'Sending...' : 'Se trimite...'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-6xl mb-4">💵</div>
                  <h2 className="text-2xl font-bold mb-2">
                    {locale === 'bg' ? 'Плащане с брой' : 
                     locale === 'en' ? 'Payment with Cash' : 
                     'Zahlung mit Bargeld'}
                  </h2>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Сервитьорът ще дойде с бележката' : 
                     locale === 'en' ? 'Waiter will come with the bill' : 
                     'Kellner kommt mit der Rechnung'}
                  </p>
                </>
              )}
            </button>

            {/* Payment Card */}
            <button
              onClick={() => callWaiter('payment_card')}
              disabled={calling || sessionStatus !== 'valid'}
              className="malts-card p-12 hover:bg-[var(--malts-card-hover)] transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calling ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-[var(--malts-accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Изпращане...' : locale === 'en' ? 'Sending...' : 'Se trimite...'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-6xl mb-4">💳</div>
                  <h2 className="text-2xl font-bold mb-2">
                    {locale === 'bg' ? 'Плащане с карта' : 
                     locale === 'en' ? 'Payment with Card' : 
                     'Zahlung mit Karte'}
                  </h2>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Сервитьорът ще донесе POS терминал' : 
                     locale === 'en' ? 'Waiter will bring POS terminal' : 
                     'Kellner bringt POS-Terminal'}
                  </p>
                </>
              )}
            </button>

            {/* General Help */}
            <button
              onClick={() => callWaiter('help')}
              disabled={calling || sessionStatus !== 'valid'}
              className="malts-card rounded-2xl p-12 hover:bg-[var(--malts-card-hover)] transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed md:col-span-2"
            >
              {calling ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-[var(--malts-accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Изпращане...' : locale === 'en' ? 'Sending...' : 'Se trimite...'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-6xl mb-4">🙋</div>
                  <h2 className="text-2xl font-bold mb-2">
                    {locale === 'bg' ? 'Нужна ми е помощ' : 
                     locale === 'en' ? 'I Need Help' : 
                     'Ich brauche Hilfe'}
                  </h2>
                  <p className="malts-muted">
                    {locale === 'bg' ? 'Сервитьорът ще дойде веднага' : 
                     locale === 'en' ? 'Waiter will come immediately' : 
                     'Kellner kommt sofort'}
                  </p>
                </>
              )}
            </button>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => router.back()}
              className="px-8 py-3 malts-btn-secondary rounded-lg font-semibold transition-all"
            >
              ← {locale === 'bg' ? 'Назад към менюто' : 
                   locale === 'en' ? 'Back to Menu' : 
                   'Zurück zum Menü'}
            </button>
          </div>
        </div>
      </div>

      {sessionStatus !== 'valid' && (
        <div className="fixed inset-0 z-40 bg-[var(--malts-paper)]/85 backdrop-blur-md px-6 flex items-center justify-center text-center">
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
                  🔄 {locale === 'bg' ? 'Провери отново' : locale === 'en' ? 'Check again' : 'Erneut prüfen'}
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
    </div>
  );
}

function LoadingScreen() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  
  return (
    <div className="min-h-screen malts-surface flex items-center justify-center">
      <div className="text-center">
        <div className="logo-container h-64 w-64 md:h-96 md:w-96 mx-auto mb-10 animate-pulse-glow">
          <img
            src="/malts-logo-landscape.svg"
            alt="Malt's"
            className="h-64 w-64 md:h-96 md:w-96"
          />
        </div>
        <p className="text-3xl font-medium">
          {locale === 'bg' ? 'Зареждане...' : locale === 'en' ? 'Loading...' : 'Se încarcă...'}
        </p>
      </div>
    </div>
  );
}

export default function CallWaiterPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CallWaiterContent />
    </Suspense>
  );
}
