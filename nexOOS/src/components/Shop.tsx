'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ChevronDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { buildApiUrl, fetchJsonWithRetry } from '@/lib/api';
import { Product } from '../types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const SORT_OPTIONS = [
  { label: 'Top Sold', value: 'top-sold' },
  { label: '✨ For You', value: 'for-you' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];

const getProductStock = (product: Product, inventoryStock?: number) => {
  if (typeof product.stock === 'number') {
    return product.stock;
  }

  return inventoryStock ?? 0;
};

const getAddToCartButtonClassName = (isDisabled: boolean) =>
  `rounded-xl p-2 shadow-md transition-all hover:shadow-lg ${
    isDisabled
      ? 'cursor-not-allowed bg-slate-100 text-slate-300'
      : 'bg-blue-600 text-white hover:scale-105 hover:bg-blue-700'
  }`;

const getPaginationButtonClassName = (isCurrentPage: boolean) =>
  `h-12 w-12 rounded-xl text-sm font-bold shadow-sm transition-all ${
    isCurrentPage
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
  }`;

const normalizeProducts = (products: Product[]) => {
  const seen = new Set<string>();

  return products.filter((product) => {
    const signature = [
      product.id?.trim() || 'missing-id',
      product.name?.trim() || 'missing-name',
      product.category?.trim() || 'missing-category',
      String(product.price ?? ''),
    ].join('|');

    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
};

const getProductRenderKey = (product: Product, idx: number) =>
  [
    product.id?.trim() || 'missing-id',
    product.name?.trim() || 'missing-name',
    product.category?.trim() || 'missing-category',
    idx,
  ].join('|');

const getApiSortByValue = (sortBy: SortOption) =>
  sortBy === 'for-you' || sortBy === 'top-sold' ? 'popularity' : sortBy;

export default function Shop() {
  const {
    selectedBranch,
    branchInventory,
    isLoggedIn,
    setView,
    addToCart,
    setSelectedProduct,
    selectedProduct,
    searchQuery,
    setSearchQuery,
    interestMap,
    categoryInterestMap,
    trendingSearches,
  } = useAppContext();

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [pendingCategories, setPendingCategories] = useState<string[]>(['All']);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('for-you');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['All']);
  const rawProductsRef = useRef<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedProductName, setAddedProductName] = useState('');
  const lastTrackedQuery = useRef('');
  const productsPerPage = 25;
  const isAllCategoriesSelected = selectedCategories.includes('All');
  const hasCategoryFilter =
    selectedCategories.length > 0 && !isAllCategoriesSelected;
  const selectedCategoryLabel = hasCategoryFilter
    ? selectedCategories.join(', ')
    : 'All';

  useBodyScrollLock(isFilterModalOpen);

  useEffect(() => {
    setPendingCategories(selectedCategories);
  }, [selectedCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, priceRange.min, priceRange.max, inStockOnly, sortBy, selectedBranch?.id]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError('');

        const params = new URLSearchParams();

        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (hasCategoryFilter) {
          selectedCategories.forEach((category) => params.append('category', category));
        }
        if (priceRange.min.trim()) params.set('minPrice', priceRange.min.trim());
        if (priceRange.max.trim()) params.set('maxPrice', priceRange.max.trim());
        if (inStockOnly) params.set('inStockOnly', 'true');
        if (selectedBranch) params.set('branchId', String(selectedBranch.id));
        // Fetch best-selling products for both "For You" and "Top Sold".
        // "For You" is then re-ranked client-side using browsing interests.
        params.set('sortBy', getApiSortByValue(sortBy));

        const payload = await fetchJsonWithRetry<{ data?: Product[] }>(
          `/api/products?${params.toString()}`,
          { signal: controller.signal },
        );

        const fetched = normalizeProducts(payload?.data ?? []);
        rawProductsRef.current = fetched;

        // Build category list dynamically from all products (no filter applied yet)
        if (!searchQuery.trim() && !hasCategoryFilter) {
          const cats = ['All', ...Array.from(new Set(fetched.map((p) => p.category).filter(Boolean))).sort()];
          setAvailableCategories(cats);
        }

        // Apply Shopee-style scoring immediately if interests are already loaded
        if (sortBy === 'for-you' && (interestMap.size > 0 || categoryInterestMap.size > 0)) {
          const scored = [...fetched].sort((a, b) => {
            const catA = (categoryInterestMap.get(a.category) ?? 0) * 100;
            const catB = (categoryInterestMap.get(b.category) ?? 0) * 100;
            const prodA = (interestMap.get(a.id) ?? 0) * 10;
            const prodB = (interestMap.get(b.id) ?? 0) * 10;
            const soldA = a.sold ?? 0;
            const soldB = b.sold ?? 0;
            return (catB + prodB + soldB) - (catA + prodA + soldA);
          });
          setProducts(scored);
        } else {
          setProducts(fetched);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        // Silently ignore network errors and 502/503 — services still starting up
        const status = (err as { status?: number }).status;
        const isStartupError = err instanceof TypeError || status === 503 || status === 502;
        if (!isStartupError) {
          console.error('Product fetch failed:', err);
          setError('Unable to load products right now.');
        }
        setProducts([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchProducts();

    return () => controller.abort();
  }, [searchQuery, selectedCategories, hasCategoryFilter, priceRange.min, priceRange.max, inStockOnly, sortBy, selectedBranch]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2 || lastTrackedQuery.current === trimmedQuery) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      fetch(buildApiUrl('/api/analytics/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          source: 'shop',
        }),
      }).catch(() => {});

      lastTrackedQuery.current = trimmedQuery;
    }, 400);

    return () => globalThis.clearTimeout(timeout);
  }, [searchQuery]);

  // Re-sort products whenever interests change — Shopee-style scoring
  useEffect(() => {
    const raw = rawProductsRef.current;
    if (raw.length === 0) return;
    if (sortBy !== 'for-you' || (interestMap.size === 0 && categoryInterestMap.size === 0)) {
      setProducts(raw);
      return;
    }
    const scored = [...raw].sort((a, b) => {
      // Category score × 100 — the dominant signal (like Shopee feed)
      const catA = (categoryInterestMap.get(a.category) ?? 0) * 100;
      const catB = (categoryInterestMap.get(b.category) ?? 0) * 100;
      // Individual product clicks × 10 — boost within category
      const prodA = (interestMap.get(a.id) ?? 0) * 10;
      const prodB = (interestMap.get(b.id) ?? 0) * 10;
      // Sold count — popularity tiebreaker
      const soldA = a.sold ?? 0;
      const soldB = b.sold ?? 0;
      return (catB + prodB + soldB) - (catA + prodA + soldA);
    });
    setProducts(scored);
  }, [interestMap, categoryInterestMap, sortBy]);


  const totalPages = Math.ceil(products.length / productsPerPage);
  const currentProducts = useMemo(
    () =>
      products.slice(
        (currentPage - 1) * productsPerPage,
        currentPage * productsPerPage
      ),
    [currentPage, products]
  );

  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'For You';

  function handlePageChange(page: number) {
    setCurrentPage(page);
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearAllFilters() {
    setSelectedCategories(['All']);
    setPendingCategories(['All']);
    setPriceRange({ min: '', max: '' });
    setInStockOnly(false);
    setSortBy('for-you');
    setSearchQuery('');
  }

  const showTrending = trendingSearches.length > 0 && !searchQuery.trim();

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
          Loading products
        </h3>
        <p className="mx-auto max-w-xs text-slate-500">
          Fetching the latest catalog and search results for you.
        </p>
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50">
          <X className="h-10 w-10 text-red-300" />
        </div>
        <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
          Unable to load products
        </h3>
        <p className="mx-auto mb-8 max-w-xs text-slate-500">{error}</p>
        <button
          onClick={() => globalThis.location.reload()}
          className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-colors hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  } else if (currentProducts.length === 0) {
    content = (
      <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50">
          <Search className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
          No products found
        </h3>
        <p className="mx-auto mb-8 max-w-xs text-slate-500">
          We couldn&apos;t find any products matching your current search or filters.
        </p>
        <button
          onClick={clearAllFilters}
          className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-colors hover:bg-blue-700"
        >
          Clear All Filters
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {currentProducts.map((product, idx) => {
            const inventoryItem = selectedBranch
              ? branchInventory.find((inv) => inv.product_id === product.id)
              : null;
            const stock = getProductStock(product, inventoryItem?.stock);
            const isOutOfStock = selectedBranch
              ? stock === 0
              : typeof product.stock === 'number' && product.stock === 0;

            return (
              <motion.div
                key={getProductRenderKey(product, idx)}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col overflow-hidden rounded-[1.3rem] border border-slate-100 bg-white shadow-sm transition-all hover:shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-50 text-left"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute left-3 top-3">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 shadow-sm backdrop-blur-sm">
                      {product.category}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    {selectedBranch ? (
                      stock > 0 ? (
                        <span className="flex w-fit items-center gap-1.5 rounded-full bg-blue-500/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                          <CheckCircle2 className="h-3 w-3" /> In Stock ({stock})
                        </span>
                      ) : (
                        <span className="flex w-fit items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                          <X className="h-3 w-3" /> Out of Stock
                        </span>
                      )
                    ) : (
                      typeof product.stock === 'number' && product.stock === 0 && (
                        <span className="flex w-fit items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                          <X className="h-3 w-3" /> Out of Stock
                        </span>
                      )
                    )}
                  </div>
                </button>

                <div className="flex flex-1 flex-col p-3.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="mb-2 w-full cursor-pointer text-left"
                  >
                    <h3 className="line-clamp-1 text-sm font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 lg:text-[15px]">
                      {product.name}
                    </h3>
                    <p className="h-8 line-clamp-2 text-[11px] leading-relaxed text-slate-500 lg:text-xs">
                      {product.description}
                    </p>
                  </button>

                  {typeof product.sold === 'number' && (
                    <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      {product.sold.toLocaleString()} sold
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-3.5">
                    <div className="text-sm font-black tracking-tight text-slate-900 lg:text-base">
                      PHP {product.price.toFixed(2)}
                    </div>
                    <button
                      onClick={() => {
                        if (isLoggedIn) {
                          addToCart(product, { openCart: false });
                          setAddedProductName(product.name);
                        } else {
                          setView('login');
                        }
                      }}
                      disabled={isOutOfStock}
                      className={getAddToCartButtonClassName(isOutOfStock)}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-16 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => {
              const pageNumber = idx + 1;

              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  className={getPaginationButtonClassName(currentPage === pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </>
    );
  }

  const togglePendingCategory = (category: string) => {
    if (category === 'All') {
      setPendingCategories(['All']);
      return;
    }

    setPendingCategories((current) => {
      const withoutAll = current.filter((item) => item !== 'All');
      const exists = withoutAll.includes(category);

      if (exists) {
        const next = withoutAll.filter((item) => item !== category);
        return next.length > 0 ? next : ['All'];
      }

      return [...withoutAll, category];
    });
  };

  useEffect(() => {
    if (!addedProductName) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      setAddedProductName('');
    }, 1800);

    return () => globalThis.clearTimeout(timeout);
  }, [addedProductName]);

  return (
    <main className="flex-1 bg-slate-50 py-7 lg:py-8">
      <AnimatePresence>
        {addedProductName && (
          <React.Fragment key={`shop-added-${addedProductName}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-50"
              onClick={() => setAddedProductName('')}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[min(92vw,26rem)]"
            >
              <div className="bg-white rounded-[2rem] border border-blue-100 shadow-2xl p-8 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                  Added to cart
                </h3>
                <p className="text-slate-500 font-medium">{addedProductName}</p>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFilterModalOpen && (
          <React.Fragment key="shop-filter-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm"
              onClick={() => {
                setPendingCategories(selectedCategories);
                setIsFilterModalOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-lg -translate-y-1/2"
            >
              <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">
                      Filter Products
                    </h2>
                    <p className="text-sm text-slate-500">
                      Choose one or more categories you want to show.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPendingCategories(selectedCategories);
                      setIsFilterModalOpen(false);
                    }}
                    className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close filter modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => togglePendingCategory(category)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        pendingCategories.includes(category)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold">{category}</span>
                      {pendingCategories.includes(category) && (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-7 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setPendingCategories(['All']);
                      setSelectedCategories(['All']);
                      setIsFilterModalOpen(false);
                    }}
                    className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategories(pendingCategories);
                      setIsFilterModalOpen(false);
                    }}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-[1420px] px-5 sm:px-6 lg:px-8 xl:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-black tracking-tight text-slate-900 lg:text-[2.8rem]">
              Shop Products
            </h1>
            <p className="text-sm text-slate-500 lg:text-base">
              Browse our wide range of authentic healthcare products.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm lg:p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSelectedCategories(['All'])}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  isAllCategoriesSelected
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                All
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <span>Filters</span>
                <SlidersHorizontal className="h-4 w-4" />
              </button>

              <div className="hidden h-9 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500">
                <span className="font-medium">Sort by</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortOption)}
                    className="appearance-none bg-transparent pr-8 font-bold text-slate-900 outline-none"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3.5 shadow-sm md:flex-row md:items-center md:justify-between lg:p-4">
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-500">
            <span className="font-bold text-slate-900">Showing {products.length} products</span>
            <span className="rounded-full bg-slate-100 px-3 py-0.5 font-semibold text-slate-600">
              Category: {selectedCategoryLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-0.5 font-semibold text-slate-600">
              Sort: {selectedSortLabel}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min price"
                value={priceRange.min}
                onChange={(event) =>
                  setPriceRange({ ...priceRange, min: event.target.value })
                }
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white lg:w-28"
              />
              <input
                type="number"
                placeholder="Max price"
                value={priceRange.max}
                onChange={(event) =>
                  setPriceRange({ ...priceRange, max: event.target.value })
                }
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white lg:w-28"
              />
            </div>
            <label htmlFor="shop-in-stock-only" className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
              <input
                id="shop-in-stock-only"
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) => setInStockOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {' '}
              In Stock Only
            </label>
            <button
              onClick={clearAllFilters}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-600 transition hover:bg-blue-50"
            >
              Clear All
            </button>
          </div>
        </div>

        {sortBy === 'for-you' && (interestMap.size > 0 || categoryInterestMap.size > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-sm font-semibold text-blue-700">
              Personalized for you — based on your browsing history
            </p>
          </motion.div>
        )}

        {showTrending && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-black tracking-tight text-slate-900">Trending Now</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div>{content}</div>
      </div>
    </main>
  );
}
