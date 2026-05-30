/** Google Fonts + custom font-family stacks for branding. */

const GOOGLE_FONTS_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/** Allow only Google Fonts stylesheet URLs (no arbitrary CSS injection). */
export function sanitizeGoogleFontsCssUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    if (!GOOGLE_FONTS_HOSTS.has(u.hostname)) return null;
    if (!u.pathname.includes('/css')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** e.g. "Ruslan Display" → "'Ruslan Display', sans-serif" */
export function normalizeFontFamilyStack(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.includes(',')) return s;
  const safe = s.replace(/['"]/g, '').trim();
  if (!safe) return null;
  return `'${safe}', system-ui, -apple-system, sans-serif`;
}

export function buildGoogleFontsCssUrl(families: string[]): string | null {
  const unique = [...new Set(families.map((f) => f.replace(/['"]/g, '').trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  const query = unique.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

export type BrandFontVars = {
  googleFontsCssUrl: string | null;
  display: string | null;
  buttons: string | null;
  nav: string | null;
  body: string | null;
};

export function fontVarsFromAppearance(row: {
  googleFontsCssUrl?: string | null;
  fontDisplayFamily?: string | null;
  fontButtonsFamily?: string | null;
  fontNavFamily?: string | null;
  fontBodyFamily?: string | null;
} | null | undefined): BrandFontVars {
  const display = normalizeFontFamilyStack(row?.fontDisplayFamily);
  const buttons = normalizeFontFamilyStack(row?.fontButtonsFamily);
  const nav = normalizeFontFamilyStack(row?.fontNavFamily);
  const body = normalizeFontFamilyStack(row?.fontBodyFamily);

  let googleFontsCssUrl = sanitizeGoogleFontsCssUrl(row?.googleFontsCssUrl);
  if (!googleFontsCssUrl) {
    const names = [
      row?.fontDisplayFamily,
      row?.fontButtonsFamily,
      row?.fontNavFamily,
      row?.fontBodyFamily,
    ]
      .map((f) => (f ?? '').trim())
      .filter((f) => f && !f.includes(','));
    googleFontsCssUrl = buildGoogleFontsCssUrl(names);
  }

  return { googleFontsCssUrl, display, buttons, nav, body };
}

export function fontVarsToCssRecord(vars: BrandFontVars): Record<string, string> {
  const out: Record<string, string> = {};
  if (vars.display) out['--brand-font-display'] = vars.display;
  if (vars.buttons) out['--brand-font-buttons'] = vars.buttons;
  if (vars.nav) out['--brand-font-nav'] = vars.nav;
  if (vars.body) out['--brand-font-body'] = vars.body;
  return out;
}
