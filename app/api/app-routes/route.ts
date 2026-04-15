import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

type AppRouteInfo = {
  /** Canonical, locale-aware path. Example: "/:locale/order" */
  path: string;
  /** Filesystem path under app/. */
  file: string;
};

const IGNORED_DIRS = new Set(['node_modules', '.next', '.git', 'public']);

function normalizeToRoute(appRoot: string, filePath: string): string | null {
  const rel = path.relative(appRoot, filePath);
  const parts = rel.split(path.sep);
  if (parts[parts.length - 1] !== 'page.tsx') return null;

  // Remove trailing "page.tsx"
  parts.pop();

  const routeParts = parts
    .filter((p) => p !== '')
    .map((p) => {
      if (p === '[locale]') return ':locale';
      if (p.startsWith('(') && p.endsWith(')')) return null; // route groups
      if (p.startsWith('@')) return null; // parallel routes
      if (p === '__tests__') return null;
      if (p.startsWith('[') && p.endsWith(']')) {
        const name = p.slice(1, -1);
        if (name.startsWith('...')) return `:${name.slice(3)}*`;
        return `:${name}`;
      }
      return p;
    })
    .filter(Boolean) as string[];

  return '/' + routeParts.join('/');
}

async function walk(dir: string, out: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue;
      // Skip common special segments
      if (e.name.startsWith('.')) continue;
      await walk(full, out);
      continue;
    }
    if (e.isFile() && e.name === 'page.tsx') out.push(full);
  }
}

/**
 * Public endpoint: returns available App Router page paths from `app/.../page.tsx`.
 * This is used for admin dropdowns so route lists stay current.
 */
export async function GET() {
  try {
    const appRoot = path.join(process.cwd(), 'app');
    const files: string[] = [];
    await walk(appRoot, files);

    const routes: AppRouteInfo[] = files
      .map((f) => {
        const r = normalizeToRoute(appRoot, f);
        if (!r) return null;
        return { path: r, file: `app/${path.relative(appRoot, f).replaceAll(path.sep, '/')}` };
      })
      .filter(Boolean) as AppRouteInfo[];

    // Dedupe & sort
    const byPath = new Map<string, AppRouteInfo>();
    for (const r of routes) {
      if (!byPath.has(r.path)) byPath.set(r.path, r);
    }

    const unique = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
    return NextResponse.json({ routes: unique }, { status: 200 });
  } catch (error) {
    console.error('GET app-routes error:', error);
    return NextResponse.json({ error: 'Failed to list app routes' }, { status: 500 });
  }
}

