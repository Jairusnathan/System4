'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, ChevronLeft, ChevronRight, ShoppingCart, Plus, CheckCircle2, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { products } from '../data/products';
import { Product } from '../types';

const CATEGORIES = ['All', 'Prescription', 'Over-the-Counter', 'Vitamins', 'Personal Care', 'Baby Care', 'Medical Supplies', 'First Aid'];

export default function Shop() {
  const { 
    selectedBranch, 
    setIsBranchModalOpen, 
    branchInventory,
    isLoggedIn, setView,
    addToCart,
    setSelectedProduct,
    searchQuery,
    setSearchQuery
  } = useAppContext();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           product.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      
      const price = product.price;
      const minPrice = priceRange.min === '' ? 0 : parseFloat(priceRange.min);
      const maxPrice = priceRange.max === '' ? Infinity : parseFloat(priceRange.max);
      const matchesPrice = price >= minPrice && price <= maxPrice;

      const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === product.id) : null;
      const stock = inventoryItem ? inventoryItem.stock : 0;
      const matchesStock = !inStockOnly || (selectedBranch && stock > 0);

      return matchesSearch && matchesCategory && matchesPrice && matchesStock;
    });
  }, [searchQuery, selectedCategory, priceRange, inStockOnly, selectedBranch, branchInventory]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="flex-1 bg-slate-50 py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header (Mobile/Tablet) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Shop Products</h1>
            <p className="text-slate-500">Browse our wide range of authentic healthcare products.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-emerald-100 text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-all shadow-sm"
          >
            <Filter className="w-5 h-5" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="text-slate-500 font-bold text-sm">
            Showing {filteredProducts.length} products
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="lg:col-span-1 space-y-6"
              >
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-900">Filters</h3>
                    <button 
                      onClick={() => {
                        setSelectedCategory('All');
                        setPriceRange({ min: '', max: '' });
                        setInStockOnly(false);
                        setSearchQuery('');
                      }}
                      className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Categories */}
                  <div className="mb-10">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Category</h4>
                    <div className="space-y-4">
                      {CATEGORIES.map(cat => (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="radio"
                              name="category"
                              checked={selectedCategory === cat}
                              onChange={() => {
                                setSelectedCategory(cat);
                                setCurrentPage(1);
                              }}
                              className="appearance-none w-5 h-5 border-2 border-slate-200 rounded-full checked:border-emerald-600 transition-all"
                            />
                            {selectedCategory === cat && (
                              <div className="absolute w-2.5 h-2.5 bg-emerald-600 rounded-full" />
                            )}
                          </div>
                          <span className={`text-sm font-bold transition-colors ${selectedCategory === cat ? 'text-emerald-600' : 'text-slate-600 group-hover:text-slate-900'}`}>
                            {cat}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="mb-10">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Price Range (₱)</h4>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number"
                        placeholder="Min"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({...priceRange, min: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <span className="text-slate-300">-</span>
                      <input 
                        type="number"
                        placeholder="Max"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({...priceRange, max: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Availability</h4>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                          className="appearance-none w-5 h-5 border-2 border-slate-200 rounded-lg checked:bg-emerald-600 checked:border-emerald-600 transition-all"
                        />
                        {inStockOnly && (
                          <CheckCircle2 className="absolute w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                        In Stock Only
                      </span>
                    </label>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <div className={`${showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
            {currentProducts.length === 0 ? (
              <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">No products found</h3>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">We couldn't find any products matching your current search or filters.</p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {currentProducts.map(product => {
                    const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === product.id) : null;
                    const stock = inventoryItem ? inventoryItem.stock : 0;
                    
                    return (
                      <motion.div 
                        key={product.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col"
                      >
                        <div 
                          onClick={() => setSelectedProduct(product)}
                          className="relative aspect-square overflow-hidden bg-slate-50 cursor-pointer"
                        >
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4">
                            <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black text-emerald-600 uppercase tracking-wider shadow-sm">
                              {product.category}
                            </span>
                          </div>
                          {selectedBranch && (
                            <div className="absolute bottom-4 left-4 right-4">
                              {stock > 0 ? (
                                <span className="bg-emerald-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-fit shadow-lg">
                                  <CheckCircle2 className="w-3 h-3" /> In Stock ({stock})
                                </span>
                              ) : (
                                <span className="bg-red-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-fit shadow-lg">
                                  <X className="w-3 h-3" /> Out of Stock
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                          <div 
                            onClick={() => setSelectedProduct(product)}
                            className="cursor-pointer mb-2"
                          >
                            <h3 className="font-black text-slate-900 text-lg line-clamp-1 group-hover:text-emerald-600 transition-colors tracking-tight">
                              {product.name}
                            </h3>
                            <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed h-10">
                              {product.description}
                            </p>
                          </div>
                          
                          <div className="mt-auto pt-6 flex items-center justify-between">
                            <div className="text-xl font-black text-slate-900 tracking-tight">
                              ₱{product.price.toFixed(2)}
                            </div>
                            <button 
                              onClick={() => {
                                if (isLoggedIn) {
                                  addToCart(product);
                                } else {
                                  setView('login');
                                }
                              }}
                              disabled={selectedBranch && stock === 0}
                              className={`p-3 rounded-xl transition-all shadow-md hover:shadow-lg ${
                                selectedBranch && stock === 0 
                                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-110'
                              }`}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-16 flex items-center justify-center gap-2">
                    <button 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    {[...Array(totalPages)].map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handlePageChange(idx + 1)}
                        className={`w-12 h-12 rounded-xl font-bold text-sm transition-all shadow-sm ${
                          currentPage === idx + 1 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    
                    <button 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
