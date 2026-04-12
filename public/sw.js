// Malts — Service Worker (PWA & push)

// ⚠️ SW VERSION - Single source of truth (no duplicates)
const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `malts-web-${CACHE_VERSION}`;
const urlsToCache = [
  '/bg/staff',
  '/bg/admin',
  '/bg/menu',
  '/bg'
];

// Listen for messages from clients (e.g., version requests, skip waiting)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    // Send version back to client
    event.ports[0]?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
    // Also broadcast to all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
      });
    });
  }
  
  // Handle skip waiting request (force immediate activation)
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('⚡ SKIP_WAITING received, activating new SW immediately');
    self.skipWaiting();
  }
});

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Try to cache all URLs, but don't fail if some are unavailable
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn('⚠️ Failed to cache:', url, err);
              // Continue even if some URLs fail to cache
            })
          )
        );
      })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch strategy - Network first, fallback to cache
// Only cache same-origin requests, let external images pass through
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;
  
  // Debug: Log all fetch requests
  console.log('🔍 SW Fetch:', request.method, url.pathname);
  
  // Skip caching for external domains
  if (url.origin !== self.location.origin) {
    console.log('⏭️ SW: Skipping external domain:', url.origin);
    event.respondWith(fetch(request));
    return;
  }
  
  // For POST/PUT/DELETE requests: Always go to network and detect offline
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        // Notify clients that server is offline
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SERVER_OFFLINE',
              message: 'Сървърът е недостъпен'
            });
          });
        });
        // Return an error response instead of throwing
        return new Response(JSON.stringify({ error: 'Server offline' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  
  // Special handling for /api/auth/session - cache with short TTL (30 seconds)
  if (url.pathname === '/api/auth/session' && request.method === 'GET') {
    const SESSION_CACHE_TTL = 30 * 1000; // 30 seconds in milliseconds
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(cacheKey).then(cachedResponse => {
          // Check if cached response exists and is fresh (less than 30 seconds old)
          if (cachedResponse) {
            const cachedTime = cachedResponse.headers.get('sw-cached-time');
            if (cachedTime) {
              const age = Date.now() - parseInt(cachedTime);
              if (age < SESSION_CACHE_TTL) {
                console.log('✅ SW: Using cached session (age:', Math.round(age/1000), 's)');
                return cachedResponse;
              }
            }
          }
          
          // Cache is stale or doesn't exist - fetch fresh
          console.log('🔄 SW: Fetching fresh session');
          return fetch(request)
            .then(response => {
              // Only cache successful responses
              if (response.ok) {
                const clonedResponse = response.clone();
                // Add timestamp header to track cache age
                const headers = new Headers(clonedResponse.headers);
                headers.set('sw-cached-time', Date.now().toString());
                const modifiedResponse = new Response(clonedResponse.body, {
                  status: clonedResponse.status,
                  statusText: clonedResponse.statusText,
                  headers: headers
                });
                cache.put(cacheKey, modifiedResponse);
              }
              return response;
            })
            .catch(() => {
              // Network error - return cached response if available (even if stale)
              if (cachedResponse) {
                console.log('⚠️ SW: Network error, using stale cached session');
                return cachedResponse;
              }
              // No cache - return error
              return new Response(JSON.stringify({ 
                error: 'Server offline',
                message: 'The server is temporarily unavailable'
              }), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              });
            });
        });
      })
    );
    return;
  }
  
  // For same-origin GET requests: Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Check if response is a SERVER error (5xx) AND is for API route
        // 4xx errors (401, 403, 404) are client errors - server is working, just no access/permission
        // Only 5xx errors indicate server problems (503, 500, etc.)
        const isServerError = response.status >= 500 && response.status < 600;
        if (!response.ok && isServerError && url.pathname.startsWith('/api/')) {
          console.log('🔴 SW: API route returned server error status:', response.status, url.pathname);
          
          // Check for database error indicator in response headers
          const errorTypeHeader = response.headers.get('X-Error-Type') || 'server';
          const isDatabaseError = errorTypeHeader === 'database';
          const messageType = isDatabaseError ? 'DATABASE_ERROR' : 'SERVER_OFFLINE';
          
          // Notify ALL clients immediately (only for server errors, not client errors)
          // This sets window.__isOffline to prevent NextAuth redirect
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: messageType,
                message: isDatabaseError ? 'Проблем с базата данни' : 'Сървърът е недостъпен',
                errorType: isDatabaseError ? 'database' : 'server'
              });
            });
          });
          
          // Return JSON error instead of HTML error page
          return new Response(JSON.stringify({ 
            error: isDatabaseError ? 'Database unavailable' : 'Server offline',
            message: isDatabaseError ? 'The database is temporarily unavailable' : 'The server is temporarily unavailable',
            errorType: isDatabaseError ? 'database' : 'server'
          }), {
            status: response.status || 503,
            statusText: 'Service Unavailable',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Error-Type': isDatabaseError ? 'database' : 'server'
            }
          });
        }
        
        // For 4xx errors (401, 403, 404, etc.) - server is working, just return the error
        // Don't treat as offline - these are permission/not found errors
        if (!response.ok && response.status >= 400 && response.status < 500 && url.pathname.startsWith('/api/')) {
          console.log('ℹ️ SW: API route returned client error (not offline):', response.status, url.pathname);
          // Return the original response - don't convert to JSON or notify as offline
          return response;
        }
        
        // Only cache successful responses (but not /api/auth/session - handled above)
        if (response.ok && url.pathname !== '/api/auth/session') {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        // Network error (not HTTP error) - for API routes, return JSON
        if (url.pathname.startsWith('/api/')) {
          console.log('🔴 SW: API route network error:', url.pathname);
          
          // Notify ALL clients immediately (including for auth routes)
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SERVER_OFFLINE',
                message: 'Сървърът е недостъпен',
                errorType: 'network'
              });
            });
          });
          
          // Return JSON error for API routes (including NextAuth)
          return new Response(JSON.stringify({ 
            error: 'Server offline',
            message: 'The server is temporarily unavailable',
            errorType: 'network'
          }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Error-Type': 'network'
            }
          });
        }
        
        // For non-API routes, try cache
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If navigation request and no cache, try to serve React app from cache
          if (request.mode === 'navigate') {
            // Determine which base page to try based on URL
            let basePage = '/bg';
            if (url.pathname.includes('/admin')) {
              basePage = '/bg/admin';
            } else if (url.pathname.includes('/staff')) {
              basePage = '/bg/staff';
            }
            
            // Try to serve base React app page (has OfflineBanner)
            return caches.match(basePage).then(basePageResponse => {
              if (basePageResponse) {
                console.log('✅ SW: Serving cached base page', basePage, 'for', url.pathname);
                // Notify that server is offline (React app will show OfflineBanner)
                self.clients.matchAll().then(clients => {
                  clients.forEach(client => {
                    client.postMessage({
                      type: 'SERVER_OFFLINE',
                      message: 'Сървърът е недостъпен'
                    });
                  });
                });
                return basePageResponse;
              }
              
              // No React app in cache - show static offline modal
              console.log('🔴 SW: No React app cached, showing static offline modal');
              self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({
                    type: 'SERVER_OFFLINE',
                    message: 'Сървърът е недостъпен'
                  });
                });
              });
              
              // Return minimal HTML with modal that preserves the current URL (no redirect)
              const offlineModalHTML = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Временен проблем със сървъра</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0f172a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .modal {
      background: #1e293b;
      border-radius: 16px;
      padding: 32px;
      border: 1px solid #334155;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #f59e0b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      color: #cbd5e1;
      line-height: 1.6;
      margin-bottom: 0;
    }
    .checking {
      background: #10b981 !important;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="modal">
    <div class="icon" id="icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    </div>
    <h1 id="title">Временен проблем със сървъра</h1>
    <p id="message">Сървърът е временно недостъпен. Приложението проверява автоматично на всеки 10 секунди дали сървърът е отново онлайн.</p>
  </div>
  <script>
    // Prevent redirect to login when offline
    if (typeof window !== 'undefined') {
      window.__isOffline = true;
    }
    
    let checkInterval;
    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000)
        });
        if (response.status === 200 && response.ok) {
          document.getElementById('icon').className = 'icon checking';
          document.getElementById('title').textContent = 'Връзката е възстановена!';
          document.getElementById('message').textContent = 'Вече имате интернет връзка. Приложението е готово за използване.';
          // Mark as online before reload
          if (typeof window !== 'undefined') {
            window.__isOffline = false;
          }
          clearInterval(checkInterval);
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        // Server still offline
      }
    }
    checkHealth();
    checkInterval = setInterval(checkHealth, 10000);
  </script>
