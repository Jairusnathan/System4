'use client';

import React from 'react';
import { Pill, Search, ShoppingCart, User, MapPin, LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Navbar() {
  const { 
    view, setView, 
    isLoggedIn, setIsLoggedIn, 
    cart, 
    selectedBranch, 
    setIsBranchModalOpen, 
    setIsCartOpen,
    searchQuery,
    setSearchQuery
  } = useAppContext();

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-8">
          {/* Logo */}
          <div 
            onClick={() => setView('home')} 
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <Pill className="w-6 h-6 text-emerald-600" />
            <span className="text-xl font-black text-slate-900 tracking-tight">PharmaQuick</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8 shrink-0">
            <button 
              onClick={() => setView('home')} 
              className={`text-sm font-bold transition-colors ${view === 'home' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`text-sm font-bold transition-colors ${view === 'shop' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}
            >
              Shop
            </button>
            {/* Branch Selector */}
            <button 
              onClick={() => setIsBranchModalOpen(true)}
              className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors"
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              {selectedBranch ? selectedBranch.name : 'Select Branch'}
            </button>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search medicines, vitamins..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (view !== 'shop') setView('shop');
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Cart */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-600 hover:text-emerald-600 transition-all"
            >
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            {/* Auth */}
            {isLoggedIn ? (
              <button 
                onClick={() => setView('account')}
                className="p-2 text-slate-600 hover:text-emerald-600 transition-all"
              >
                <User className="w-6 h-6" />
              </button>
            ) : (
              <button 
                onClick={() => setView('login')}
                className="px-6 py-2 bg-emerald-600 text-white rounded-full font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm"
              >
                Log In
              </button>
            )}

            {/* Logout */}
            {isLoggedIn && (
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  setIsLoggedIn(false);
                  setView('home');
                }}
                className="p-2 text-slate-600 hover:text-emerald-600 transition-all"
              >
                <LogOut className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
