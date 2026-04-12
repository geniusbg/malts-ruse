/** За `?product=` и линкове: предпочитаме slug, иначе id. */
export function productParamForUrl(p: { id: string; slug?: string | null }): string {
  const s = p.slug?.trim();
  return s || p.id;
}

type ProductRef = { id: string; slug?: string | null };

/** Резолвира `?product=` от клиентски списък (id или slug). */
export function resolveProductQueryToId(products: ProductRef[], param: string | null): string | null {
  if (!param?.trim()) return null;
  const p = param.trim();
  if (products.some((x) => x.id === p)) return p;
  const bySlug = products.find((x) => (x.slug || '').trim() === p);
  return bySlug?.id ?? null;
}