</body>
</html>`;
            
              return new Response(offlineModalHTML, {
                status: 503,
                headers: { 'Content-Type': 'text/html' }
              });
            }); // Close caches.match(basePage).then()
          }
          
          // For non-navigation non-API requests, return error (don't serve offline.html)
          // This prevents HTML from being returned for API-like requests
          return new Response('Resource not available offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// 🔔 PUSH NOTIFICATION HANDLER
self.addEventListener('push', (event) => {
  console.log('🔔🔔🔔 PUSH EVENT RECEIVED 🔔🔔🔔', event);
  console.log('Has data:', !!event.data);
  
  let data = {
    title: 'Malts',
    body: 'Ново известие',
    icon: '/malts-icon.svg',
    badge: '/malts-icon.svg',
    tag: 'malts-notification-' + Date.now(),
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    silent: false,
    renotify: true
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('📦📦📦 PAYLOAD PARSED:', JSON.stringify(payload, null, 2));
      data = { ...data, ...payload };
    } catch (e) {
      console.error('❌ Push parse error:', e);
      try {
        const text = event.data.text();
        console.log('📝 Raw text:', text);
        data.body = text;
      } catch (e2) {
        console.error('❌ Could not read as text either:', e2);
      }
    }
  } else {
    console.warn('⚠️ No data in push event!');
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/malts-icon.svg',
    badge: data.badge || '/malts-icon.svg',
    tag: data.tag,
    vibrate: data.vibrate,
    requireInteraction: data.requireInteraction,
    silent: data.silent,
    renotify: data.renotify,
    timestamp: Date.now(),
    data: {
      url: data.url || '/bg/staff',
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    (async () => {
      const perm =
        typeof Notification !== 'undefined' ? Notification.permission : 'denied';
      if (perm !== 'granted') {
        console.warn(
          '[SW] Push received but notification permission is not granted (' +
            perm +
            '). Open the site and allow notifications, or dismiss this.'
        );
        return;
      }
      try {
        await self.registration.showNotification(data.title, notificationOptions);
        console.log('✅ Notification shown:', data.title);
      } catch (err) {
        const msg = err && err.message ? String(err.message) : '';
        if (msg.includes('permission') || msg.includes('Permission')) {
          console.warn('[SW] showNotification blocked (permission):', msg);
        } else {
          console.error('[SW] showNotification failed:', err);
        }
      }
    })()
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/bg/staff';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if staff dashboard is already open
        for (let client of windowClients) {
          if (client.url.includes('/staff') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync (for offline orders)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Future: sync offline orders when back online
  console.log('Syncing offline orders...');
}

