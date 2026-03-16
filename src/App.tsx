import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, Pill, Search, ArrowLeft, CreditCard, Banknote, Wallet, User, LogOut, MapPin, Clock, Eye, EyeOff, Filter, Package, Settings, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { products, categories } from './data/products';
import { Product, CartItem, Branch, BranchInventory, Order } from './types';

type ViewState = 'home' | 'shop' | 'checkout' | 'success' | 'login' | 'register' | 'forgot-password' | 'order-status' | 'account';


const partnerBrands = [
  "Pfizer", "Johnson & Johnson", "Bayer", "GSK", "Novartis", 
  "Sanofi", "AstraZeneca", "Unilab", "Bioten", "Centrum"
];

const mockOrders: Order[] = [];

// Safely parse JSON responses — prevents crash if body is empty
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Server returned unexpected response (status ${res.status})` };
  }
}


export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Auth state
  const [authForm, setAuthForm] = useState({ fullName: '', email: '', phone: '', password: '', address: '', city: '', birthday: '', gender: '' });

  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password change state
  const [resetForm, setResetForm] = useState({ email: '', newPassword: '', confirm: '' });
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);


  // Branch state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(() => {
    const saved = localStorage.getItem('selectedBranch');
    return saved ? JSON.parse(saved) : null;
  });
  const [branchInventory, setBranchInventory] = useState<BranchInventory[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isClearCartModalOpen, setIsClearCartModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [accountView, setAccountView] = useState<'profile' | 'orders' | 'settings'>('profile');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => res.json())
      .then(data => setBranches(data))
      .catch(err => console.error('Failed to fetch branches:', err));
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch));
      fetch(`/api/branches/${selectedBranch.id}/inventory`)
        .then(res => res.json())
        .then(data => setBranchInventory(data))
        .catch(err => console.error('Failed to fetch inventory:', err));
    } else {
      setBranchInventory([]);
    }
  }, [selectedBranch]);

  const isBranchOpen = (branch: Branch) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    const [openHour, openMinute] = branch.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = branch.closing_time.split(':').map(Number);
    
    const openTime = openHour + openMinute / 60;
    let closeTime = closeHour + closeMinute / 60;

    // Handle overnight hours (e.g., 14:00 to 02:00)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const payload = { 
        ...authForm, 
        email: authForm.email.toLowerCase().trim() 
      };
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsLoggedIn(true);
      setView('home');
      if (!selectedBranch) {
        setIsBranchModalOpen(true);
      }

    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: authForm.email.toLowerCase().trim(), 
          password: authForm.password 
        })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');

      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsLoggedIn(true);
      setView('home');
      if (!selectedBranch) {
        setIsBranchModalOpen(true);
      }

    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    setView('home');
    setIsLogoutModalOpen(false);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('user', JSON.stringify(user));
    alert('Profile updated! (In a real app, this would call the backend API)');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (resetForm.newPassword !== resetForm.confirm) {
      setResetError('Passwords do not match');
      return;
    }
    if (resetForm.newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetForm.email.toLowerCase().trim(), 
          newPassword: resetForm.newPassword 
        })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setResetSuccess('Password updated! You can now log in with your new password.');
      setResetForm({ email: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleChangePassword = async (_e: React.FormEvent) => {};




  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Price filter
    const minPrice = priceRange.min ? parseFloat(priceRange.min) : 0;
    const maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;

    let hasStock = true;
    if (selectedBranch) {
      const inventoryItem = branchInventory.find(inv => inv.product_id === p.id);
      hasStock = inventoryItem ? inventoryItem.stock > 0 : false;
    }

    // Availability filter
    const matchesAvailability = !inStockOnly || hasStock;

    return matchesCategory && matchesSearch && matchesPrice && matchesAvailability;
  });

  const clearFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setPriceRange({ min: '', max: '' });
    setInStockOnly(false);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const addToCart = (product: Product) => {
    if (!selectedBranch) {
      setIsBranchModalOpen(true);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryFee = 49.00;
  const finalTotal = cartTotal + deliveryFee;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setView('checkout');
    window.scrollTo(0, 0);
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setView('success');
    setCart([]);
    setTimeout(() => {
      setView('shop');
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-2 text-emerald-600 cursor-pointer"
              onClick={() => setView('home')}
            >
              <Pill className="w-8 h-8" />
              <span className="text-xl font-bold tracking-tight">PharmaQuick</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setView('home')} className={`font-medium transition-colors ${view === 'home' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-500'}`}>Home</button>
              <button onClick={() => setView('shop')} className={`font-medium transition-colors ${view === 'shop' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-500'}`}>Shop</button>
              <button 
                onClick={() => setIsBranchModalOpen(true)} 
                className="flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-500 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="max-w-[120px] truncate">
                  {selectedBranch ? selectedBranch.name : 'Select Branch'}
                </span>
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {view === 'shop' && (
              <div className="flex-1 max-w-md mx-4 hidden sm:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search medicines, vitamins..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-600 hover:text-emerald-600 transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-emerald-500 rounded-full border-2 border-white">
                  {cartItemCount}
                </span>
              )}
            </button>

            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setView('account')}
                  className="flex items-center gap-2 p-2 text-slate-600 hover:text-emerald-600 transition-colors"
                  title="My Account"
                >
                  <User className="w-6 h-6" />
                  <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">{user?.fullName}</span>
                </button>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="p-2 text-slate-600 hover:text-red-600 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-full transition-colors"
              >
                Log In
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Search & Branch */}
        {view === 'shop' && (
          <div className="sm:hidden px-4 pb-3 space-y-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
              </div>
              <button 
                onClick={() => setIsBranchModalOpen(true)} 
                className="w-full flex items-center justify-center gap-2 font-medium text-slate-600 bg-slate-100 py-2 rounded-full hover:bg-slate-200 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="truncate">
                  {selectedBranch ? selectedBranch.name : 'Select Branch'}
                </span>
              </button>
          </div>
        )}
      </header>

      {/* Login Page */}
      {view === 'login' && (
        <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 mb-6">
                <Pill className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">
                Please sign in to your account
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{authError}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input 
                    type="email" 
                    required 
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="you@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      value={authForm.password}
                      onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow pr-12" 
                      placeholder="••••••••" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
                <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded" />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">Remember me</label>
                </div>
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => { setAuthError(''); setResetError(''); setResetSuccess(''); setResetForm({ email: '', newPassword: '', confirm: '' }); setView('forgot-password'); }}
                    className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
              <div>
                <button type="submit" disabled={authLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  {authLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
            <div className="text-center mt-6">
              <p className="text-sm text-slate-600">
                Don't have an account? <button onClick={() => { setAuthError(''); setView('register'); }} className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">Sign up</button>
              </p>
            </div>
          </motion.div>
        </main>
      )}

      {/* Forgot Password Page */}
      {view === 'forgot-password' && (
        <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-50 mb-6">
                <Eye className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reset Password</h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your account email and a new password
              </p>
            </div>

            {resetSuccess ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{resetSuccess}</span>
                </div>
                <button
                  onClick={() => { setResetSuccess(''); setView('login'); }}
                  className="w-full py-3 px-4 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={handleResetPassword}>
                {resetError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{resetError}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input
                    type="email"
                    required
                    value={resetForm.email}
                    onChange={e => setResetForm({ ...resetForm, email: e.target.value })}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={resetForm.newPassword}
                      onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow pr-12"
                      placeholder="Min. 8 characters"
                    />
                    <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={resetForm.confirm}
                    onChange={e => setResetForm({ ...resetForm, confirm: e.target.value })}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                    placeholder="Re-enter new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setView('login')} className="text-sm text-slate-500 hover:text-emerald-600 transition-colors">
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </main>
      )}

      {/* Register Page */}
      {view === 'register' && (
        <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 mb-6">
                <Pill className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create an account</h2>
              <p className="mt-2 text-sm text-slate-500">
                Join PharmaQuick today
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleRegister}>
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{authError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={authForm.fullName}
                    onChange={e => setAuthForm({...authForm, fullName: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="Juan Dela Cruz" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input 
                    type="email" 
                    required 
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="you@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    required 
                    pattern="^\+63\d{10}$"
                    title="Format: +63XXXXXXXXXX"
                    value={authForm.phone}
                    onChange={e => setAuthForm({...authForm, phone: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="+639123456789" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      minLength={8}
                      value={authForm.password}
                      onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow pr-12" 
                      placeholder="Min. 8 characters" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address</label>
                  <textarea 
                    rows={2}
                    value={authForm.address}
                    onChange={e => setAuthForm({...authForm, address: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow outline-none resize-none" 
                    placeholder="Street, Barangay, Village" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input 
                    type="text" 
                    value={authForm.city}
                    onChange={e => setAuthForm({...authForm, city: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="Quezon City" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Birthday</label>
                  <input 
                    type="date" 
                    value={authForm.birthday}
                    onChange={e => setAuthForm({...authForm, birthday: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select 
                    value={authForm.gender}
                    onChange={e => setAuthForm({...authForm, gender: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow outline-none bg-white"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-center mt-8">
                <button type="submit" disabled={authLoading} className="w-full sm:w-64 flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  {authLoading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>
            <div className="text-center mt-6">
              <p className="text-sm text-slate-600">
                Already have an account? <button onClick={() => { setAuthError(''); setView('login'); }} className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">Sign in</button>
              </p>
            </div>
          </motion.div>
        </main>
      )}

      {/* Home Page */}
      {view === 'home' && (
        <main className="flex flex-col min-h-screen">
          {/* Hero Section */}
          <section className="bg-emerald-50 py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {!selectedBranch && isLoggedIn && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto mb-8"
              >
                <div className="bg-white border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-full">
                      <MapPin className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Delivery Location Required</p>
                      <p className="text-sm text-slate-500">Please select a branch to see accurate product availability and delivery times.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsBranchModalOpen(true)}
                    className="whitespace-nowrap bg-amber-500 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    Select Branch Now
                  </button>
                </div>
              </motion.div>
            )}
            <div className="max-w-7xl mx-auto text-center relative z-10">
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Your Health, <span className="text-emerald-600">Delivered Fast</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                Get your medicines, vitamins, and daily essentials delivered right to your doorstep with PharmaQuick. Safe, reliable, and fast.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => setView('shop')} 
                  className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  Shop Now
                </button>
                <button 
                  onClick={() => setIsBranchModalOpen(true)} 
                  className="w-full sm:w-auto bg-white text-emerald-600 border-2 border-emerald-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all shadow-md hover:shadow-lg hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Choose Branch
                </button>
              </div>
            </div>
          </section>

          {/* Partner Brands Marquee */}
          <section className="py-10 bg-white border-y border-slate-100 overflow-hidden flex flex-col justify-center">
            <div className="max-w-7xl mx-auto px-4 mb-6 text-center w-full">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trusted by Top Brands</h2>
            </div>
            <div className="relative w-full overflow-hidden flex bg-white">
              <div className="flex w-max animate-marquee">
                {[...partnerBrands, ...partnerBrands, ...partnerBrands].map((brand, i) => (
                  <div key={i} className="flex items-center justify-center px-12">
                    <span className="text-2xl font-bold text-slate-300 whitespace-nowrap">{brand}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Featured Products */}
          <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Products</h2>
                <p className="text-slate-500">Handpicked essentials for your daily needs.</p>
              </div>
              <button onClick={() => setView('shop')} className="hidden sm:flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                View All <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.slice(0, 4).map(product => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  key={product.id} 
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div 
                    className="aspect-square relative overflow-hidden bg-slate-100 cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
                      {product.category}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 
                      className="font-semibold text-lg text-slate-900 mb-1 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => setSelectedProduct(product)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-2 flex-1 line-clamp-2">{product.description}</p>
                    
                    {/* Stock Availability */}
                    <div className="mb-4">
                      {(() => {
                        const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === product.id) : null;
                        const stock = inventoryItem ? inventoryItem.stock : 0;
                        
                        if (!selectedBranch) return <span className="text-xs text-slate-400">Select a branch to view stock</span>;
                        
                        if (stock > 0) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                              <CheckCircle2 className="w-3 h-3" />
                              In Stock ({stock} left)
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
                              <X className="w-3 h-3" />
                              Out of Stock
                            </span>
                          );
                        }
                      })()}
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xl font-bold text-emerald-700">₱{product.price.toFixed(2)}</span>
                      <button 
                        onClick={() => isLoggedIn ? addToCart(product) : setView('login')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-600 hover:text-white transition-colors font-semibold text-sm"
                        aria-label="Add to cart"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <button onClick={() => setView('shop')} className="inline-flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                View All Products <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </section>
        </main>
      )}

      {/* Main Content Area */}
      {view === 'shop' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
          {/* Filter Sidebar */}
          <AnimatePresence>
            {isFilterOpen && (
              <motion.aside 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full md:w-64 shrink-0"
              >
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24 w-full md:w-64">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-900">Filters</h2>
                    <button 
                      onClick={clearFilters}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Clear All
                    </button>
                  </div>

              {/* Category Filter */}
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">Category</h3>
                <div className="space-y-2">
                  {categories.map(category => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => {
                          setSelectedCategory(category);
                          setCurrentPage(1);
                        }}
                        className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                      />
                      <span className={`text-sm transition-colors ${selectedCategory === category ? 'text-emerald-700 font-medium' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">Price Range (₱)</h3>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={priceRange.min}
                    onChange={(e) => {
                      setPriceRange({ ...priceRange, min: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-slate-400">-</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={priceRange.max}
                    onChange={(e) => {
                      setPriceRange({ ...priceRange, max: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Availability Filter */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">Availability</h3>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={inStockOnly}
                    onChange={(e) => {
                      setInStockOnly(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className={`text-sm transition-colors ${inStockOnly ? 'text-emerald-700 font-medium' : 'text-slate-600 group-hover:text-slate-900'}`}>
                    In Stock Only
                  </span>
                </label>
              </div>
            </div>
          </motion.aside>
            )}
          </AnimatePresence>

          {/* Product Grid Area */}
          <motion.div layout className="flex-1">
            {/* Top Bar with Filter Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm border ${
                  isFilterOpen 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-5 h-5" />
                {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
              </button>
              
              <div className="text-sm text-slate-500 font-medium">
                Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </div>
            </div>

            {/* Mobile Categories (Hidden on Desktop) */}
            <div className="md:hidden flex overflow-x-auto pb-4 mb-6 hide-scrollbar gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProducts.map(product => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                key={product.id} 
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col"
              >
                <div 
                  className="aspect-square relative overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
                    {product.category}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 
                    className="font-semibold text-lg text-slate-900 mb-1 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {product.name}
                  </h3>
                  <p className="text-sm text-slate-500 mb-2 flex-1 line-clamp-2">{product.description}</p>
                  
                  {/* Stock Availability */}
                  <div className="mb-4">
                    {(() => {
                      const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === product.id) : null;
                      const stock = inventoryItem ? inventoryItem.stock : 0;
                      
                      if (!selectedBranch) return <span className="text-xs text-slate-400">Select a branch to view stock</span>;
                      
                      if (stock > 0) {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock ({stock} left)
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
                            <X className="w-3 h-3" />
                            Out of Stock
                          </span>
                        );
                      }
                    })()}
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xl font-bold text-emerald-700">₱{product.price.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            </motion.div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg">No products found matching your criteria.</p>
            </div>
          )}

          {/* Pagination */}
          {filteredProducts.length > 0 && (
            <div className="flex flex-col items-center gap-10 mt-16 w-full max-w-2xl mx-auto">
              <div className="flex justify-center items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  
                  if (totalPages <= maxVisiblePages) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    pages.push(1);
                    
                    if (currentPage > 3) {
                      pages.push('...');
                    }
                    
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    
                    for (let i = start; i <= end; i++) {
                      if (i !== 1 && i !== totalPages) {
                        pages.push(i);
                      }
                    }
                    
                    if (currentPage < totalPages - 2) {
                      pages.push('...');
                    }
                    
                    if (totalPages > 1) {
                      pages.push(totalPages);
                    }
                  }

                  return pages.map((page, idx) => (
                    <button
                      key={idx}
                      onClick={() => typeof page === 'number' ? setCurrentPage(page) : null}
                      disabled={page === '...'}
                      className={`w-12 h-12 flex items-center justify-center rounded-xl border text-lg font-bold transition-colors
                        ${page === currentPage 
                          ? 'bg-blue-500 text-white border-blue-500' 
                          : page === '...' 
                            ? 'border-transparent text-slate-600 cursor-default text-xl' 
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {page}
                    </button>
                  ));
                })()}

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          </motion.div>
        </main>
      )}

      {/* Checkout Page */}
      {view === 'checkout' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button 
            onClick={() => setView('shop')}
            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shop
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Forms */}
            <div className="lg:col-span-2 space-y-6">
              <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
                
                {/* Delivery Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Delivery Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input 
                        type="text" 
                        required 
                        defaultValue={user?.fullName || ''}
                        placeholder="Juan Dela Cruz" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Phone Number</label>
                      <input 
                        type="tel" 
                        required 
                        defaultValue={user?.phone || ''}
                        placeholder="09XX XXX XXXX" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-sm font-medium text-slate-700">Complete Delivery Address</label>
                      <textarea 
                        required 
                        rows={3}
                        defaultValue={user?.address || ''}
                        placeholder="House/Unit No., Street, Barangay, City/Municipality, Province, Zip Code" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-blue-600" />
                    Payment Method
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Card */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="card" 
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Credit / Debit Card</p>
                          <p className="text-sm text-slate-500">Pay securely with card</p>
                        </div>
                      </div>
                    </label>

                    {/* COD */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="cod" 
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Cash on Delivery</p>
                          <p className="text-sm text-slate-500">Pay when you receive</p>
                        </div>
                      </div>
                    </label>

                    {/* GCash */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'gcash' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="gcash" 
                        checked={paymentMethod === 'gcash'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">GCash</p>
                          <p className="text-sm text-slate-500">Pay via GCash</p>
                        </div>
                      </div>
                    </label>

                    {/* Maya */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'maya' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="maya" 
                        checked={paymentMethod === 'maya'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Maya</p>
                          <p className="text-sm text-slate-500">Pay via Maya</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Card Instructions */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Card Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="0000 0000 0000 0000" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Expiry Date *</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="MM/YY" 
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">CVV *</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="123" 
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GCash Instructions */}
                  {paymentMethod === 'gcash' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 text-blue-900">
                        <h3 className="font-semibold mb-3 text-blue-900">GCash Payment Instructions:</h3>
                        <ol className="space-y-2 text-sm text-blue-800">
                          <li>1. Send ₱{finalTotal.toFixed(2)} to GCash number: <span className="font-bold">0917-123-4567</span></li>
                          <li>2. Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>3. Enter your GCash number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Your GCash Number *</label>
                          <input 
                            type="tel" 
                            required 
                            placeholder="09XX-XXX-XXXX" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">GCash Reference Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Enter reference number" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Maya Instructions */}
                  {paymentMethod === 'maya' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 text-blue-900">
                        <h3 className="font-semibold mb-3 text-blue-900">Maya Payment Instructions:</h3>
                        <ol className="space-y-2 text-sm text-blue-800">
                          <li>1. Send ₱{finalTotal.toFixed(2)} to Maya number: <span className="font-bold">0918-123-4567</span></li>
                          <li>2. Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>3. Enter your Maya number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Your Maya Number *</label>
                          <input 
                            type="tel" 
                            required 
                            placeholder="09XX-XXX-XXXX" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Maya Reference Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Enter reference number" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </form>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Order Summary</h2>
                
                <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 hide-scrollbar">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-slate-100" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900 line-clamp-2">{item.name}</h4>
                        <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                        <p className="text-sm font-semibold text-emerald-600">₱{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({cartItemCount} items)</span>
                    <span>₱{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span>₱{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
                    <span>Total</span>
                    <span>₱{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  type="submit"
                  form="checkout-form"
                  className="w-full mt-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  Confirm & Pay ₱{finalTotal.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Success Page */}
      {view === 'success' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="flex justify-center mb-6"
          >
            <CheckCircle2 className="w-24 h-24 text-emerald-500" />
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Order Placed Successfully!</h1>
          <p className="text-lg text-slate-600 mb-8">
            Thank you for ordering with PharmaQuick. Your items are being prepared for delivery.
          </p>
          <div className="inline-block bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left mb-8">
            <p className="text-slate-500 mb-2">Order Reference: <span className="font-mono font-bold text-slate-900">#PQ-{Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}</span></p>
            <p className="text-slate-500">Payment Method: <span className="font-bold text-slate-900 uppercase">{paymentMethod}</span></p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setView('order-status')}
              className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-md"
            >
              Track Order
            </button>
            <button 
              onClick={() => setView('shop')}
              className="px-8 py-3 bg-white text-emerald-600 border border-emerald-200 rounded-full font-bold hover:bg-emerald-50 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </main>
      )}

      {/* Account Management Page */}
      {view === 'account' && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button 
            onClick={() => setView('shop')}
            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shop
          </button>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-8">My Account</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white  p-6 rounded-2xl shadow-sm border border-slate-100  flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-100  rounded-full flex items-center justify-center text-emerald-600 overflow-hidden">
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900 ">{user?.fullName || 'User'}</h2>
                  <p className="text-sm text-slate-500 ">{user?.email || 'user@example.com'}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button 
                  onClick={() => setAccountView('profile')}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors ${accountView === 'profile' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5" />
                    <span className="font-medium">Profile Details</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setAccountView('orders')}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors ${accountView === 'orders' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5" />
                    <span className="font-medium">Order History</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setAccountView('settings')}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors ${accountView === 'settings' ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Account Settings</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 text-red-600 hover:bg-red-50 transition-colors text-left border-t border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Log Out</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="md:col-span-2 space-y-6">
              {accountView === 'profile' && (
                <div className="bg-white  p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 ">
                  <h2 className="text-xl font-bold text-slate-900  mb-6">Profile Details</h2>
                  
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-24 h-24 bg-emerald-100  rounded-full flex items-center justify-center text-emerald-600 overflow-hidden relative group">
                      {profilePic ? (
                        <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12" />
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        <span className="text-white text-xs font-medium">Upload</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setProfilePic(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 ">Profile Picture</h3>
                      <p className="text-sm text-slate-500 ">Upload a new profile picture. Max size 2MB.</p>
                    </div>
                  </div>
                  
                  <form className="space-y-6" onSubmit={handleUpdateProfile}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Full Name</label>
                        <input 
                          type="text" 
                          value={user?.fullName || ''}
                          onChange={(e) => setUser({...user, fullName: e.target.value})}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email Address</label>
                        <input 
                          type="email" 
                          value={user?.email || ''}
                          disabled
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Phone Number</label>
                        <input 
                          type="tel" 
                          value={user?.phone || ''}
                          onChange={(e) => setUser({...user, phone: e.target.value})}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Date of Birth</label>
                        <input 
                          type="date" 
                          value={user?.birthday || ''}
                          onChange={(e) => setUser({...user, birthday: e.target.value})}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Default Delivery Address</label>
                      <textarea 
                        rows={3}
                        value={user?.address || ''}
                        onChange={(e) => setUser({...user, address: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {accountView === 'orders' && (
                <div className="bg-white  p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 ">
                  <h2 className="text-xl font-bold text-slate-900  mb-6">Order History</h2>
                  
                  <div className="space-y-4">
                    {mockOrders.map((order) => (
                      <div key={order.id} className="border border-slate-100  rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold font-mono text-slate-900 ">#{order.id}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'Delivered' ? 'bg-slate-100 text-slate-600  ' : 'bg-emerald-100 text-emerald-700  '
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 ">{order.date} • {order.items.reduce((acc, item) => acc + item.quantity, 0)} items • ₱{order.total.toFixed(2)}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedOrder(order);
                            setView('order-status');
                          }}
                          className="px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50   rounded-lg hover:bg-emerald-100 :bg-emerald-900/40 transition-colors whitespace-nowrap"
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {accountView === 'settings' && (
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Account Settings</h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                      <div>
                        <h3 className="font-medium text-slate-900">Email Notifications</h3>
                        <p className="text-sm text-slate-500">Receive order updates and promotions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                      <div>
                        <h3 className="font-medium text-slate-900">SMS Notifications</h3>
                        <p className="text-sm text-slate-500">Receive delivery updates via SMS</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                    <div className="pt-2">
                      <h3 className="font-medium text-slate-900 mb-1">Password</h3>
                      <p className="text-sm text-slate-500 mb-3">Need to change your password?</p>
                      <button
                        onClick={() => { setResetError(''); setResetSuccess(''); setResetForm({ email: user?.email || '', newPassword: '', confirm: '' }); setView('forgot-password'); }}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      )}

      {/* Order Status Page */}
      {view === 'order-status' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button 
            onClick={() => setView('account')}
            className="flex items-center gap-2 text-slate-500  hover:text-emerald-600 :text-emerald-400 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Account
          </button>
          <h1 className="text-3xl font-bold text-slate-900  mb-8">Order Status</h1>
          
          <div className="bg-white  p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 ">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100 ">
              <div>
                <p className="text-sm text-slate-500 ">Order Reference</p>
                <p className="font-mono font-bold text-lg text-slate-900 ">#{selectedOrder?.id || 'PQ-847291'}</p>
                <p className="text-sm text-slate-500  mt-1">{selectedOrder?.date || 'Today'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 ">Total Cost</p>
                <p className="font-bold text-emerald-600 ">₱{(selectedOrder?.total || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Items Ordered */}
            <div className="mb-8 pb-6 border-b border-slate-100 ">
              <h3 className="font-bold text-slate-900  mb-4">Items Ordered</h3>
              <div className="space-y-4">
                {selectedOrder?.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900 ">{item.name}</h4>
                      <p className="text-sm text-slate-500 ">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-slate-900 ">₱{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                {!selectedOrder && (
                  <p className="text-sm text-slate-500 ">No items found.</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="relative border-l-2 border-slate-200  ml-3 md:ml-4 space-y-8">
              <div className="relative pl-6 md:pl-8">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-white  ${selectedOrder?.status === 'Processing' || selectedOrder?.status === 'In Transit' || selectedOrder?.status === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-200 '}`}></div>
                <h3 className={`font-bold ${selectedOrder?.status === 'Processing' || selectedOrder?.status === 'In Transit' || selectedOrder?.status === 'Delivered' ? 'text-slate-900 ' : 'text-slate-400 '}`}>Processing</h3>
                <p className="text-sm text-slate-500 ">Your items are being prepared and packed.</p>
              </div>
              <div className="relative pl-6 md:pl-8">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-white  ${selectedOrder?.status === 'In Transit' || selectedOrder?.status === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-200 '} ${selectedOrder?.status === 'In Transit' ? 'animate-pulse' : ''}`}></div>
                <h3 className={`font-bold ${selectedOrder?.status === 'In Transit' ? 'text-emerald-600 ' : selectedOrder?.status === 'Delivered' ? 'text-slate-900 ' : 'text-slate-400 '}`}>In Transit</h3>
                <p className="text-sm text-slate-500 ">Your order is on the way.</p>
              </div>
              <div className="relative pl-6 md:pl-8">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-white  ${selectedOrder?.status === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-200 '}`}></div>
                <h3 className={`font-bold ${selectedOrder?.status === 'Delivered' ? 'text-emerald-600 ' : 'text-slate-400 '}`}>Delivered</h3>
                <p className="text-sm text-slate-500 ">Order has been received.</p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Cart Drawer (Only visible in 'shop' view) */}
      <AnimatePresence>
        {isCartOpen && view === 'shop' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Your Cart
                </h2>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button 
                      onClick={() => setIsClearCartModalOpen(true)}
                      className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">Your cart is empty</h3>
                  <p className="text-slate-500 mb-6">Looks like you haven't added anything yet.</p>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-4 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-20 h-20 object-cover rounded-lg bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900 line-clamp-1">{item.name}</h4>
                            <p className="text-emerald-600 font-semibold">₱{item.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-between">
                          <button 
                            onClick={() => updateQuantity(item.id, -item.quantity)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <span className="font-medium text-slate-900">
                            ₱{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>₱{cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleProceedToCheckout}
                      className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
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
                        <button className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-emerald-500">
                          <img src={selectedProduct.image} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                        {selectedProduct.images.map((img, idx) => (
                          <button key={idx} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-transparent hover:border-slate-300 transition-colors">
                            <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex flex-col">
                    <div className="mb-6">
                      <div className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
                        {selectedProduct.category}
                      </div>
                      <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h1>
                      <div className="text-2xl font-bold text-emerald-600 mb-4">₱{selectedProduct.price.toFixed(2)}</div>
                      
                      {/* Stock Availability */}
                      <div className="mb-6">
                        {(() => {
                          const inventoryItem = selectedBranch ? branchInventory.find(inv => inv.product_id === selectedProduct.id) : null;
                          const stock = inventoryItem ? inventoryItem.stock : 0;
                          
                          if (!selectedBranch) return <span className="text-sm text-slate-500">Select a branch to view stock availability.</span>;
                          
                          if (stock > 0) {
                            return (
                              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg inline-flex">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">In Stock</span>
                                <span className="text-sm opacity-80">({stock} items available)</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg inline-flex">
                                <X className="w-5 h-5" />
                                <span className="font-medium">Out of Stock</span>
                              </div>
                            );
                          }
                        })()}
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
                        onClick={() => {
                          if (isLoggedIn) {
                            addToCart(selectedProduct);
                            setSelectedProduct(null);
                          } else {
                            setSelectedProduct(null);
                            setView('login');
                          }
                        }}
                        className="flex-1 py-4 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-lg hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2"
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
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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

      {/* Branch Selection Modal */}
      <AnimatePresence>
        {isBranchModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBranchModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Select a Branch</h2>
                  <p className="text-slate-500 text-sm mt-1">Choose an open branch to see available products</p>
                </div>
                <button 
                  onClick={() => setIsBranchModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="grid gap-4">
                  {branches.map(branch => {
                    const isOpen = isBranchOpen(branch);
                    const isSelected = selectedBranch?.id === branch.id;
                    
                    return (
                      <div 
                        key={branch.id}
                        onClick={() => {
                          if (!isOpen) return;
                          if (selectedBranch?.id !== branch.id) {
                            setCart([]);
                          }
                          setSelectedBranch(branch);
                          setIsBranchModalOpen(false);
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all ${
                          !isOpen 
                            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
                            : isSelected 
                              ? 'border-emerald-500 bg-emerald-50 cursor-pointer' 
                              : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-slate-900">{branch.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isOpen ? 'Open Now' : 'Closed'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                            <span>{branch.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>{branch.opening_time} - {branch.closing_time}</span>
                          </div>
                        </div>

                        {!isOpen && (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <X className="w-3 h-3" />
                              This branch is currently closed and cannot be selected.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Clear Cart Confirmation Modal */}
      <AnimatePresence>
        {isClearCartModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearCartModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Clear Cart?</h3>
                <p className="text-slate-500 mb-6">Are you sure you want to remove all items from your cart? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsClearCartModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setCart([]);
                      setIsClearCartModalOpen(false);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Log Out?</h3>
                <p className="text-slate-500 mb-6">Are you sure you want to log out of your account?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
                  >
                    Log Out
                  </button>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2 text-emerald-500 mb-6">
              <Pill className="w-8 h-8" />
              <span className="text-2xl font-bold text-white tracking-tight">PharmaQuick</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your trusted online pharmacy for medicines, vitamins, and daily essentials. Fast, secure, and reliable delivery to your doorstep.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><button onClick={() => setView('home')} className="hover:text-emerald-400 transition-colors">Home</button></li>
              <li><button onClick={() => setView('shop')} className="hover:text-emerald-400 transition-colors">Shop Products</button></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact Support</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Customer Service</h4>
            <ul className="space-y-4">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Shipping Policy</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Returns & Refunds</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">E:</span>
                <a href="mailto:support@pharmaquick.com" className="hover:text-emerald-400 transition-colors">support@pharmaquick.com</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">P:</span>
                <span>(02) 8123-4567</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">A:</span>
                <span>123 Health Avenue, Medical District, Manila, Philippines</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} PharmaQuick. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
