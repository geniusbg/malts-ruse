/**
 * Помощни за PDF от QR карти: html2canvas не рисува cross-origin изображения
 * без CORS; инлайнваме като data URL (същ origin или чрез /api/qr/proxy-image).
 */

export async function waitForImages(root: HTMLElement, timeoutMs = 15000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(t);
            void img.decode?.().catch(() => undefined);
            resolve();
          };
          if (img.complete && img.naturalWidth > 0) {
            void img.decode?.().catch(() => undefined);
            resolve();
            return;
          }
          const t = setTimeout(done, timeoutMs);
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

function resolveAbsoluteUrl(src: string): string {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src;
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

async function fetchImageAsDataUrl(absoluteUrl: string): Promise<string | null> {
  if (absoluteUrl.startsWith('data:')) return absoluteUrl;

  let target: URL;
  try {
    target = new URL(absoluteUrl);
  } catch {
    return null;
  }

  const sameOrigin = target.origin === window.location.origin;

  try {
    const urlToFetch = sameOrigin
      ? target.href
      : `/api/qr/proxy-image?url=${encodeURIComponent(target.href)}`;
    const res = await fetch(urlToFetch, { credentials: 'include', mode: 'same-origin' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const blob = await res.blob();
    if (blob.size > 8 * 1024 * 1024) return null;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read'));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Заменя src с data URL където е възможно; връща map за възстановяване. */
export async function inlineImagesForPdfCapture(root: HTMLElement): Promise<Map<HTMLImageElement, string>> {
  const backups = new Map<HTMLImageElement, string>();
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));

  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;

    const absolute = resolveAbsoluteUrl(src);
    const dataUrl = await fetchImageAsDataUrl(absolute);
    if (dataUrl) {
      backups.set(img, img.getAttribute('src') || img.src);
      img.src = dataUrl;
    }
  }

  return backups;
}

export function restoreInlinedImageSources(backups: Map<HTMLImageElement, string>) {
  backups.forEach((original, img) => {
    img.src = original;
  });
}
