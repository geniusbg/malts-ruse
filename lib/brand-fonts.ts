/** Google Fonts + custom font-family stacks for branding. */

const GOOGLE_FONTS_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

export const GOOGLE_FONT_EFFECTS = [
  'none',
  'anaglyph',
  'brick-sign',
  'canvas-print',
  'crackle',
  'decaying',
  'destruction',
  'distressed',
  'distressed-wood',
  'emboss',
  'fire',
  'fire-animation',
  'fragile',
  'grass',
  'ice',
  'mitosis',
  'neon',
  'outline',
  'putting-green',
  'scuffed-steel',
  'shadow-multiple',
  'splintered',
  'static',
  'stonewash',
  '3d',
  '3d-float',
  'vintage',
  'wallpaper',
] as const;

const GOOGLE_FONT_EFFECT_SET = new Set<string>(GOOGLE_FONT_EFFECTS);

export function normalizeGoogleFontEffect(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s || s === 'none') return null;
  return GOOGLE_FONT_EFFECT_SET.has(s) ? s : null;
}

export function googleFontEffectClass(raw: string | null | undefined): string {
  const effect = normalizeGoogleFontEffect(raw);
  return effect ? `font-effect-${effect}` : '';
}

function addGoogleFontEffects(cssUrl: string | null, effects: Array<string | null | undefined>): string | null {
  if (!cssUrl) return null;
  const requested = effects.map(normalizeGoogleFontEffect).filter(Boolean) as string[];
  if (requested.length === 0) return cssUrl;

  try {
    const u = new URL(cssUrl);
    const existing = (u.searchParams.get('effect') || '')
      .split('|')
      .map(normalizeGoogleFontEffect)
      .filter(Boolean) as string[];
    const merged = [...new Set([...existing, ...requested])];
    if (merged.length > 0) u.searchParams.set('effect', merged.join('|'));
    return u.toString();
  } catch {
    return cssUrl;
  }
}

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
  displayEffectClass: string;
  moodEffectClass: string;
};

export function fontVarsFromAppearance(row: {
  googleFontsCssUrl?: string | null;
  fontDisplayFamily?: string | null;
  fontButtonsFamily?: string | null;
  fontNavFamily?: string | null;
  fontBodyFamily?: string | null;
  fontDisplayEffect?: string | null;
  fontMoodEffect?: string | null;
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
  googleFontsCssUrl = addGoogleFontEffects(googleFontsCssUrl, [row?.fontDisplayEffect, row?.fontMoodEffect]);

  return {
    googleFontsCssUrl,
    display,
    buttons,
    nav,
    body,
    displayEffectClass: googleFontEffectClass(row?.fontDisplayEffect),
    moodEffectClass: googleFontEffectClass(row?.fontMoodEffect),
  };
}

export function fontVarsToCssRecord(vars: BrandFontVars): Record<string, string> {
  const out: Record<string, string> = {};
  if (vars.display) out['--brand-font-display'] = vars.display;
  if (vars.buttons) out['--brand-font-buttons'] = vars.buttons;
  if (vars.nav) out['--brand-font-nav'] = vars.nav;
  if (vars.body) out['--brand-font-body'] = vars.body;
  return out;
}
