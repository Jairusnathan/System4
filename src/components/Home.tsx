'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShoppingBag, X, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const partnerBrands = [
  "Pfizer", "Johnson & Johnson", "Bayer", "GSK", "Novartis", 
  "Sanofi", "AstraZeneca", "Unilab", "Bioten", "Centrum"
];

export default function Home() {
  const { setView, setIsBranchModalOpen } = useAppContext();

  return (
    <main className="flex-1 bg-white">
      {/* Hero Section */}
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

      {/* Brand Marquee */}
      <section className="py-16 border-b border-slate-50">
        <div className="max-w-[1400px] mx-auto px-4 mb-8">
          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Trusted by Top Brands</p>
        </div>
        <div className="relative flex overflow-hidden">
          <div className="animate-marquee flex items-center gap-24 whitespace-nowrap">
            {partnerBrands.map((brand, i) => (
              <span key={i} className="text-4xl font-black text-slate-200 uppercase tracking-tighter select-none">{brand}</span>
            ))}
            {/* Duplicate for seamless loop */}
            {partnerBrands.map((brand, i) => (
              <span key={`dup-${i}`} className="text-4xl font-black text-slate-200 uppercase tracking-tighter select-none">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
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
            {[
              { 
                name: "Paracetamol 500mg", 
                category: "Medicines", 
                price: 45.00, 
                img: "https://picsum.photos/seed/med1/600/600",
                desc: "For pain relief and fever reduction. 10 tablets.",
                outOfStock: true
              },
              { 
                name: "Isopropyl Alcohol 70%", 
                category: "First Aid", 
                price: 85.00, 
                img: "https://picsum.photos/seed/alc/600/600",
                desc: "Antiseptic disinfectant. 500ml.",
                outOfStock: true
              },
              { 
                name: "Mint Toothpaste", 
                category: "Personal Care", 
                price: 115.00, 
                img: "https://picsum.photos/seed/paste/600/600",
                desc: "Cavity protection and fresh breath. 150g.",
                outOfStock: true
              },
              { 
                name: "Vitamin C 1000mg", 
                category: "Vitamins", 
                price: 250.00, 
                img: "https://picsum.photos/seed/vitc/600/600",
                desc: "Immune system support. 30 capsules.",
                outOfStock: true
              }
            ].map((product, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-100">
                  <img 
                    src={product.img} 
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
                <p className="text-xs text-slate-500 mb-4 line-clamp-2">{product.desc}</p>
                
                {product.outOfStock && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mb-4">
                    <X className="w-3 h-3" /> Out of Stock
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-emerald-600">₱{product.price.toFixed(2)}</p>
                  <button className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all flex items-center gap-2">
                    <ShoppingBag className="w-3 h-3" /> Add to Cart
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
