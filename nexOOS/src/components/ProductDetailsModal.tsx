'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function ProductDetailsModal() {
  const { 
    selectedProduct, setSelectedProduct,
    isLoggedIn, setView,
    addToCart,
    selectedBranch,
    branchInventory
  } = useAppContext();
  const [addedProductName, setAddedProductName] = useState('');

  useBodyScrollLock(Boolean(selectedProduct) || Boolean(addedProductName));

  useEffect(() => {
    if (!addedProductName) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAddedProductName('');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [addedProductName]);

  if (!selectedProduct) return null;

  const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === selectedProduct.id) : null;
  const stock =
    typeof selectedProduct.stock === 'number'
      ? selectedProduct.stock
      : inventoryItem?.stock ?? 0;
  const isSelectedBranchOutOfStock = Boolean(selectedBranch && stock === 0);
  const secondaryActionClass = isSelectedBranchOutOfStock
    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
    : 'bg-blue-100 text-blue-700 hover:bg-blue-200';
  const primaryActionClass = isSelectedBranchOutOfStock
    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
    : 'bg-blue-600 text-white hover:bg-blue-700';
  let stockStatusContent: React.ReactNode;

  if (!selectedBranch) {
    stockStatusContent = (
      <span className="text-sm text-slate-500">Select a branch to view stock availability.</span>
    );
  } else if (stock > 0) {
    stockStatusContent = (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg inline-flex">
        <CheckCircle2 className="w-5 h-5" />
        <span className="font-medium">In Stock</span>
        <span className="text-sm opacity-80">({stock} items available)</span>
      </div>
    );
  } else {
    stockStatusContent = (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg inline-flex">
        <X className="w-5 h-5" />
        <span className="font-medium">Out of Stock</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {selectedProduct && (
        <>
          <AnimatePresence>
            {addedProductName && (
              <>
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
              </>
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
                      <button type="button" className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-blue-500">
                        <img src={selectedProduct.image} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                      {selectedProduct.images.map((img, idx) => (
                        <button type="button" key={idx} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-transparent hover:border-slate-300 transition-colors">
                          <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                    <div className="mb-6">{stockStatusContent}</div>

                    <p className="text-slate-600 leading-relaxed mb-8">
                      {selectedProduct.description}
                    </p>

                    {/* Specifications */}
                    {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Specifications</h3>
                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          {Object.entries(selectedProduct.specifications).map(([key, value], idx) => (
                            <div key={key} className={`flex px-4 py-3 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}>
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
                      type="button"
                      onClick={() => {
                        if (isLoggedIn) {
                          addToCart(selectedProduct, { openCart: false });
                          setAddedProductName(selectedProduct.name);
                        } else {
                          setSelectedProduct(null);
                          setView('login');
                        }
                      }}
                      disabled={isSelectedBranchOutOfStock}
                      className={`flex-1 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 ${secondaryActionClass}`}
                    >
                      <Plus className="w-5 h-5" />
                      Add to Cart
                    </button>
                    <button
                      type="button"
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
                      disabled={isSelectedBranchOutOfStock}
                      className={`flex-1 py-4 rounded-xl font-bold text-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${primaryActionClass}`}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
