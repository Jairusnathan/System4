'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pill, Search, ShoppingCart, User, MapPin, LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { buildApiUrl } from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface ProductSuggestion {
  id: string;
  name: string;
  category: string;
}

export default function Navbar() {
  const { 
    view, setView, 
    setAccountSubView,
    isLoggedIn, setIsLoggedIn, 
    user,
    cart, 
    selectedBranch, 
    setIsBranchModalOpen, 
    setIsCartOpen,
    searchQuery,
    setSearchQuery
  } = useAppContext();
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock(isLogoutModalOpen);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(async () => {
      try {
        const response = await fetch(
          buildApiUrl(`/api/products/suggestions?q=${encodeURIComponent(trimmedQuery)}&limit=6`),
          { signal: controller.signal }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load suggestions');
        }

        setSuggestions(payload.data ?? []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Suggestion fetch failed:', error);
          setSuggestions([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      globalThis.clearTimeout(timeout);
    };
  }, [searchQuery]);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[4.5rem] gap-8">
          {/* Logo */}
          <button
            type="button"
            onClick={() => setView('home')}
            className="flex items-center gap-2 group shrink-0"
          >
            <Pill className="w-6 h-6 text-blue-600" />
            <span className="text-[1.35rem] font-black text-slate-900 tracking-tight">PharmaQuick</span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8 shrink-0">
            <button 
              onClick={() => setView('home')} 
              className={`text-[0.95rem] font-bold transition-colors ${view === 'home' ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`text-[0.95rem] font-bold transition-colors ${view === 'shop' ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'}`}
            >
              Shop
            </button>
            {/* Branch Selector */}
            <button 
              onClick={() => setIsBranchModalOpen(true)}
              className="flex items-center gap-2 text-[0.95rem] font-bold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <MapPin className="w-4 h-4 text-blue-600" />
              {selectedBranch ? selectedBranch.name : 'Select Branch'}
            </button>
          </div>

          {/* Search Bar */}
          <div ref={searchRef} className="hidden md:flex relative flex-1 max-w-[34rem]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[1.1rem] h-[1.1rem] text-slate-400" />
            <input 
              type="text"
              placeholder="Search medicines, vitamins..."
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                if (view !== 'shop') setView('shop');
              }}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-full text-[0.95rem] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+0.75rem)] left-0 right-0 bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onMouseDown={() => {
                      setSearchQuery(suggestion.name);
                      setView('shop');
                      setShowSuggestions(false);
                      fetch(buildApiUrl('/api/analytics/search'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          query: suggestion.name,
                          source: 'autocomplete',
                        }),
                      }).catch(() => {});
                    }}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                  >
                    <p className="font-bold text-slate-900 text-sm">{suggestion.name}</p>
                    <p className="text-xs text-slate-500">{suggestion.category}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Cart */}
            {isLoggedIn && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 text-slate-600 hover:text-blue-600 transition-all"
              >
                <ShoppingCart className="w-[1.65rem] h-[1.65rem]" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>
            )}

            {/* Auth */}
            {isLoggedIn ? (
              <button 
                onClick={() => {
                  setAccountSubView('profile');
                  setView('account');
                }}
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-blue-200 hover:text-blue-600"
              >
                {user?.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user.full_name || 'Profile'}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-[1.35rem] h-[1.35rem]" />
                )}
              </button>
            ) : (
              <button 
                onClick={() => setView('login')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-full font-bold text-[0.95rem] hover:bg-blue-700 transition-all shadow-sm"
              >
                Log In
              </button>
            )}

            {/* Logout */}
            {isLoggedIn && (
              <button 
                onClick={() => setIsLogoutModalOpen(true)}
                className="p-2.5 text-slate-600 hover:text-blue-600 transition-all"
              >
                <LogOut className="w-[1.65rem] h-[1.65rem]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isLogoutModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Log Out?</h3>
                <p className="mb-6 text-slate-500">Are you sure you want to log out?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="flex-1 rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setIsLogoutModalOpen(false);
                      setIsLoggedIn(false);
                    }}
                    className="flex-1 rounded-full bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
