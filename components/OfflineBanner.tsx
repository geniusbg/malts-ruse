'use client';

import { useEffect, useState } from 'react';
import { useLockScroll } from '@/lib/use-lock-scroll';

interface OfflineBannerProps {
  onStatusChange?: (isBlocked: boolean) => void;
  onBackOnline?: () => void;
}

export default function OfflineBanner({ onStatusChange, onBackOnline }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isServerDown, setIsServerDown] = useState(false);

  // Detect iOS
  const isIOS = typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const [errorType, setErrorType] = useState<'server' | 'database' | 'network'>('server');

  useEffect(() => {
    // Listen for SW messages (server offline detection)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SERVER_OFFLINE' || event.data?.type === 'DATABASE_ERROR') {
        setIsOffline(true);
        
        // Determine error type
        const type = event.data?.errorType || (event.data?.type === 'DATABASE_ERROR' ? 'database' : 'server');
        setErrorType(type);
        
        // Check if it's network offline or server down
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Network is offline, not server issue
          setIsServerDown(false);
          setErrorType('network');
        } else {
          // Network is online but server/database is down
          setIsServerDown(true);
        }
        setIsChecking(false);
        onStatusChange?.(true);
      }
    };

    // Listen for online/offline events
    const handleOnline = async () => {
      // When network comes back, check if server is actually up
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          // Server is actually up
          setIsChecking(true);
          onStatusChange?.(false);
          
          // Close modal after 1 second, data will be refreshed on next fetch
          setTimeout(() => {
            setIsOffline(false);
            setIsServerDown(false);
            setIsChecking(false);
          }, 1000);
        } else {
          // Network is up but server is down - stay offline
          setIsOffline(true);
          setIsServerDown(true);
          setIsChecking(false);
        }
      } catch (error) {
        // Server still down even though network is up
        setIsOffline(true);
        setIsServerDown(true);
        setIsChecking(false);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsServerDown(false); // Network is down, not server
      setIsChecking(false);
      onStatusChange?.(true);
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic health check when offline
  useEffect(() => {
    if (!isOffline) {
      // Clear any existing interval if going online
      return;
    }

    // iOS needs more frequent checks as browser events are unreliable
    const checkInterval = isIOS ? 5000 : 10000; // 5 seconds for iOS, 10 for others
    console.log(`🔄 Starting periodic health check (every ${checkInterval/1000} seconds)`);

    const checkHealth = async () => {
      try {
        console.log('🔍 Health check: Checking server status...');
        // Use cache: 'no-cache' to avoid stale responses
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });

        console.log('🔍 Health check response:', response.status, response.ok);

        // If we get a 200 OK, server is back online
        if (response.status === 200 && response.ok) {
          console.log('✅ Server is back online!');
          setIsChecking(true);
          setIsServerDown(false);
          setErrorType('server');
          onStatusChange?.(false);
          
          // Close modal after 1 second, data will be refreshed on next fetch
          setTimeout(() => {
            setIsOffline(false);
            setIsChecking(false);
          }, 1000);
          return;
        }
        
        // If we get 503 or other error status, check error type
        const errorTypeHeader = response.headers.get('X-Error-Type');
        const errorTypeFromHeader = errorTypeHeader === 'database' ? 'database' : 'server';
        
        // Try to parse response body for error type
        try {
          const data = await response.clone().json();
          if (data?.errorType === 'database') {
            setErrorType('database');
          } else {
            setErrorType(errorTypeFromHeader);
          }
        } catch {
          setErrorType(errorTypeFromHeader);
        }
        
        console.log('❌ Server still offline (status:', response.status, ', type:', errorTypeFromHeader, ')');
        setIsServerDown(true);
      } catch (error) {
        // Network error or timeout - server is still offline
        // This is expected when server is down, so we just continue checking
        console.log('❌ Server still offline (network error)');
        setErrorType('network');
        setIsServerDown(true);
      }
    };

    // Check immediately, then at interval
    checkHealth();
    const interval = setInterval(checkHealth, checkInterval);

    return () => {
      console.log('🛑 Stopping periodic health check');
      clearInterval(interval);
    };
  }, [isOffline, onStatusChange, isIOS]);

  // Check initial online state on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      // Browser is offline on load
      setIsOffline(true);
      setIsServerDown(false); // Network offline, not server
      onStatusChange?.(true);
    }
  }, [onStatusChange]);

  // Expose offline state globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setOfflineState = (offline: boolean) => {
        if (offline !== isOffline) {
          setIsOffline(offline);
          onStatusChange?.(offline);
        }
      };

      // Expose server down state
      (window as any).__setServerDown = (down: boolean) => {
        setIsServerDown(down);
      };
    }
  }, [onStatusChange, isOffline]);

  useLockScroll(isOffline);

  if (!isOffline) return null;

  // Show modal that blocks interaction
  return (
    <>
      <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="malts-card max-w-md w-full p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            {isChecking ? (
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600/10 border border-green-600/20 rounded-full">
                <svg className="animate-spin h-10 w-10 text-green-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] rounded-full">
                <svg className="h-10 w-10 text-[var(--malts-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-4">
            {isChecking 
              ? 'Връзката е възстановена!' 
              : isServerDown 
                ? (errorType === 'database' 
                    ? 'Проблем с базата данни'
                    : 'Временен проблем със сървъра')
                : 'Няма интернет връзка'}
          </h2>

          {/* Message */}
          <p className="malts-muted mb-6">
            {isChecking 
              ? 'Вече имате интернет връзка. Приложението е готово за използване.'
              : isServerDown
                ? (errorType === 'database'
                    ? `Базата данни е временно недостъпна. Приложението проверява автоматично на всеки ${isIOS ? '5' : '10'} секунди дали базата данни е отново достъпна.`
                    : `Сървърът е временно недостъпен. Приложението проверява автоматично на всеки ${isIOS ? '5' : '10'} секунди дали сървърът е отново онлайн.`)
                : 'Моля, проверете интернет връзката си и опитайте отново.'
            }
          </p>

        </div>
      </div>
    </>
  );
}

