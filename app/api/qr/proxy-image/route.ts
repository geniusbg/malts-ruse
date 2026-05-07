import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const MAX_BYTES = 6 * 1024 * 1024;

function requireAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function isUrlAllowed(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]') return false;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(h)) return false;
  const m = /^172\.(\d+)\./.exec(h);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return false;
  }
  return true;
}

/** Прокси за изображения при PDF (html2canvas / CORS). Само админи. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('url');
    if (!raw || raw.length > 4096) {
      return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (!isUrlAllowed(target)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    try {
      const res = await fetch(target.href, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Malls-QR-PDF-proxy/1.0' },
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Upstream failed' }, { status: 502 });
      }
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/')) {
        return NextResponse.json({ error: 'Not an image' }, { status: 400 });
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Too large' }, { status: 400 });
      }
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Cache-Control': 'private, max-age=120',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
