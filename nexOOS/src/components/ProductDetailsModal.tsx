'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product } from '../types';
import { fetchJsonWithRetry } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-client';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const getAvailableStock = (
  selectedStock: number | undefined,
  fallbackStock: number | undefined
) => {
  if (typeof selectedStock === 'number') {
    return selectedStock;
  }

  return fallbackStock ?? 0;
};

const renderStockAvailability = (
  selectedBranch: unknown,
  hasStock: boolean,
  stock: number,
  sold?: number,
) => {
  if (!selectedBranch) {
    return <span className="text-sm text-slate-500">Select a branch to view stock availability.</span>;
  }

  if (hasStock) {
    return (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg inline-flex">
        <CheckCircle2 className="w-5 h-5" />
        <span className="font-medium">In Stock</span>
        {typeof sold === 'number' && (
          <span className="text-sm opacity-80">({sold} sold)</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg inline-flex">
      <X className="w-5 h-5" />
      <span className="font-medium">Out of Stock</span>
    </div>
  );
};

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

export default function ProductDetailsModal() {
  const {
    selectedProduct, setSelectedProduct,
    isLoggedIn, setView,
    addToCart,
    selectedBranch,
    branchInventory,
    categoryInterestMap,
  } = useAppContext();
  const [addedProductName, setAddedProductName] = useState('');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  useBodyScrollLock(Boolean(selectedProduct) || Boolean(addedProductName));

  useEffect(() => {
    if (!addedProductName) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      setAddedProductName('');
    }, 1800);

    return () => globalThis.clearTimeout(timeout);
  }, [addedProductName]);

  useEffect(() => {
    if (!selectedProduct) {
      setRecommendations([]);
      setIsLoadingRecs(false);
      return;
    }

    // Record this view in DB for cross-device personalization
    const token = getAccessToken();
    if (token) {
      fetch('/api/product-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: selectedProduct.id, category: selectedProduct.category }),
      }).catch(() => {});
    }

    const ctrl = new AbortController();
    setIsLoadingRecs(true);

    fetchJsonWithRetry<{ data?: Product[] }>(
      `/api/products/${selectedProduct.id}/recommendations?limit=4`,
      { signal: ctrl.signal },
    )
      .then((payload) => {
        const recs = normalizeProducts(payload?.data ?? []);
        // Re-rank by user's category interest — Shopee-style
        if (categoryInterestMap.size > 0) {
          recs.sort((a, b) => (categoryInterestMap.get(b.category) ?? 0) - (categoryInterestMap.get(a.category) ?? 0));
        }
        setRecommendations(recs);
      })
      .catch(() => setRecommendations([]))
      .finally(() => { if (!ctrl.signal.aborted) setIsLoadingRecs(false); });

    return () => ctrl.abort();
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      setRelatedProducts([]);
      setRelatedError('');
      setIsLoadingRelated(false);
      return;
    }

    const controller = new AbortController();

    const loadRelatedProducts = async () => {
      try {
        setIsLoadingRelated(true);
        setRelatedError('');

        const params = new URLSearchParams({
          category: selectedProduct.category,
          limit: '8',
          sortBy: 'popularity',
        });

        if (selectedBranch) {
          params.set('branchId', String(selectedBranch.id));
        }

        const payload = await fetchJsonWithRetry<{ data?: Product[] }>(
          `/api/products?${params.toString()}`,
          { signal: controller.signal },
        );

        const nextProducts = normalizeProducts(payload?.data ?? [])
          .filter((product) => product.id !== selectedProduct.id)
          .slice(0, 4);

        setRelatedProducts(nextProducts);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        console.error('Related products fetch failed:', error);
        setRelatedProducts([]);
        setRelatedError('Unable to load related products right now.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRelated(false);
        }
      }
    };

    loadRelatedProducts();

    return () => controller.abort();
  }, [selectedBranch, selectedProduct]);

  if (!selectedProduct) return null;

  const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === selectedProduct.id) : null;
  const stock = getAvailableStock(selectedProduct.stock, inventoryItem?.stock);
  const hasStock = stock > 0;

  return (
    <AnimatePresence>
      {selectedProduct && (
        <React.Fragment key={`product-modal-${selectedProduct.id || selectedProduct.name}`}>
          <AnimatePresence>
            {addedProductName && (
              <React.Fragment key={`product-added-${selectedProduct.id || selectedProduct.name}`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-[70]"
                  onClick={() => setAddedProductName('')}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 20 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[min(92vw,26rem)]"
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

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProduct(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900 line-clamp-1 pr-4">{selectedProduct.name}</h2>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Image Gallery */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img 
                      src={selectedProduct.image} 
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {selectedProduct.images && selectedProduct.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      <button className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-blue-500">
                        <img src={selectedProduct.image} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                      {selectedProduct.images.map((img, idx) => (
                        <button key={`${selectedProduct.id}-img-${idx}`} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-transparent hover:border-slate-300 transition-colors">
                          <img src={img} alt={`Thumbnail for ${selectedProduct.name}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col">
                  <div className="mb-6">
                    <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
                      {selectedProduct.category}
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h1>
                    <div className="text-2xl font-bold text-slate-900 mb-4">₱{selectedProduct.price.toFixed(2)}</div>
                    
                    {/* Stock Availability */}
                    <div className="mb-6">
                      {renderStockAvailability(selectedBranch, hasStock, stock, selectedProduct.sold)}
                    </div>

                    <p className="text-slate-600 leading-relaxed mb-8">
                      {selectedProduct.description}
                    </p>

                    {/* Specifications */}
                    {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Specifications</h3>
                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          {Object.entries(selectedProduct.specifications).map(([key, value], idx) => (
                            <div key={`${key}-${idx}`} className={`flex px-4 py-3 ${idx === 0 ? '' : 'border-t border-slate-100'}`}>
                              <span className="w-1/3 text-sm font-medium text-slate-500">{key}</span>
                              <span className="w-2/3 text-sm text-slate-900">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4">
                    <button 
                      onClick={() => {
                        if (isLoggedIn) {
                          addToCart(selectedProduct, { openCart: false });
                          setAddedProductName(selectedProduct.name);
                        } else {
                          setSelectedProduct(null);
                          setView('login');
                        }
                      }}
                      disabled={Boolean(selectedBranch && stock === 0)}
                      className={`flex-1 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 ${
                        selectedBranch && stock === 0 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => {
                        if (isLoggedIn) {
                          addToCart(selectedProduct);
                          setSelectedProduct(null);
                          setView('checkout');
                        } else {
                          setSelectedProduct(null);
                          setView('login');
                        }
                      }}
                      disabled={Boolean(selectedBranch && stock === 0)}
                      className={`flex-1 py-4 rounded-xl font-bold text-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                        selectedBranch && stock === 0 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>

              {(isLoadingRecs || recommendations.length > 0) && (
                <div className="mt-10 border-t border-slate-100 pt-8">
                  <div className="mb-5">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Frequently Bought Together</h3>
                    <p className="text-sm text-slate-500">Customers who bought this also bought these.</p>
                  </div>

                  {isLoadingRecs && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-500">
                      Analyzing purchase patterns...
                    </div>
                  )}

                  {!isLoadingRecs && recommendations.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {recommendations.map((product, idx) => {
                        const invItem = selectedBranch ? branchInventory.find((inv) => inv.product_id === product.id) : null;
                        const recStock = getAvailableStock(product.stock, invItem?.stock);
                        const outOfStock = Boolean(selectedBranch && recStock === 0);
                        return (
                          <motion.div
                            key={`rec-${product.id}-${idx}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                          >
                            <button type="button" onClick={() => setSelectedProduct(product)} className="block w-full text-left">
                              <div className="aspect-square overflow-hidden bg-slate-50">
                                <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                              </div>
                              <div className="p-4">
                                <span className="mb-2 inline-flex rounded-full bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-green-600">
                                  Often paired
                                </span>
                                <h4 className="line-clamp-2 min-h-[2.8rem] text-sm font-black tracking-tight text-slate-900">{product.name}</h4>
                                <p className="mt-1 text-lg font-black text-slate-900">PHP {product.price.toFixed(2)}</p>
                                <p className={`mt-2 text-xs font-bold ${outOfStock ? 'text-red-500' : 'text-slate-500'}`}>
                                  {outOfStock ? 'Out of stock in this branch' : 'Tap to view details'}
                                </p>
                              </div>
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-10 border-t border-slate-100 pt-8">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">You May Also Like</h3>
                    <p className="text-sm text-slate-500">
                      Similar picks from the same category.
                    </p>
                  </div>
                </div>

                {isLoadingRelated && (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-500">
                    Loading related products...
                  </div>
                )}

                {!isLoadingRelated && relatedError && (
                  <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-8 text-center text-red-600">
                    {relatedError}
                  </div>
                )}

                {!isLoadingRelated && !relatedError && relatedProducts.length === 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-500">
                    No related products available yet.
                  </div>
                )}

                {!isLoadingRelated && !relatedError && relatedProducts.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {relatedProducts.map((product, idx) => {
                      const relatedInventoryItem = selectedBranch
                        ? branchInventory.find((inv) => inv.product_id === product.id)
                        : null;
                      const relatedStock = getAvailableStock(product.stock, relatedInventoryItem?.stock);
                      const isOutOfStock = Boolean(selectedBranch && relatedStock === 0);

                      return (
                        <motion.div
                          key={`${product.id}-${product.name}-${idx}`}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className="block w-full text-left"
                          >
                            <div className="aspect-square overflow-hidden bg-slate-50">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="p-4">
                              <span className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600">
                                {product.category}
                              </span>
                              <h4 className="line-clamp-2 min-h-[2.8rem] text-sm font-black tracking-tight text-slate-900">
                                {product.name}
                              </h4>
                              <p className="mt-1 text-lg font-black text-slate-900">
                                PHP {product.price.toFixed(2)}
                              </p>
                              <p className={`mt-2 text-xs font-bold ${isOutOfStock ? 'text-red-500' : 'text-slate-500'}`}>
                                {isOutOfStock ? 'Out of stock in this branch' : 'Tap to view details'}
                              </p>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
