import { prisma } from './prisma';

/** Tenant slug — set DEFAULT_BRAND_SLUG in .env per deployment (e.g. restorant-complexdunav). */
export function getConfiguredBrandSlug(): string {
  return (process.env.DEFAULT_BRAND_SLUG || '').trim();
}

/** @deprecated use getConfiguredBrandSlug(); kept for scripts referencing malts seed slug */
export const DEFAULT_BRAND_SLUG = 'malts';

export async function getDefaultBrandId(): Promise<string> {
  const brand = await getDefaultBrand();
  return brand.id;
}

export async function getDefaultBrand() {
  const slug = getConfiguredBrandSlug() || DEFAULT_BRAND_SLUG;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) {
    throw new Error(
      `Brand "${slug}" not found. Run: npx prisma db seed (after setting ADMIN_EMAIL / ADMIN_PASSWORD).`
    );
  }
  return brand;
}
