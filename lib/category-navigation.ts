import { MALLS_MAX_CATEGORY_DEPTH } from '@/lib/category-depth';

type CatRef = { id: string; parentCategoryId: string | null };

/** Deepest selected category id, or '' if none. */
export function categoryPathLeafId(path: string[]): string {
  return path.length ? path[path.length - 1]! : '';
}

/** Replace selection from `depth` onward: path becomes [...path.slice(0, depth), id]. */
export function selectCategoryAtDepth(path: string[], depth: number, id: string): string[] {
  return [...path.slice(0, depth), id];
}

export { MALLS_MAX_CATEGORY_DEPTH };

/** Path from root to `categoryId`: [root, child, grandchild, ...] */
export function resolveCategoryPath(categories: CatRef[], categoryId: string): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: string[] = [];
  let cur: string | undefined = categoryId;
  while (cur) {
    path.unshift(cur);
    const parentId: string | null | undefined = byId.get(cur)?.parentCategoryId;
    cur = parentId ?? undefined;
  }
  return path;
}

export function getChildrenOf<T extends CatRef>(categories: T[], parentId: string): T[] {
  return categories.filter((c) => c.parentCategoryId === parentId);
}

/** `rootId` и всички подкатегории (рекурсивно). За филтриране на продукти по родителска категория. */
export function getDescendantCategoryIds(categories: CatRef[], rootId: string): Set<string> {
  const byParent = new Map<string | null, string[]>();
  for (const c of categories) {
    const p = c.parentCategoryId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(c.id);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.add(id);
    const kids = byParent.get(id);
    if (kids) for (const k of kids) stack.push(k);
  }
  return out;
}

export function getCategoryName(
  c: { nameBg: string; nameEn: string; nameRo: string },
  locale: string
): string {
  if (locale === 'en') return c.nameEn;
  if (locale === 'ro') return c.nameRo;
  return c.nameBg;
}

type CatWithSlug = { id: string; slug: string };

/** Resolve `?category=`: accepts legacy id or stable slug (readable in the address bar). */
export function resolveCategoryQueryToId(categories: CatWithSlug[], param: string | null): string | null {
  if (!param?.trim()) return null;
  const p = param.trim();
  if (categories.some((c) => c.id === p)) return p;
  const bySlug = categories.find((c) => c.slug === p);
  return bySlug?.id ?? null;
}

/** Prefer slug for `?category=` so URLs are human-readable. */
export function categoryParamForUrl(c: CatWithSlug | undefined): string {
  if (!c) return '';
  const s = c.slug?.trim();
  return s || c.id;
}
