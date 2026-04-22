'use client';

import { useEffect } from 'react';
import { ensureServiceWorkerRegistered } from '@/lib/service-worker';

export default function ServiceWorkerUpdater() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register once (shared singleton) to avoid AbortError.
      // Run after load so we don't fight initial navigation.
      const onLoad = () => {
        ensureServiceWorkerRegistered({ scriptUrl: '/sw.js', scope: '/', updateViaCache: 'none' })
          .then((registration) => {
            console.log('✅ Service Worker registered');

            // Force immediate update check
            registration.update();

            // Listen for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              console.log('🔄 Service Worker update found');

              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('✅ New Service Worker installed! Ready to activate.');
                    // Send message to activate immediately
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  }
                });
              }
            });
          })
          .catch((error) => {
            // AbortError happens when a competing register/update aborts this attempt.
            // Keep it non-fatal and allow future retries.
            console.error('❌ Service Worker registration failed:', error);
          });
      };

      if (document.readyState === 'complete') onLoad();
      else window.addEventListener('load', onLoad, { once: true });
      
      // Listen for SW update messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('🔄 New version available:', event.data.version);
        }
      });
      
      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New Service Worker activated! Page will use new version on next navigation.');
        // Don't auto-reload to preserve form data and open modals
      });
      
      // Check for updates periodically (every 1 minute for PWA apps)
      // Skip if server is offline to avoid 503 errors
      const updateInterval = setInterval(() => {
        // Skip update check if offline
        if (typeof window !== 'undefined' && (window as any).__isOffline) {
          return;
        }
        
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            console.log('🔍 Checking for Service Worker updates...');
            registration.update();
          }
        });
      }, 60000); // Check every 1 minute (more aggressive for PWA)
      
      return () => {
        clearInterval(updateInterval);
        window.removeEventListener('load', onLoad);
      };
    }
  }, []);

  return null; // This component doesn't render anything
}

