'use client';

import { useEffect, useState, Suspense, useMemo, useRef, useCallback, Fragment } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Price from '@/components/Price';
import {
  getChildrenOf,
  getCategoryName,
  resolveCategoryPath,
  resolveCategoryQueryToId,
  categoryParamForUrl,
  categoryPathLeafId,
  selectCategoryAtDepth,
  MALLS_MAX_CATEGORY_DEPTH,
} from '@/lib/category-navigation';
import { stripLeadingEmoji } from '@/lib/strip-leading-emoji';
import { productParamForUrl, resolveProductQueryToId } from '@/lib/product-url';

function MenuPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = pathname.split('/')[1] || 'bg';
  
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  /** [root, child, grandchild, ...] — до MALLS_MAX_CATEGORY_DEPTH нива */
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [menuSettings, setMenuSettings] = useState<{
    titleBg: string;
    titleEn: string;
    titleRo: string;
    subtitleBg: string;
    subtitleEn: string;
    subtitleRo: string;
    backgroundImageUrl: string | null;
  } | null>(null);

  const catalogLoadedRef = useRef(false);
  const categoriesRef = useRef<any[]>([]);
  categoriesRef.current = categories;
  const productsRef = useRef<any[]>([]);
  productsRef.current = products;
  const prevLocaleRef = useRef<string | null>(null);
  /** Предотвратява race: при клик пътят се обновява преди URL; старият ?category= иначе презаписва избора. */
  const skipApplyCategoryFromUrlRef = useRef(false);

  const PROMOTIONS_ROOT_ID = '__promotions__';
  const hasActivePromotions = useMemo(() => products.some((p: any) => !!p?.isPromoted), [products]);
  const isPromotionsMode = categoryPath[0] === PROMOTIONS_ROOT_ID;
  const displayCategoryId = isPromotionsMode ? PROMOTIONS_ROOT_ID : categoryPathLeafId(categoryPath);

  const categoryProducts = useMemo(() => {
    if (isPromotionsMode) return products.filter((p: any) => !!p?.isPromoted);
    return products.filter((p: any) => p.categoryId === displayCategoryId);
  }, [products, displayCategoryId, isPromotionsMode]);

  const scrollToProductById = useCallback((productId: string) => {
    setTimeout(() => {
      const el = document.getElementById(`product-${productId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[var(--malts-accent)]', 'ring-opacity-60');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-[var(--malts-accent)]', 'ring-opacity-60');
        }, 2000);
      }
    }, 400);
  }, []);

  const scrollToProductParam = useCallback((productParam: string | null, list: any[]) => {
    const id = resolveProductQueryToId(
      list.map((p: any) => ({ id: p.id, slug: p.slug })),
      productParam
    );
    if (id) scrollToProductById(id);
  }, [scrollToProductById]);

  function applyCategorySelectionFromParam(
    cats: any[],
    categoryParam: string | null,
    hasPromotions: boolean
  ) {
    if (categoryParam === 'promotions' && hasPromotions) {
      setCategoryPath((prev) =>
        prev.length === 1 && prev[0] === PROMOTIONS_ROOT_ID ? prev : [PROMOTIONS_ROOT_ID]
      );
      return;
    }
    const resolvedId = resolveCategoryQueryToId(cats, categoryParam);
    if (resolvedId) {
      const path = resolveCategoryPath(cats, resolvedId);
      setCategoryPath(path);
    } else {
      setCategoryPath([]);
    }
  }

  useEffect(() => {
    if (prevLocaleRef.current === null) {
      prevLocaleRef.current = locale;
      return;
    }
    if (prevLocaleRef.current !== locale) {
      catalogLoadedRef.current = false;
      setLoading(true);
      prevLocaleRef.current = locale;
    }
  }, [locale]);

  useEffect(() => {
    async function loadData() {
      if (catalogLoadedRef.current) {
        const categoryParam = searchParams.get('category');
        const productParam = searchParams.get('product');
        const cats = categoriesRef.current;
        const hasPromotions = productsRef.current.some((p: any) => !!p?.isPromoted);
        const resolvedId = resolveCategoryQueryToId(cats, categoryParam);
        const currentLeaf = categoryPathLeafId(categoryPath) || null;
        const resolvedNorm =
          categoryParam === 'promotions' && hasPromotions ? PROMOTIONS_ROOT_ID : resolvedId || null;
        if (resolvedNorm === currentLeaf) {
          if (productParam) scrollToProductParam(productParam, productsRef.current);
          return;
        }
        if (skipApplyCategoryFromUrlRef.current) {
          skipApplyCategoryFromUrlRef.current = false;
          if (productParam) scrollToProductParam(productParam, productsRef.current);
          return;
        }
        applyCategorySelectionFromParam(cats, categoryParam, hasPromotions);
        if (productParam) {
          scrollToProductParam(productParam, productsRef.current);
        }
        return;
      }

      setLoadProgress(8);
      const categoriesRes = await fetch('/api/categories');
      setLoadProgress(33);
      const productsRes = await fetch('/api/menu');
      setLoadProgress(66);
      const settingsRes = await fetch('/api/menu-settings');
      setLoadProgress(92);

      const categoriesData = await categoriesRes.json();
      const productsData = await productsRes.json();
      const settingsData = await settingsRes.json();

      const cats: any[] = categoriesData.categories || [];
      setCategories(cats);
      const loadedProducts = productsData.products || [];
      setProducts(loadedProducts);

      if (settingsData.settings) {
        setMenuSettings(settingsData.settings);
      } else {
        setMenuSettings({
          titleBg: 'Нашето Меню',
          titleEn: 'Our Menu',
          titleRo: 'Meniul nostru',
          subtitleBg: 'Открийте селекцията ни от напитки и деликатеси',
          subtitleEn: 'Discover our selection of drinks and delicacies',
          subtitleRo: 'Descoperă selecția noastră de băuturi și delicatese',
          backgroundImageUrl: null
        });
      }

      const categoryParam = searchParams.get('category');
      const productParam = searchParams.get('product');
      const hasPromotions = loadedProducts.some((p: any) => !!p?.isPromoted);
      applyCategorySelectionFromParam(cats, categoryParam, hasPromotions);

      if (productParam) {
        scrollToProductParam(productParam, loadedProducts);
      }

      catalogLoadedRef.current = true;
      setLoadProgress(100);
      setLoading(false);
    }

    loadData();
  }, [searchParams, locale, categoryPath, scrollToProductParam]);

  // Sync URL: set ?category= when a leaf is selected; strip category/product when nothing selected.
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (isPromotionsMode) {
      if (params.get('category') !== 'promotions') {
        params.set('category', 'promotions');
        changed = true;
      }
      if (params.has('product')) {
        params.delete('product');
        changed = true;
      }
      if (!changed) return;
      const q = params.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
      return;
    }

    if (!displayCategoryId) {
      if (params.has('category')) {
        params.delete('category');
        changed = true;
      }
      if (params.has('product')) {
        params.delete('product');
        changed = true;
      }
      if (!changed) return;
      const q = params.toString();
      router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
      return;
    }

    const leaf = categories.find((c: any) => c.id === displayCategoryId);
    const categoryInUrl = categoryParamForUrl(leaf);
    if (!categoryInUrl) return;
    if (params.get('category') !== categoryInUrl) {
      params.set('category', categoryInUrl);
      changed = true;
    }
    const pidRaw = params.get('product');
    const resolvedPid = resolveProductQueryToId(
      products.map((p: any) => ({ id: p.id, slug: p.slug })),
      pidRaw
    );
    const inLeaf =
      !!resolvedPid &&
      products.some((p: any) => p.categoryId === displayCategoryId && p.id === resolvedPid);
    if (pidRaw && displayCategoryId && !inLeaf) {
      params.delete('product');
      changed = true;
    }
    if (!changed) return;
    const q = params.toString();
    router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false });
  }, [loading, displayCategoryId, pathname, router, searchParams, products, categories, isPromotionsMode]);

  const selectProductInUrl = useCallback(
    (product: { id: string; slug?: string | null }) => {
      if (!displayCategoryId) return;
      const leaf = categories.find((c: any) => c.id === displayCategoryId);
      const categoryInUrl = categoryParamForUrl(leaf);
      if (!categoryInUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('category', categoryInUrl);
      params.set('product', productParamForUrl(product));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [categories, displayCategoryId, pathname, router, searchParams]
  );

  if (loading) return null;

  const parentCategories = categories.filter((c: any) => !c.parentCategoryId);
  const rootTierItems = hasActivePromotions
    ? [
        ...parentCategories,
        {
          id: PROMOTIONS_ROOT_ID,
          nameBg: 'Промоции',
          nameEn: 'Promotions',
          nameRo: 'Promoții',
          parentCategoryId: null,
        },
      ]
    : parentCategories;

  const breadcrumbIds = isPromotionsMode
    ? []
    : resolveCategoryPath(categories, displayCategoryId).filter(Boolean);

  const leafId = isPromotionsMode ? null : categoryPathLeafId(categoryPath);
  const childrenOfLeaf = leafId ? getChildrenOf(categories, leafId) : [];
  const needsDeeperDrill =
    !!leafId && childrenOfLeaf.length > 0 && categoryProducts.length === 0;

  const currentCategory = isPromotionsMode ? null : categories.find((c: any) => c.id === displayCategoryId);
  const categoryName = isPromotionsMode
    ? (locale === 'bg' ? 'Промоции' : locale === 'en' ? 'Promotions' : 'Promoții')
    : currentCategory
      ? getCategoryName(currentCategory, locale)
      : '';

  return (
    <main className="min-h-screen malts-surface text-[var(--malts-ink)]">
      {/* Hero Header with gradient */}
      <div 
        className={`relative overflow-hidden bg-gradient-to-br from-[#ebe4dc] via-[#e4dcd0] to-[#dcd4c8] py-12 md:py-16 ${
          menuSettings?.backgroundImageUrl ? 'border-b-0' : 'border-b-4 border-[#c41e3a]/35'
        }`}
        style={{
          backgroundImage: menuSettings?.backgroundImageUrl 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${menuSettings.backgroundImageUrl})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent"></div>
        {menuSettings?.backgroundImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: 'inset 0 -10px 18px rgba(0,0,0,0.35)' }}
            aria-hidden
          />
        )}
        
        <div className="relative container mx-auto px-4">
          <div className="text-center">
            <div className="flex flex-col items-center mb-4 md:mb-5">
              <Image
                src="/nasheto-menu.webp"
                alt=""
                width={240}
                height={240}
                className="w-[124px] h-[124px] md:w-[180px] md:h-[180px] object-contain shrink-0 drop-shadow-md mb-3 md:mb-4"
                priority
              />
              <h1
                className="text-4xl md:text-6xl font-bold malts-display"
                style={{ color: (menuSettings as any)?.titleColor || 'var(--malts-ink)' }}
              >
                {menuSettings
                  ? stripLeadingEmoji(
                      locale === 'bg'
                        ? menuSettings.titleBg
                        : locale === 'en'
                          ? menuSettings.titleEn
                          : menuSettings.titleRo
                    )
                  : locale === 'bg'
                    ? 'Нашето Меню'
                    : locale === 'en'
                      ? 'Our Menu'
                      : 'Meniul nostru'}
              </h1>
            </div>
            <p
              className="text-lg md:text-xl mb-6"
              style={{ color: (menuSettings as any)?.subtitleColor || 'var(--malts-muted)' }}
            >
              {menuSettings
                ? (locale === 'bg' ? menuSettings.subtitleBg : locale === 'en' ? menuSettings.subtitleEn : menuSettings.subtitleRo)
                : (locale === 'bg' ? 'Открийте селекцията ни от напитки и деликатеси' : 
                   locale === 'en' ? 'Discover our selection of drinks and delicacies' : 
                   'Descoperă selecția noastră de băuturi și delicatese')
              }
            </p>

            {/* Dual Currency Info */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-[rgba(245,240,230,0.72)] border border-[var(--malts-hairline)] rounded-full text-[var(--malts-ink)] backdrop-blur-sm shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-sm">
                {locale === 'bg' ? 'Цени в' : locale === 'en' ? 'Prices in' : 'Prețuri în'}{' '}
                <span className="font-bold text-[var(--malts-ink)]">EUR / BGN</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {breadcrumbIds.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4 text-sm malts-muted flex flex-wrap items-center gap-1 malts-breadcrumb-font">
            {breadcrumbIds.map((bid, i) => {
              const cat = categories.find((c: any) => c.id === bid);
              if (!cat) return null;
              const label = getCategoryName(cat, locale);
              return (
                <span key={bid} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[var(--malts-subtle)] px-1">/</span>}
                  <span className={i === breadcrumbIds.length - 1 ? 'font-semibold text-[var(--malts-ink)]' : ''}>{label}</span>
                </span>
              );
            })}
          </nav>
        )}

        {/* Category Tabs — до MALLS_MAX_CATEGORY_DEPTH нива (редове с табове) */}
        <div className="sticky md:static top-16 z-30 bg-[var(--malts-paper)]/95 backdrop-blur-lg border-y border-[var(--malts-hairline)] py-4 -mx-4 px-4 mb-4">
          {Array.from({ length: MALLS_MAX_CATEGORY_DEPTH }, (_, depth) => {
            const tierItems =
              depth === 0
                ? rootTierItems
                : isPromotionsMode
                  ? []
                  : categoryPath[depth - 1]
                  ? getChildrenOf(categories, categoryPath[depth - 1]!)
                  : [];
            if (tierItems.length === 0) return null;

            const tierStyle1 = depth < 2;
            const mobileWrap = `${depth === 0 ? 'mb-3' : ''} ${depth >= 2 ? 'mt-3' : ''} md:hidden overflow-x-auto overflow-y-hidden hide-scrollbar`;
            const desktopWrap = `hidden md:block ${depth === 0 ? 'mb-3' : ''} ${depth >= 2 ? 'mt-3' : ''}`;

            const btnClass = (isActive: boolean) =>
              depth === 0
                ? `px-6 py-3 rounded-xl font-bold transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--malts-accent)] text-[#f5f0e6] shadow-md scale-[1.02]'
                      : 'bg-[rgba(245,240,230,0.85)] text-[var(--malts-ink)] hover:bg-[rgba(245,240,230,0.95)] border border-[var(--malts-hairline)] shadow-sm'
                  }`
                : tierStyle1
                  ? `px-4 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap text-sm ${
                      isActive
                        ? 'bg-[var(--malts-accent)] text-[#f5f0e6] border-2 border-[var(--malts-accent)]'
                        : 'bg-[var(--malts-card)] text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)] border border-[var(--malts-hairline)]'
                    }`
                  : `px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm ${
                      isActive
                        ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                        : 'bg-amber-50/90 text-[var(--malts-ink)] border border-amber-200/80'
                    }`;

            return (
              <Fragment key={`menu-tier-${depth}`}>
                <div className={mobileWrap}>
                  <div className={`flex ${depth === 0 ? 'gap-3' : 'gap-2'} min-w-max mx-auto justify-center px-4`}>
                    {tierItems.map((cat: any) => {
                      const name = getCategoryName(cat, locale);
                      const isActive = categoryPath[depth] === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            skipApplyCategoryFromUrlRef.current = true;
                            if (depth === 0 && cat.id === PROMOTIONS_ROOT_ID) {
                              setCategoryPath([PROMOTIONS_ROOT_ID]);
                            } else {
                              setCategoryPath(selectCategoryAtDepth(categoryPath, depth, cat.id));
                            }
                          }}
                          className={btnClass(isActive)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={desktopWrap}>
                  <div className={`flex flex-wrap ${depth === 0 ? 'gap-3' : 'gap-2'} justify-center max-w-6xl mx-auto`}>
                    {tierItems.map((cat: any) => {
                      const name = getCategoryName(cat, locale);
                      const isActive = categoryPath[depth] === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            skipApplyCategoryFromUrlRef.current = true;
                            if (depth === 0 && cat.id === PROMOTIONS_ROOT_ID) {
                              setCategoryPath([PROMOTIONS_ROOT_ID]);
                            } else {
                              setCategoryPath(selectCategoryAtDepth(categoryPath, depth, cat.id));
                            }
                          }}
                          className={btnClass(isActive)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        {/* Selected category title (same style as /order) */}
        {categoryProducts.length > 0 && categoryName ? (
          <div className="mb-8 mt-2">
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 bg-[var(--malts-accent)] rounded-full"></div>
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--malts-ink)]">{categoryName}</h2>
              <div className="flex-1 h-px bg-[var(--malts-hairline)]"></div>
            </div>
          </div>
        ) : null}

        {/* Products Grid */}
        {categoryProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">
              {!categoryPath.length && parentCategories.length > 0 ? '🍽️' : '🔍'}
            </div>
            <p className="malts-muted text-xl max-w-lg mx-auto leading-relaxed">
              {!categoryPath.length && parentCategories.length > 0
                ? locale === 'bg'
                  ? 'Изберете раздел от менюто, за да разгледате предложенията ни.'
                  : locale === 'en'
                    ? 'Pick a menu section above to explore what we serve.'
                    : 'Alege o secțiune din meniu pentru a vedea oferta noastră.'
                : needsDeeperDrill
                  ? categoryPath.length === 1
                    ? locale === 'bg'
                      ? 'Избери подкатегория, за да видиш продуктите'
                      : locale === 'en'
                        ? 'Choose a subcategory to see products'
                        : 'Alege o subcategorie pentru a vedea produsele'
                    : locale === 'bg'
                      ? 'Избери под-подкатегория, за да видиш продуктите'
                      : locale === 'en'
                        ? 'Choose a sub-subcategory to see products'
                        : 'Alege sub-subcategoria pentru a vedea produsele'
                  : locale === 'bg'
                    ? 'Няма продукти в тази категория'
                    : locale === 'en'
                      ? 'No products in this category'
                      : 'Nu există produse în această categorie'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categoryProducts.map((product: any) => {
              const productName = locale === 'bg' ? product.nameBg : locale === 'en' ? product.nameEn : product.nameRo;
              const productDesc = locale === 'bg' ? product.descriptionBg : locale === 'en' ? product.descriptionEn : product.descriptionRo;
              const productAllergens =
                locale === 'bg'
                  ? product.allergensBg
                  : locale === 'en'
                    ? product.allergensEn
                    : product.allergensRo;
              const variantsRaw = Array.isArray(product?.variants) ? product.variants : [];
              const variants = variantsRaw
                .map((v: any) => {
                  if (typeof v === 'string') {
                    const label = String(v || '').trim();
                    return label ? { label, enabled: true } : null;
                  }
                  const label = String(v?.label ?? v?.name ?? '').trim();
                  if (!label) return null;
                  const enabled = v?.enabled !== false;
                  return { label, enabled };
                })
                .filter(Boolean)
                .filter((v: any) => v.enabled)
                .map((v: any) => v.label) as string[];

              return (
                <div
                  id={`product-${product.id}`}
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectProductInUrl(product)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectProductInUrl(product);
                    }
                  }}
                  className={`group relative malts-card rounded-2xl overflow-hidden shadow-sm hover:border-[var(--malts-accent)]/40 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer ${
                    !product.isAvailable ? 'opacity-60' : ''
                  }`}
                >
                  {product.isPromoted && (
                    <div className="h-1.5 w-full bg-gradient-to-r from-[var(--malts-accent)] to-amber-600/90" aria-hidden />
                  )}
                  {product.isPromoted && (
                    <div className="absolute top-4 left-3 z-10 bg-[var(--malts-accent)] text-[#f5f0e6] px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                      {product.promotionLabel?.trim()
                        ? product.promotionLabel
                        : locale === 'bg'
                          ? 'Промо'
                          : locale === 'en'
                            ? 'Promo'
                            : 'Promo'}
                    </div>
                  )}
                  {/* Unavailable Badge */}
                  {!product.isAvailable && (
                    <div className="absolute top-3 right-3 bg-[var(--malts-danger)] text-[#f5f0e6] px-3 py-1.5 rounded-full text-xs font-bold z-10 shadow-lg">
                      {locale === 'bg' ? '✕ Не е наличен' : 
                       locale === 'en' ? '✕ Unavailable' : 
                       '✕ Indisponibil'}
                    </div>
                  )}
                  
                  {/* Product Image */}
                  {product.imageUrl && (
                    <div
                      className={`relative h-56 w-full overflow-hidden bg-[var(--malts-inset)] ${
                        !product.isAvailable ? 'grayscale' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl}
                        alt={productName}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  )}
                  
                  {/* Product Info */}
                  <div
                    className={`p-6 ${product.isPromoted && !product.imageUrl ? 'pt-12' : ''}`}
                  >
                    <h3 className="text-xl font-bold text-[var(--malts-ink)] mb-2 group-hover:text-[var(--malts-accent)] transition-colors">
                      {productName}
                    </h3>
                    
                    {productDesc && (
                      <p className="malts-muted text-sm mb-4 leading-relaxed break-words whitespace-pre-wrap">
                        {productDesc}
                      </p>
                    )}

                    {variants.length > 0 ? (
                      <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wide malts-muted mb-1">
                          {locale === 'bg' ? 'Варианти' : locale === 'en' ? 'Variants' : 'Variante'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {variants.map((v: string) => (
                            <span
                              key={v}
                              className="inline-flex items-center rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-3 py-1.5 text-sm font-semibold text-[var(--malts-ink)]"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {productAllergens && String(productAllergens).trim() !== '' ? (
                      <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wide malts-muted mb-1">
                          {locale === 'bg' ? 'Алергени' : locale === 'en' ? 'Allergens' : 'Alergeni'}
                        </div>
                        <p className="text-sm text-[var(--malts-ink)]/85 leading-relaxed whitespace-pre-line break-words">
                          {productAllergens}
                        </p>
                      </div>
                    ) : null}
                    
                    {/* Price and Unit */}
                    <div className="pt-4 border-t border-[var(--malts-hairline)] flex justify-between items-center gap-2">
                      <div className="flex flex-col items-start gap-0.5">
                        {product.basePriceBgn != null && (
                          <span className="text-[var(--malts-subtle)] line-through text-sm inline-block">
                            <Price
                              priceBgn={Number(product.basePriceBgn)}
                              inline
                              className="text-[var(--malts-subtle)]"
                            />
                          </span>
                        )}
                        <Price
                          priceBgn={Number(product.priceBgn)}
                          className="text-xl font-bold text-[var(--malts-ink)] whitespace-nowrap"
                          showBoth={true}
                          inline={true}
                        />
                      </div>
                      {product.unit && product.quantity && (
                        <span className="text-sm malts-muted whitespace-nowrap">
                          {product.quantity} {product.unit === 'pcs' ? 'бр.' : product.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MenuPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  
  return (
    <Suspense fallback={null}>
      <MenuPageContent />
    </Suspense>
  );
}
