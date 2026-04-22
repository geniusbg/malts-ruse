// Centralized SW registration to avoid duplicate register() calls.

export type EnsureSwOptions = {
  scriptUrl?: string;
  scope?: string;
  updateViaCache?: RegistrationOptions['updateViaCache'];
};

declare global {
  interface Window {
    __maltsSwRegisterPromise?: Promise<ServiceWorkerRegistration> | null;
  }
}

export async function ensureServiceWorkerRegistered(
  opts: EnsureSwOptions = {}
): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined') {
    throw new Error('Service worker registration requires a browser environment');
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser');
  }

  const scriptUrl = opts.scriptUrl ?? '/sw.js';
  const scope = opts.scope ?? '/';
  const updateViaCache = opts.updateViaCache ?? 'none';

  // Reuse in-flight registration attempt.
  if (window.__maltsSwRegisterPromise) return window.__maltsSwRegisterPromise;

  window.__maltsSwRegisterPromise = (async () => {
    // If already registered for our scope, reuse it.
    const existing = await navigator.serviceWorker.getRegistration(scope);
    if (existing) return existing;

    // Register once. (Registering multiple times can cause AbortError on some browsers.)
    const reg = await navigator.serviceWorker.register(scriptUrl, { scope, updateViaCache });
    return reg;
  })();

  try {
    return await window.__maltsSwRegisterPromise;
  } catch (e) {
    // Allow future retries if it failed.
    window.__maltsSwRegisterPromise = null;
    throw e;
  }
}

