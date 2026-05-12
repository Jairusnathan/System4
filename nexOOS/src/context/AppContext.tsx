'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Branch, BranchInventory, Order, CartItem, User } from '../types';
import {
  clearAccessToken,
  fetchWithAuth,
  getAccessToken,
  refreshAccessToken,
} from '@/lib/auth-client';
import { buildApiUrl } from '@/lib/api';

type AccountSubView = 'profile' | 'addresses' | 'orders' | 'settings';

interface AppContextType {
  view: string;
  setView: (view: string) => void;
  accountSubView: AccountSubView;
  setAccountSubView: React.Dispatch<React.SetStateAction<AccountSubView>>;
  isLoggedIn: boolean;
  setLoggedIn: () => void;
  logout: () => void;
  user: User | null;
  setUser: (user: User | null) => void;
  fetchUserProfile: () => Promise<void>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  branches: Branch[];
  branchInventory: BranchInventory[];
  isBranchModalOpen: boolean;
  setIsBranchModalOpen: (isOpen: boolean) => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  addToCart: (product: Product, options?: { openCart?: boolean }) => void;
  updateQuantity: (id: string, delta: number) => void;
  cartTotal: number;
  isBranchOpen: (branch: Branch) => boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'cart';

const areCartItemsEqual = (left: CartItem[], right: CartItem[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];

    return (
      item.id === other?.id &&
      item.quantity === other?.quantity
    );
  });
};

const mergeCartItems = (localItems: CartItem[], remoteItems: CartItem[]) => {
  const merged = new Map<string, CartItem>();

  for (const item of remoteItems) {
    merged.set(item.id, { ...item });
  }

  for (const item of localItems) {
    const existing = merged.get(item.id);

    if (existing) {
      merged.set(item.id, {
        ...existing,
        quantity: existing.quantity + item.quantity,
      });
      continue;
    }

    merged.set(item.id, { ...item });
  }

  return Array.from(merged.values());
};

const cartSnapshot = (items: CartItem[]) =>
  items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|');

