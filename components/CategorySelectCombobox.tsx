'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type CatRow = {
  id: string;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  parentCategoryId: string | null;
  order: number;
};

function normalizeRawCategories(raw: any[]): CatRow[] {
  return raw.map((c) => ({
    id: c.id,
    nameBg: c.nameBg ?? c.name_bg ?? '',
    nameEn: c.nameEn ?? c.name_en ?? '',
    nameRo: c.nameRo ?? c.name_ro ?? '',
    parentCategoryId: (c.parentCategoryId ?? c.parent_category_id ?? null) as string | null,
    order: c.order ?? 0,
  }));
}

function buildChildrenMap(rows: CatRow[]): Map<string | null, CatRow[]> {
  const m = new Map<string | null, CatRow[]>();
  for (const r of rows) {
    const p = r.parentCategoryId;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(r);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.order - b.order || a.nameBg.localeCompare(b.nameBg, 'bg'));
  }
  return m;
}

export interface CategorySelectComboboxProps {
  categories: any[];
  value: string;
  onChange: (categoryId: string) => void;
  locale: string;
  labelId?: string;
  disabled?: boolean;
}

export default function CategorySelectCombobox({
  categories,
  value,
  onChange,
  locale,
  labelId,
  disabled,
}: CategorySelectComboboxProps) {
  const rows = useMemo(() => normalizeRawCategories(categories), [categories]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const childrenMap = useMemo(() => buildChildrenMap(rows), [rows]);

  const getName = useCallback(
    (c: CatRow) => {
      if (locale === 'en') return c.nameEn || c.nameBg;
      if (locale === 'ro') return c.nameRo || c.nameBg;
      return c.nameBg;
    },
    [locale]
  );

  const getPathLabel = useCallback(
    (catId: string) => {
      const parts: string[] = [];
      let cur: CatRow | undefined = byId.get(catId);
      let guard = 0;
      while (cur && guard < 32) {
        parts.unshift(getName(cur));
        cur = cur.parentCategoryId ? byId.get(cur.parentCategoryId) : undefined;
        guard += 1;
      }
      return parts.join(' → ');
    },
    [byId, getName]
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const comboRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    if (value) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        let cur = byId.get(value);
        let guard = 0;
        while (cur?.parentCategoryId && guard < 32) {
          next.add(cur.parentCategoryId);
          cur = byId.get(cur.parentCategoryId);
          guard += 1;
        }
        return next;
      });
    }
    return () => window.clearTimeout(t);
  }, [open, value, byId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = comboRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const q = search.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!q) return [];
    return rows
      .filter((r) => {
        const path = getPathLabel(r.id).toLowerCase();
        const blob = `${r.nameBg} ${r.nameEn} ${r.nameRo}`.toLowerCase();
        return path.includes(q) || blob.includes(q);
      })
      .sort((a, b) => getPathLabel(a.id).localeCompare(getPathLabel(b.id), 'bg'));
  }, [rows, q, getPathLabel]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const renderTree = (parentId: string | null, depth: number): ReactNode => {
    const kids = childrenMap.get(parentId) ?? [];
    if (kids.length === 0) return null;

    return kids.map((cat) => {
      const grandKids = childrenMap.get(cat.id);
      const hasKids = (grandKids?.length ?? 0) > 0;
      const isExpanded = expandedIds.has(cat.id);
      const isSelected = value === cat.id;
      const pl = 8 + depth * 14;

      return (
        <div key={cat.id}>
          <div
            className="flex min-h-[2.25rem] items-center gap-1 border-b border-[var(--theme-hairline)]/40 last:border-b-0"
            style={{ paddingLeft: pl }}
          >
            {hasKids ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(cat.id);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--theme-hairline)] bg-[var(--theme-inset)] text-base font-bold leading-none text-[var(--theme-ink)] transition-colors hover:bg-[var(--theme-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Свий' : 'Разгъни'}
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => pick(cat.id)}
              className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                isSelected
                  ? 'bg-[var(--theme-accent-tint)] font-semibold text-[var(--theme-ink)]'
                  : 'text-[var(--theme-ink)] hover:bg-[var(--theme-inset)]'
              }`}
            >
              <span className="break-words">{getName(cat)}</span>
              {isSelected && <span className="ml-1 text-[var(--theme-success)]">✓</span>}
            </button>
          </div>
          {hasKids && isExpanded && (
            <div className="ml-2 border-l-2 border-[var(--theme-hairline)] pl-2 md:ml-3 md:pl-3">
              {renderTree(cat.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const selectedLabel = value ? getPathLabel(value) : null;
  const placeholder =
    locale === 'en'
      ? '— choose category —'
      : locale === 'ro'
        ? '— alege categorie —'
        : '— избери категория —';

  const searchPlaceholder =
    locale === 'en'
      ? 'Search (name, path…)…'
      : locale === 'ro'
        ? 'Caută (nume, cale)…'
        : 'Търси (име, път)…';

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)] px-3 py-2.5 text-sm theme-muted">
        {locale === 'en' ? 'No categories.' : locale === 'ro' ? 'Nu există categorii.' : 'Няма категории.'}
      </div>
    );
  }

  return (
    <div ref={comboRef} className="relative">
      <button
        type="button"
        id="product-category-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId ? `${labelId} product-category-trigger` : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="theme-field flex w-full items-center justify-between gap-2 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selectedLabel ? 'text-[var(--theme-ink)]' : 'theme-muted'}>
          {selectedLabel || placeholder}
        </span>
        <span className="text-[var(--theme-subtle)] shrink-0" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-80 flex-col overflow-hidden rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-card)] shadow-lg"
          role="listbox"
          aria-label={locale === 'en' ? 'Categories' : locale === 'ro' ? 'Categorii' : 'Категории'}
        >
          <div
            className="shrink-0 border-b border-[var(--theme-hairline)] bg-[var(--theme-inset)] p-2"
            onMouseDown={(e) => e.preventDefault()}
          >
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="theme-field w-full text-sm"
              autoComplete="off"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {q ? (
              searchHits.length === 0 ? (
                <p className="px-3 py-4 text-sm theme-muted">
                  {locale === 'en' ? 'No matches.' : locale === 'ro' ? 'Niciun rezultat.' : 'Няма съвпадения.'}
                </p>
              ) : (
                <ul className="py-1">
                  {searchHits.map((cat) => {
                    const isSelected = value === cat.id;
                    return (
                      <li key={cat.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => pick(cat.id)}
                          className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-[var(--theme-accent-tint)] font-semibold'
                              : 'hover:bg-[var(--theme-inset)]'
                          }`}
                        >
                          <span className="break-words">{getPathLabel(cat.id)}</span>
                          {isSelected && <span className="ml-1 text-[var(--theme-success)]">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="py-1">{renderTree(null, 0)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
