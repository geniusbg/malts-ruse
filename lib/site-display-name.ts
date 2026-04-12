/**
 * Public display name for the venue/app (titles, admin heading).
 * Set NEXT_PUBLIC_SITE_NAME in .env (e.g. "Malts").
 */
export function getSiteDisplayName(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_NAME : undefined;
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;
  return 'Malts';
}

/** Admin dashboard / login hero line, localized. */
export function getAdminPanelHeading(locale: string, siteName: string): string {
  switch (locale) {
    case 'en':
      return `Admin – ${siteName} management`;
    case 'ro':
      return `Admin – Gestionarea ${siteName}`;
    default:
      return `Admin - Управление на ${siteName}`;
  }
}
