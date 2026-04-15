// Validate environment variables early (server-side only)
import './middleware-env-validation';

import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const intlMiddleware = createMiddleware({
  locales: locales,
  defaultLocale: defaultLocale,
  localePrefix: 'always',
  localeDetection: false // Винаги използвай defaultLocale (bg) вместо browser detection
});

// Helper to get correct base URL from request headers (for reverse proxy)
function getBaseUrl(request: NextRequest): string {
  const protocol = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  const host = request.headers.get('host') || request.nextUrl.host;
  return `${protocol}://${host}`;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const baseUrl = getBaseUrl(request);
  
  // Handle root path - redirect to default locale
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, baseUrl));
  }
  
  // Handle routes without locale prefix (e.g., /staff, /admin)
  // Redirect them to default locale
  if (pathname.startsWith('/staff') || pathname.startsWith('/admin')) {
    // Check if pathname already has a locale prefix (e.g., /bg/staff)
    const firstSegment = pathname.split('/')[1];
    const hasLocalePrefix = locales.includes(firstSegment as any);
    
    if (!hasLocalePrefix) {
      // No locale prefix, redirect to default locale
      const newPath = `/${defaultLocale}${pathname}`;
      return NextResponse.redirect(new URL(newPath, baseUrl));
    }
  }
  
  // Apply i18n middleware
  const response = intlMiddleware(request);
  
  // Check authentication for admin and staff routes (except login pages)
  
  // If we're on a malformed login URL (e.g., /bg/staff/staff/login), redirect to correct one
  if (pathname.includes('/staff/staff/login') || pathname.includes('/admin/admin/login')) {
    const locale = pathname.split('/')[1] || 'bg';
    if (pathname.includes('/staff')) {
      return NextResponse.redirect(new URL(`/${locale}/staff/login`, baseUrl));
    }
    if (pathname.includes('/admin')) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, baseUrl));
    }
  }
  
  // More precise checks to avoid redirect loops and duplicate paths
  const isAdminLoginPage = /\/[a-z]{2}\/admin\/login$/.test(pathname) || pathname.endsWith('/admin/login');
  const isStaffLoginPage = /\/[a-z]{2}\/staff\/login$/.test(pathname) || pathname.endsWith('/staff/login');
  const isAdminRoute = pathname.includes('/admin') && !isAdminLoginPage;
  const isStaffRoute = pathname.includes('/staff') && !isStaffLoginPage;
  const isLoginPage = isAdminLoginPage || isStaffLoginPage;
  
  // Only check auth for admin/staff routes that are NOT login pages
  if ((isAdminRoute || isStaffRoute) && !isLoginPage) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('NEXTAUTH_SECRET is not set in environment variables');
      // Redirect to login instead of throwing to avoid breaking the app
      const locale = pathname.split('/')[1] || 'bg';
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, baseUrl));
    }
    
    // Robust token lookup:
    // In some deployments (reverse proxies / mixed headers), the request may appear http/https inconsistently.
    // NextAuth may set either secure or non-secure cookie names. Try both to avoid login redirect "bounce"
    // that resolves only after a manual refresh.
    const token =
      (await getToken({ req: request, secret, secureCookie: true })) ||
      (await getToken({ req: request, secret, secureCookie: false }));
    
    if (!token) {
      // No token, redirect to appropriate login
      const locale = pathname.split('/')[1] || 'bg';
      if (isAdminRoute) {
        const loginUrl = new URL(`/${locale}/admin/login`, baseUrl);
        return NextResponse.redirect(loginUrl);
      }
      if (isStaffRoute) {
        const loginUrl = new URL(`/${locale}/staff/login`, baseUrl);
        return NextResponse.redirect(loginUrl);
      }
    } else {
      const userRole = token.role;
      
      // Check role-based access
      if (isAdminRoute && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        // Redirect STAFF to staff panel
        if (userRole === 'STAFF') {
          const locale = pathname.split('/')[1] || 'bg';
          return NextResponse.redirect(new URL(`/${locale}/staff`, baseUrl));
        }
        // Redirect others to admin login
        const locale = pathname.split('/')[1] || 'bg';
        return NextResponse.redirect(new URL(`/${locale}/admin/login`, baseUrl));
      }
      
      if (isStaffRoute && userRole !== 'STAFF') {
        // Allow ADMIN/SUPER_ADMIN to access staff routes (for management purposes)
        // Only redirect non-authenticated users or users without proper roles
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
          const locale = pathname.split('/')[1] || 'bg';
          return NextResponse.redirect(new URL(`/${locale}/staff/login`, baseUrl));
        }
        // ADMIN/SUPER_ADMIN can access staff routes - don't redirect
      }
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - _next (Next.js internals)
    // - Static files (any file with extension: images, icons, manifests, etc)
    // - PWA files (manifest, service worker, icons)
    // - /t (QR redirect short links)
    '/((?!api|_next/static|_next/image|uploads|t|.*\\..*).*)',
  ]
};

