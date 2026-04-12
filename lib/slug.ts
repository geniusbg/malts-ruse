import { prisma } from './prisma';

const BULGARIAN_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht',
  ъ: 'a', ь: '', ю: 'yu', я: 'ya'
};

export function slugify(input: string): string {
  if (!input) {
    return '';
  }

  return input
    .toString()
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => BULGARIAN_MAP[char as keyof typeof BULGARIAN_MAP] ?? char)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function ensureUniqueCategorySlug(
  slugInput: string,
  brandId: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(slugInput) || `category-${Date.now()}`;
  let slug = base;
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.category.findFirst({
      where: {
        brandId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return slug;
    }

    slug = `${base}-${counter++}`;
  }
}

/** Уникален slug за продукт (глобално уникален в таблицата products). */
export async function ensureUniqueProductSlug(
  slugInput: string,
  excludeProductId?: string
): Promise<string> {
  const base = slugify(slugInput) || `product-${Date.now()}`;
  let slug = base;
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        slug,
        ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${base}-${counter++}`;
  }
}

