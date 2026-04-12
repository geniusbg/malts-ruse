import { prisma } from '@/lib/prisma';

/** Резолвира сегмента от URL: първо по id, после по slug. */
export async function findProductIdByRef(ref: string): Promise<string | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const byId = await prisma.product.findUnique({
    where: { id: trimmed },
    select: { id: true },
  });
  if (byId) return byId.id;

  const bySlug = await prisma.product.findFirst({
    where: { slug: trimmed },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}
