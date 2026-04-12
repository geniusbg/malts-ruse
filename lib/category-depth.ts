/**
 * Max category levels from root (root = 1). Used by POST/PUT /api/categories.
 * 3 was too tight: moving a branch (e.g. parent + subcategories) under a non-root
 * parent pushes the deepest leaf past the limit. 5 fits typical menus + reparenting.
 */
export const MALLS_MAX_CATEGORY_DEPTH = 5;

export type CategoryNode = { id: string; parentCategoryId: string | null };

/** Depth from root: root = 1. */
export function getDepthOfCategory(categories: CategoryNode[], categoryId: string): number {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let depth = 0;
  let cur: string | null = categoryId;
  while (cur) {
    depth += 1;
    const c = byId.get(cur);
    if (!c) break;
    cur = c.parentCategoryId;
  }
  return depth;
}

/** Max depth across all root trees (deepest node level). */
export function maxForestDepth(categories: CategoryNode[]): number {
  const byParent = new Map<string | null, CategoryNode[]>();
  for (const c of categories) {
    const k = c.parentCategoryId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  let maxD = 0;
  function dfs(nodeId: string, depth: number) {
    maxD = Math.max(maxD, depth);
    for (const ch of byParent.get(nodeId) || []) {
      dfs(ch.id, depth + 1);
    }
  }
  for (const r of byParent.get(null) || []) {
    dfs(r.id, 1);
  }
  return maxD;
}

/** True if `nodeId` is `ancestorId` or nested under it. */
export function isDescendantOf(
  categories: CategoryNode[],
  ancestorId: string,
  nodeId: string
): boolean {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let cur: string | null = nodeId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentCategoryId ?? null;
  }
  return false;
}

export function assertCategoryDepthWithinLimit(
  nextForest: CategoryNode[]
): { ok: true } | { ok: false; message: string } {
  const d = maxForestDepth(nextForest);
  if (d > MALLS_MAX_CATEGORY_DEPTH) {
    return {
      ok: false,
      message: `Категориите могат да имат най-много ${MALLS_MAX_CATEGORY_DEPTH} нива (текущо след промяната: ${d}).`,
    };
  }
  return { ok: true };
}
