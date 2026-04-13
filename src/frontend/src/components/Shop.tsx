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
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { buildApiUrl } from '@/lib/api';
import { Product } from '../types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const CATEGORIES = ['All', 'Medicines', 'First Aid', 'Personal Care', 'Vitamins'];
const SORT_OPTIONS = [
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];

export default function Shop() {
  const {
    selectedBranch,
    branchInventory,
    isLoggedIn,
    setView,
    addToCart,
    setSelectedProduct,
    searchQuery,
    setSearchQuery,
  } = useAppContext();

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [pendingCategories, setPendingCategories] = useState<string[]>(['All']);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedProductName, setAddedProductName] = useState('');
  const lastTrackedQuery = useRef('');
  const productsPerPage = 25;
  const hasCategoryFilter =
    selectedCategories.length > 0 && !selectedCategories.includes('All');
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
        params.set('sortBy', sortBy);

        const response = await fetch(buildApiUrl(`/api/products?${params.toString()}`), {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load products');
        }

        setProducts(payload.data ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        console.error('Product fetch failed:', err);
        setProducts([]);
        setError('Unable to load products right now.');
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

    const timeout = window.setTimeout(() => {
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

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

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
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Price: Low to High';

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    setSelectedCategories(['All']);
    setPendingCategories(['All']);
    setPriceRange({ min: '', max: '' });
    setInStockOnly(false);
    setSortBy('price-asc');
    setSearchQuery('');
  };

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

    const timeout = window.setTimeout(() => {
      setAddedProductName('');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [addedProductName]);

  return (
    <main className="flex-1 bg-slate-50 py-7 lg:py-8">
      <AnimatePresence>
        {addedProductName && (
          <>
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
              <div className="bg-white rounded-[2rem] border border-emerald-100 shadow-2xl p-8 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                  Added to cart
                </h3>
                <p className="text-slate-500 font-medium">{addedProductName}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFilterModalOpen && (
          <>
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
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => togglePendingCategory(category)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        pendingCategories.includes(category)
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
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
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </motion.div>
          </>
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
                  !hasCategoryFilter
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

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500">
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
              </label>
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
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white lg:w-28"
              />
              <input
                type="number"
                placeholder="Max price"
                value={priceRange.max}
                onChange={(event) =>
                  setPriceRange({ ...priceRange, max: event.target.value })
                }
                className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white lg:w-28"
              />
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) => setInStockOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              In Stock Only
            </label>
            <button
              onClick={clearAllFilters}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50"
            >
              Clear All
            </button>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
              <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
                Loading products
              </h3>
              <p className="mx-auto max-w-xs text-slate-500">
                Fetching the latest catalog and search results for you.
              </p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50">
                <X className="h-10 w-10 text-red-300" />
              </div>
              <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
                Unable to load products
              </h3>
              <p className="mx-auto mb-8 max-w-xs text-slate-500">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-100 transition-colors hover:bg-emerald-700"
              >
                Retry
              </button>
            </div>
          ) : currentProducts.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center shadow-sm lg:p-14">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50">
                <Search className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900">
                No products found
              </h3>
              <p className="mx-auto mb-8 max-w-xs text-slate-500">
                We couldn't find any products matching your current search or filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-lg shadow-emerald-100 transition-colors hover:bg-emerald-700"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {currentProducts.map((product) => {
                  const inventoryItem = selectedBranch
                    ? branchInventory.find((inv) => inv.product_id === product.id)
                    : null;
                  const stock =
                    typeof product.stock === 'number'
                      ? product.stock
                      : inventoryItem
                        ? inventoryItem.stock
                        : 0;

                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex flex-col overflow-hidden rounded-[1.3rem] border border-slate-100 bg-white shadow-sm transition-all hover:shadow-xl"
                    >
                      <div
                        onClick={() => setSelectedProduct(product)}
                        className="relative aspect-square cursor-pointer overflow-hidden bg-slate-50"
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute left-3 top-3">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 shadow-sm backdrop-blur-sm">
                            {product.category}
                          </span>
                        </div>
                        {selectedBranch && (
                          <div className="absolute bottom-3 left-3 right-3">
                            {stock > 0 ? (
                              <span className="flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                                <CheckCircle2 className="h-3 w-3" /> In Stock ({stock})
                              </span>
                            ) : (
                              <span className="flex w-fit items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                                <X className="h-3 w-3" /> Out of Stock
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-3.5">
                        <div
                          onClick={() => setSelectedProduct(product)}
                          className="mb-2 cursor-pointer"
                        >
                          <h3 className="line-clamp-1 text-sm font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-600 lg:text-[15px]">
                            {product.name}
                          </h3>
                          <p className="h-8 line-clamp-2 text-[11px] leading-relaxed text-slate-500 lg:text-xs">
                            {product.description}
                          </p>
                        </div>

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
                            disabled={selectedBranch && stock === 0}
                            className={`rounded-xl p-2 shadow-md transition-all hover:shadow-lg ${
                              selectedBranch && stock === 0
                                ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                                : 'bg-emerald-600 text-white hover:scale-105 hover:bg-emerald-700'
                            }`}
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

                  {[...Array(totalPages)].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(idx + 1)}
                      className={`h-12 w-12 rounded-xl text-sm font-bold shadow-sm transition-all ${
                        currentPage === idx + 1
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}

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
          )}
        </div>
      </div>
    </main>
  );
}
