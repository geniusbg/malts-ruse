import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

export type LoadingAssetType = 'image' | 'video';

export type LoadingAsset = {
  id: string;
  name: string;
  url: string;
  type: LoadingAssetType;
  createdAt: string;
};

export type LoadingRule = {
  id: string;
  /** Canonical app path, e.g. "/:locale/order" or "/bg/order". */
  path: string;
  /** "exact" = only this path, "prefix" = this path + all subpaths. */
  matchMode?: 'exact' | 'prefix';
  enabled: boolean;
  assetId: string | null;
  minMs: number;
  extraMs: number;
};

export type LoadingUiSettings = {
  id: string;
  brandId: string;
  enabled: boolean;
  defaultAssetId: string | null;
  assets: LoadingAsset[];
  rules: LoadingRule[];
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_SETTINGS = {
  enabled: true,
  defaultAssetId: null as string | null,
  assets: [] as LoadingAsset[],
  rules: [] as LoadingRule[],
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function sanitizeSettings(row: any): LoadingUiSettings {
  const rules = asArray<LoadingRule>(row.rules)
    .filter(Boolean)
    .map((r) => {
      const matchMode: 'exact' | 'prefix' = r?.matchMode === 'prefix' ? 'prefix' : 'exact';
      return { ...r, matchMode };
    });

  return {
    id: row.id,
    brandId: row.brandId,
    enabled: Boolean(row.enabled),
    defaultAssetId: row.defaultAssetId ?? null,
    assets: asArray<LoadingAsset>(row.assets).filter(Boolean),
    rules,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getLoadingUiSettings(): Promise<LoadingUiSettings | null> {
  try {
    const brandId = await getDefaultBrandId();
    const row = await prisma.loadingUiSettings.findUnique({ where: { brandId } });
    if (!row) return null;
    return sanitizeSettings(row);
  } catch (error) {
    console.error('Error fetching loading ui settings:', error);
    return null;
  }
}

export async function getOrCreateLoadingUiSettings(): Promise<LoadingUiSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.loadingUiSettings.findUnique({ where: { brandId } });
  if (existing) return sanitizeSettings(existing);

  const created = await prisma.loadingUiSettings.create({
    data: {
      brandId,
      enabled: DEFAULT_SETTINGS.enabled,
      defaultAssetId: DEFAULT_SETTINGS.defaultAssetId,
      assets: DEFAULT_SETTINGS.assets,
      rules: DEFAULT_SETTINGS.rules,
    },
  });
  return sanitizeSettings(created);
}

export async function updateLoadingUiSettings(data: {
  enabled?: boolean;
  defaultAssetId?: string | null;
  assets?: LoadingAsset[];
  rules?: LoadingRule[];
}): Promise<LoadingUiSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.loadingUiSettings.findUnique({ where: { brandId } });

  if (existing) {
    const updated = await prisma.loadingUiSettings.update({
      where: { id: existing.id },
      data: {
        enabled: data.enabled ?? existing.enabled,
        defaultAssetId: data.defaultAssetId !== undefined ? data.defaultAssetId : existing.defaultAssetId,
        assets: data.assets !== undefined ? data.assets : (existing.assets as any),
        rules: data.rules !== undefined ? data.rules : (existing.rules as any),
      },
    });
    return sanitizeSettings(updated);
  }

  const created = await prisma.loadingUiSettings.create({
    data: {
      brandId,
      enabled: data.enabled ?? DEFAULT_SETTINGS.enabled,
      defaultAssetId: data.defaultAssetId ?? DEFAULT_SETTINGS.defaultAssetId,
      assets: data.assets ?? DEFAULT_SETTINGS.assets,
      rules: data.rules ?? DEFAULT_SETTINGS.rules,
    },
  });
  return sanitizeSettings(created);
}