export function AppProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [view, setView] = useState('home');
  const [accountSubView, setAccountSubView] = useState<AccountSubView>('profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventory[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSessionExpiryModalOpen, setIsSessionExpiryModalOpen] = useState(false);
  const sessionExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [isCartSyncReady, setIsCartSyncReady] = useState(false);
  const syncedCartUserIdRef = useRef<string | null>(null);
  const skipNextCartSyncRef = useRef(false);
  const initialLocalCartSnapshotRef = useRef('');

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/branches'));
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);

      if (!Array.isArray(data)) {
        console.error('Branches API returned a non-array payload:', data);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]);
    }
  }, []);

  const fetchBranchInventory = useCallback(async (branchId: number) => {
    try {
      const res = await fetch(buildApiUrl(`/api/branches/${branchId}/inventory`));
      const data = await res.json();
      setBranchInventory(Array.isArray(data) ? data : []);

      if (!Array.isArray(data)) {
        console.error('Branch inventory API returned a non-array payload:', data);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setBranchInventory([]);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearAccessToken();
    fetch(buildApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setIsLoggedIn(false);
    setUser(null);
    setCart([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    setView('home');
    setIsCartOpen(false);
    setIsCartSyncReady(false);
    syncedCartUserIdRef.current = null;
    initialLocalCartSnapshotRef.current = '';
  }, []);

  const setLoggedIn = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/auth/me');
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setIsLoggedIn(true);
      } else {
        console.error('Error fetching user profile:', data.error);
        if (res.status === 401) {
          handleLogout();
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [handleLogout]);

  const persistCartToBackend = useCallback(async (items: CartItem[]) => {
    const res = await fetchWithAuth('/api/cart', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to sync cart.');
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setIsLoggedIn(true);
      fetchUserProfile();
    }

    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart) as CartItem[];
      setCart(parsedCart);
      initialLocalCartSnapshotRef.current = cartSnapshot(parsedCart);
    }

    setIsCartHydrated(true);

    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      setSelectedBranch(JSON.parse(savedBranch));
    }

    const savedOrders = localStorage.getItem('orders');
    if (savedOrders) {
      const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      const parsed: Order[] = JSON.parse(savedOrders);
      const migrated = parsed.filter((o) => !(!o.receiptNumber && isUUID(o.id)));
      setOrders(migrated);
    }

    fetchBranches();
    // These startup loaders intentionally run once during client hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch));
      fetchBranchInventory(selectedBranch.id);
    }
  }, [fetchBranchInventory, selectedBranch]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!isCartHydrated) {
      return;
    }

    if (!user?.id) {
      syncedCartUserIdRef.current = null;
      setIsCartSyncReady(false);
      return;
    }

    if (syncedCartUserIdRef.current === user.id) {
      return;
    }

    let isCancelled = false;

    const syncCartFromBackend = async () => {
      try {
        const res = await fetchWithAuth('/api/cart');
        const payload = await res.json().catch(() => ({ items: [] }));

        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load cart.');
        }

        const remoteItems = Array.isArray(payload?.items) ? payload.items : [];
        const localSnapshot = cartSnapshot(cart);
        const initialLocalSnapshot = initialLocalCartSnapshotRef.current;
        const remoteSnapshot = cartSnapshot(remoteItems);
        const shouldMergeGuestCart =
          cart.length > 0 &&
          localSnapshot === initialLocalSnapshot &&
          localSnapshot !== remoteSnapshot;
        const nextItems = shouldMergeGuestCart
          ? mergeCartItems(cart, remoteItems)
          : remoteItems;

        if (!isCancelled) {
          syncedCartUserIdRef.current = user.id;
          skipNextCartSyncRef.current = true;
          setCart(nextItems);
          setIsCartSyncReady(true);
          initialLocalCartSnapshotRef.current = '';

          if (!areCartItemsEqual(nextItems, remoteItems)) {
            await persistCartToBackend(nextItems);
          }
        }
      } catch (error) {
        console.error('Error syncing cart from backend:', error);

        if (!isCancelled) {
          syncedCartUserIdRef.current = user.id;
          setIsCartSyncReady(true);
        }
      }
    };

    syncCartFromBackend();

    return () => {
      isCancelled = true;
    };
  }, [cart, isCartHydrated, persistCartToBackend, user?.id]);

  useEffect(() => {
    if (!user?.id || !isCartSyncReady) {
      return;
    }

    if (skipNextCartSyncRef.current) {
      skipNextCartSyncRef.current = false;
      return;
    }

    const syncCart = async () => {
      try {
        await persistCartToBackend(cart);
      } catch (error) {
        console.error('Error syncing cart to backend:', error);
      }
    };

    syncCart();
  }, [cart, isCartSyncReady, persistCartToBackend, user?.id]);

  const scheduleSessionWarning = useCallback((token: string) => {
    if (sessionExpiryTimerRef.current) clearTimeout(sessionExpiryTimerRef.current);
    try {
      const [, b64] = token.split('.');
      const { exp } = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof exp !== 'number') return;
      const delay = exp * 1000 - 2 * 60 * 1000 - Date.now();
      if (delay > 0) {
        sessionExpiryTimerRef.current = setTimeout(() => setIsSessionExpiryModalOpen(true), delay);
      } else if (Date.now() < exp * 1000) {
        setIsSessionExpiryModalOpen(true);
      }
    } catch { /* ignore JWT parse errors */ }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsSessionExpiryModalOpen(false);
      if (sessionExpiryTimerRef.current) {
        clearTimeout(sessionExpiryTimerRef.current);
        sessionExpiryTimerRef.current = null;
      }
      return;
    }
    const token = getAccessToken();
    if (token) scheduleSessionWarning(token);
  }, [isLoggedIn, scheduleSessionWarning]);

  const addToCart = useCallback((
    product: Product,
    options?: { openCart?: boolean }
  ) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    if (options?.openCart !== false) {
      setIsCartOpen(true);
    }
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isBranchOpen = useCallback((branch: Branch) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = branch.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = branch.closing_time.split(':').map(Number);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    return currentTime >= openTime && currentTime <= closeTime;
  }, []);

  const contextValue = useMemo(() => ({
    view, setView,
    accountSubView, setAccountSubView,
    isLoggedIn,
    setLoggedIn,
    logout: handleLogout,
    user, setUser,
    fetchUserProfile,
    cart, setCart,
    selectedBranch, setSelectedBranch,
    branches,
    branchInventory,
    isBranchModalOpen, setIsBranchModalOpen,
    isCartOpen, setIsCartOpen,
    selectedProduct, setSelectedProduct,
    orders, setOrders,
    selectedOrder, setSelectedOrder,
    addToCart,
    updateQuantity,
    cartTotal,
    isBranchOpen,
    searchQuery,
    setSearchQuery
  }), [
    view,
    accountSubView,
    isLoggedIn,
    setLoggedIn,
    handleLogout,
    user,
    fetchUserProfile,
    cart,
    selectedBranch,
    branches,
    branchInventory,
    isBranchModalOpen,
    isCartOpen,
    selectedProduct,
    orders,
    selectedOrder,
    addToCart,
    updateQuantity,
    cartTotal,
    isBranchOpen,
    searchQuery,
  ]);

  const handleExtendSession = useCallback(async () => {
    setIsSessionExpiryModalOpen(false);
    const newToken = await refreshAccessToken();
    if (newToken) {
      scheduleSessionWarning(newToken);
    } else {
      handleLogout();
    }
  }, [scheduleSessionWarning, handleLogout]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}

      <AnimatePresence>
        {isSessionExpiryModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-[9999] overflow-hidden"
            >
              <div className="p-7 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">⏱</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Session Expiring Soon</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-7">
                  Your session is about to expire. Stay logged in to keep shopping without interruption.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Log Out
                  </button>
                  <button
                    onClick={handleExtendSession}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    Stay Logged In
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
