import { ensureServiceWorkerRegistered } from '@/lib/service-worker';

// Web Push Notifications - Client Side

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

// Convert base64 to Uint8Array (required for VAPID key)
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export function isPushSupported() {
  const hasSupport = 'serviceWorker' in navigator && 'PushManager' in window;
  
  // Additional check for iOS - needs HTTPS in production
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168');
  
  const isHTTPS = window.location.protocol === 'https:';
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  // iOS needs HTTPS (except localhost sometimes)
  if (isIOS && !isHTTPS && !isLocalhost) {
    return false;
  }
  
  return hasSupport;
}

// Get push support details for error messages
export function getPushSupportDetails() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isHTTPS = window.location.protocol === 'https:';
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  
  return {
    isIOS,
    isHTTPS,
    hasServiceWorker,
    hasPushManager,
    isSupported: isPushSupported()
  };
}

// Check if already subscribed
export async function isSubscribed() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Check subscription error:', error);
    return false;
  }
}

/** Разрешение от ОС/браузър; на iOS при изключени известия от Настройки става `denied`. */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Реално ще получиш push: `granted` от ОС И активен push абонамент.
 * Само `isSubscribed()` подвежда — абонаментът може да остане, след като iOS спре известията.
 */
export async function isPushDeliveryEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  return isSubscribed();
}

// Request notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush() {
  try {
    console.log('🚀 Starting push subscription process...');
    
    // Check support
    if (!isPushSupported()) {
      throw new Error('Push notifications not supported');
    }
    console.log('✅ Push notifications are supported');

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error(`Notification permission denied (status: ${permission})`);
    }
    console.log('✅ Notification permission granted');

    // Ensure Service Worker is registered and ready (critical for Android)
    let registration;
    if ('serviceWorker' in navigator) {
      // Check if already registered
      const existingReg = await navigator.serviceWorker.getRegistration();
      if (existingReg) {
        registration = existingReg;
        console.log('✅ Using existing Service Worker registration');
      } else {
        // Register service worker (single shared registration)
        registration = await ensureServiceWorkerRegistered({ scriptUrl: '/sw.js', scope: '/', updateViaCache: 'none' });
        console.log('✅ Service Worker registered:', registration.scope);
      }
      
      // Wait for Service Worker to be ready (critical for Android)
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker is ready');
      
      // Double-check we have the registration
      if (!registration) {
        registration = await navigator.serviceWorker.ready;
      }
    } else {
      throw new Error('Service Worker not supported');
    }

    // Check if already subscribed (avoid duplicate subscriptions)
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('ℹ️ Already subscribed to push, returning existing subscription');
      return { success: true, subscription: existingSubscription };
    }

    // Subscribe to push
    console.log('📝 Subscribing to push manager...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    console.log('✅ Push subscription created');
    console.log('📍 Endpoint:', subscription.endpoint.substring(0, 50) + '...');

    // Get device info
    const deviceName = getDeviceName();
    const userAgent = navigator.userAgent;
    console.log('📱 Device:', deviceName);
    console.log('🌐 User Agent:', userAgent.substring(0, 100) + '...');

    // Send subscription to server
    console.log('📤 Sending subscription to server...');
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        deviceName,
        userAgent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server response error:', response.status, errorText);
      throw new Error(`Failed to save subscription: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅✅✅ Push subscription saved to server:', result.subscriptionId);

    return { success: true, subscription };

  } catch (error: any) {
    console.error('❌❌❌ Subscribe to push error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      
      // Notify server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    }

    return true;
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return false;
  }
}

/**
 * Ако известията са отказани в настройките (`denied`), махни абонамента и от сървъра.
 */
export async function unsubscribePushIfPermissionRevoked(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'denied') return;
  if (!(await isSubscribed())) return;
  await unsubscribeFromPush();
}

// Helper to get device name
function getDeviceName() {
  const ua = navigator.userAgent;
  
  if (/Android/i.test(ua)) {
    return 'Android Phone';
  } else if (/iPhone/i.test(ua)) {
    return 'iPhone';
  } else if (/iPad/i.test(ua)) {
    return 'iPad';
  } else if (/Windows/i.test(ua)) {
    return 'Windows PC';
  } else if (/Mac/i.test(ua)) {
    return 'Mac';
  } else {
    return 'Unknown Device';
  }
}

// Show test notification
export async function showTestNotification() {
  if (Notification.permission === 'granted') {
    new Notification('Malts Test', {
      body: 'Notifications are working! 🎉',
      icon: '/malts-icon.svg',
      badge: '/malts-icon.svg',
      vibrate: [200, 100, 200]
    } as NotificationOptions & { vibrate?: number[] });
  }
}

