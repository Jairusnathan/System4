'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShoppingBag, X, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { buildApiUrl } from '@/lib/api';
import { Product } from '../types';

const partnerBrands = [
  'Pfizer', 'Johnson & Johnson', 'Bayer', 'GSK', 'Novartis',
  'Sanofi', 'AstraZeneca', 'Unilab', 'Bioten', 'Centrum'
];

export default function Home() {
  const {
    setView,
    setIsBranchModalOpen,
    selectedBranch,
    branchInventory,
    addToCart,
    setSelectedProduct,
  } = useAppContext();
  const [featuredProducts, setFeaturedProducts] = React.useState<Product[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = React.useState(true);
  const [featuredError, setFeaturedError] = React.useState('');

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadFeaturedProducts() {
      try {
        setIsLoadingFeatured(true);
        setFeaturedError('');

        const params = new URLSearchParams({
          limit: '4',
          sortBy: 'popularity',
        });

        if (selectedBranch) {
          params.set('branchId', String(selectedBranch.id));
        }

        const response = await fetch(buildApiUrl(`/api/products?${params.toString()}`), {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load featured products.');
        }

        setFeaturedProducts((payload.data ?? []).slice(0, 4));
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        console.error('Featured products fetch failed:', error);
        setFeaturedProducts([]);
        setFeaturedError('Unable to load featured products right now.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingFeatured(false);
        }
      }
    }

    loadFeaturedProducts();

    return () => controller.abort();
  }, [selectedBranch]);

  const branchStockByProductId = React.useMemo(
    () => new Map(branchInventory.map((item) => [item.product_id, item.stock])),
    [branchInventory]
  );

  return (
    <main className="flex-1 bg-white">
      <section className="bg-emerald-50/50 py-20 lg:py-32">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-tight mb-6 tracking-tight">
              Your Health, <span className="text-emerald-600">Delivered Fast</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
              Get your medicines, vitamins, and daily essentials delivered right to your doorstep with PharmaQuick. Safe, reliable, and fast.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setView('shop')}
                className="px-10 py-4 bg-emerald-600 text-white rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                Shop Now
              </button>
              <button
                onClick={() => setIsBranchModalOpen(true)}
                className="px-10 py-4 bg-white text-emerald-600 border-2 border-emerald-600 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-5 h-5" />
                Choose Branch
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 border-b border-slate-50">
        <div className="max-w-[1400px] mx-auto px-4 mb-8">
          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Trusted by Top Brands</p>
        </div>
        <div className="relative flex overflow-hidden">
          <div className="animate-marquee flex items-center gap-24 whitespace-nowrap">
            {partnerBrands.map((brand, i) => (
              <span key={i} className="text-4xl font-black text-slate-200 uppercase tracking-tighter select-none">{brand}</span>
            ))}
            {partnerBrands.map((brand, i) => (
              <span key={`dup-${i}`} className="text-4xl font-black text-slate-200 uppercase tracking-tighter select-none">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Featured Products</h2>
              <p className="text-slate-500 font-medium">Handpicked essentials for your daily needs.</p>
            </div>
            <button
              onClick={() => setView('shop')}
              className="text-emerald-600 font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {isLoadingFeatured && (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
                Loading featured products...
              </div>
            )}

            {!isLoadingFeatured && featuredError && (
              <div className="col-span-full rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center text-red-600">
                {featuredError}
              </div>
            )}

            {!isLoadingFeatured && !featuredError && featuredProducts.map((product, idx) => {
              const branchStock = selectedBranch
                ? branchStockByProductId.get(product.id)
                : product.stock;
              const availableStock = typeof branchStock === 'number' ? branchStock : (product.stock ?? 0);
              const isOutOfStock = availableStock <= 0;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-black text-slate-900 uppercase tracking-wider rounded-lg shadow-sm">
                        {product.category}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 mb-1">{product.name}</h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">{product.description}</p>

                  {isOutOfStock && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mb-4">
                      <X className="w-3 h-3" /> Out of Stock
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-emerald-600">PHP {product.price.toFixed(2)}</p>
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        addToCart(product);
                      }}
                      disabled={isOutOfStock}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBag className="w-3 h-3" /> Add to Cart
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {!isLoadingFeatured && !featuredError && featuredProducts.length === 0 && (
              <div className="col-span-full rounded-3xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
                No featured products available yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
