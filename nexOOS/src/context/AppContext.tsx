'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Branch, BranchInventory, Order, CartItem, User } from '../types';
import {
  clearAccessToken,
  fetchWithAuth,
  fetchWithAuthRetry,
  getAccessToken,
} from '@/lib/auth-client';
import { buildApiUrl, fetchJsonWithRetry } from '@/lib/api';

type AccountSubView = 'profile' | 'addresses' | 'orders' | 'settings' | 'returns';

interface AppContextType {
  view: string;
  setView: (view: string) => void;
  accountSubView: AccountSubView;
  setAccountSubView: React.Dispatch<React.SetStateAction<AccountSubView>>;
  isLoggedIn: boolean;
  setLoggedIn: () => void;
  logout: () => void;
  user: User | null;
  interestMap: Map<string, number>;
  categoryInterestMap: Map<string, number>;
  trendingSearches: string[];
  setUser: (user: User | null) => void;
  fetchUserProfile: () => Promise<void>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  checkoutItemIds: string[] | null;
  setCheckoutItemIds: (ids: string[] | null) => void;
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
const INACTIVITY_WARNING_MS = 13 * 60 * 1000;
const INACTIVITY_LOGOUT_MS = 15 * 60 * 1000;
const INACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

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

const getMaxCartQuantity = (item: Pick<CartItem, 'stock'>) => {
  if (
    typeof item.stock === 'number' &&
    Number.isFinite(item.stock) &&
    item.stock > 0
  ) {
    return Math.max(1, Math.trunc(item.stock));
  }

  return null;
};

const clampCartItemQuantity = (item: CartItem) => {
  const maxQuantity = getMaxCartQuantity(item);

  return {
    ...item,
    quantity:
      maxQuantity === null
        ? Math.max(1, Math.trunc(item.quantity))
        : Math.min(Math.max(1, Math.trunc(item.quantity)), maxQuantity),
  };
};

const sanitizeCartItems = (items: CartItem[]) =>
  items
    .map((item) => clampCartItemQuantity(item))
    .filter((item) => item.quantity > 0);

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
        // Prefer the larger quantity when the same product already exists in
        // both guest and remote carts so repeated dev-mode hydration does not
        // keep inflating the count for one logical cart item.
        quantity: Math.max(existing.quantity, item.quantity),
      });
      continue;
    }

    merged.set(item.id, { ...item });
  }

  return sanitizeCartItems(Array.from(merged.values()));
};

const cartSnapshot = (items: CartItem[]) =>
  items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|');

const ORDER_ITEM_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>" +
      "<rect width='96' height='96' rx='24' fill='#e2e8f0'/>" +
      "<rect x='22' y='26' width='52' height='44' rx='14' fill='#94a3b8'/>" +
      "<circle cx='48' cy='48' r='12' fill='#f8fafc'/>" +
    "</svg>",
  );

const normalizeOrderPayload = (payload: unknown): Order[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((order, index) => {
    const row = typeof order === 'object' && order !== null
      ? (order as Record<string, unknown>)
      : {};
    const items = Array.isArray(row.items) ? row.items : [];

    return {
      id: typeof row.id === 'string' ? row.id : `order-${index}`,
      receiptNumber:
        typeof row.receiptNumber === 'string' ? row.receiptNumber : undefined,
      orderNumber:
        typeof row.orderNumber === 'string' ? row.orderNumber : undefined,
      txNo: typeof row.txNo === 'string' ? row.txNo : undefined,
      date:
        typeof row.date === 'string'
          ? row.date
          : new Date().toISOString(),
      items: items.map((item, itemIndex) => {
        const entry = typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>)
          : {};

        return {
          id:
            typeof entry.id === 'string'
              ? entry.id
              : `${typeof row.id === 'string' ? row.id : index}-item-${itemIndex}`,
          name: typeof entry.name === 'string' ? entry.name : 'Ordered item',
          description:
            typeof entry.description === 'string' ? entry.description : '',
          price: Number(entry.price ?? 0),
          category:
            typeof entry.category === 'string'
              ? entry.category
              : 'Uncategorized',
          image:
            typeof entry.image === 'string' && entry.image.trim()
              ? entry.image
              : ORDER_ITEM_PLACEHOLDER_IMAGE,
          quantity: Math.max(1, Number(entry.quantity ?? 1)),
        };
      }),
      subtotal: Number(row.subtotal ?? 0),
      deliveryFee: Number(row.deliveryFee ?? 0),
      discountAmount: Number(row.discountAmount ?? 0),
      promoCode: typeof row.promoCode === 'string' ? row.promoCode : undefined,
      total: Number(row.total ?? 0),
      status:
        row.status === 'Processing' ||
        row.status === 'In Transit' ||
        row.status === 'Delivered' ||
        row.status === 'Cancelled'
          ? row.status
          : 'Processing',
      shippingAddress:
        typeof row.shippingAddress === 'string' ? row.shippingAddress : '',
      paymentMethod:
        typeof row.paymentMethod === 'string' ? row.paymentMethod : '',
    };
  });
};

export function AppProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [view, setView] = useState('home');
  const [accountSubView, setAccountSubView] = useState<AccountSubView>('profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutItemIds, setCheckoutItemIds] = useState<string[] | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventory[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [interestMap, setInterestMap] = useState<Map<string, number>>(new Map());
  const [categoryInterestMap, setCategoryInterestMap] = useState<Map<string, number>>(new Map());
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [isSessionExpiryModalOpen, setIsSessionExpiryModalOpen] = useState(false);
  const [isInactivityLoggedOutModalOpen, setIsInactivityLoggedOutModalOpen] = useState(false);
  const inactivityWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [isCartSyncReady, setIsCartSyncReady] = useState(false);
  const syncedCartUserIdRef = useRef<string | null>(null);
  const skipNextCartSyncRef = useRef(false);
  const initialLocalCartSnapshotRef = useRef('');

  const fetchBranches = useCallback(async () => {
    try {
      const data = await fetchJsonWithRetry<unknown[]>(
        '/api/branches',
        undefined,
        { attempts: 6, initialDelayMs: 600 },
      );
      setBranches(Array.isArray(data) ? (data as Branch[]) : []);

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
      const data = await fetchJsonWithRetry<unknown[]>(
        `/api/branches/${branchId}/inventory`,
        undefined,
        { attempts: 6, initialDelayMs: 600 },
      );
      setBranchInventory(Array.isArray(data) ? (data as BranchInventory[]) : []);

      if (!Array.isArray(data)) {
        console.error('Branch inventory API returned a non-array payload:', data);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setBranchInventory([]);
    }
  }, []);

  const resetClientSession = useCallback(() => {
    clearAccessToken();
    fetch(buildApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setIsLoggedIn(false);
    setUser(null);
    setCart([]);
    setOrders([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem('remember_me');
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
      const res = await fetchWithAuthRetry('/api/auth/me', {}, { attempts: 5, initialDelayMs: 2000 });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUser(data);
        setIsLoggedIn(true);
      } else if (res.status === 401) {
        resetClientSession();
      }
      // Silently ignore 503 — backend still starting up
    } catch {
      // Network error during startup — silently ignore, user stays logged in
    }
  }, [resetClientSession]);

  const fetchCustomerOrders = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/orders/my');
      const data = await res.json().catch(() => ({ data: [] }));

      if (res.ok) {
        setOrders(normalizeOrderPayload(data?.data));
      } else {
        console.error('Error fetching customer orders:', data?.error || data);
        if (res.status === 401) {
          resetClientSession();
        }
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error);
    }
  }, [resetClientSession]);

  // Fetch trending searches once on mount — no auth needed
  useEffect(() => {
    fetch('/api/analytics/trending?limit=8')
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((payload) => {
        const items = (payload?.data ?? []) as { query: string }[];
        setTrendingSearches(items.map((item) => item.query));
      })
      .catch(() => {});
  }, []);

  // Fetch product + category interests on login, refresh every 15 minutes
  useEffect(() => {
    const fetchInterests = () => {
      const token = getAccessToken();
      if (!token || !isLoggedIn) return;

      // Product-level interests
      fetch('/api/product-interests', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.ok ? res.json() : { data: [] })
        .then((payload) => {
          const rows: { product_id: string; view_count: number }[] = payload?.data ?? [];
          const map = new Map<string, number>();
          rows.forEach((r) => map.set(r.product_id, r.view_count));
          setInterestMap(map);
        })
        .catch(() => {});

      // Category-level interests
      fetch('/api/category-interests', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.ok ? res.json() : { data: [] })
        .then((payload) => {
          const rows: { category: string; score: number }[] = payload?.data ?? [];
          const map = new Map<string, number>();
          rows.forEach((r) => map.set(r.category, r.score));
          setCategoryInterestMap(map);
        })
        .catch(() => {});
    };

    fetchInterests();
    const interval = globalThis.setInterval(fetchInterests, 15 * 60 * 1000);
    return () => globalThis.clearInterval(interval);
  }, [isLoggedIn]);

  const persistCartToBackend = useCallback(async (items: CartItem[]) => {
    const res = await fetchWithAuthRetry('/api/cart', {
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
      // 401 means token expired (e.g. inactivity logout) — silently skip, cart is in localStorage
      if (res.status === 401) return;
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to sync cart.');
    }
  }, []);

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        if (user?.id) {
          await persistCartToBackend(cart);
        }
      } catch (error) {
        console.error('Error saving cart before logout:', error);
      } finally {
        resetClientSession();
      }
    })();
  }, [cart, persistCartToBackend, resetClientSession, user?.id]);

  const clearInactivityTimers = useCallback(() => {
    if (inactivityWarningTimerRef.current) {
      clearTimeout(inactivityWarningTimerRef.current);
      inactivityWarningTimerRef.current = null;
    }

    if (inactivityLogoutTimerRef.current) {
      clearTimeout(inactivityLogoutTimerRef.current);
      inactivityLogoutTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimers = useCallback(() => {
    clearInactivityTimers();
    setIsSessionExpiryModalOpen(false);

    inactivityWarningTimerRef.current = setTimeout(() => {
      setIsSessionExpiryModalOpen(true);
    }, INACTIVITY_WARNING_MS);

    inactivityLogoutTimerRef.current = setTimeout(() => {
      setIsSessionExpiryModalOpen(false);
      handleLogout();
      setIsInactivityLoggedOutModalOpen(true);
    }, INACTIVITY_LOGOUT_MS);
  }, [clearInactivityTimers, handleLogout]);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setIsLoggedIn(true);
      fetchUserProfile();
    }

    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart) as CartItem[];
      const sanitizedCart = sanitizeCartItems(parsedCart);
      setCart(sanitizedCart);
      initialLocalCartSnapshotRef.current = cartSnapshot(sanitizedCart);
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
        const res = await fetchWithAuthRetry('/api/cart', undefined, {
          attempts: 5,
          initialDelayMs: 600,
        });
        const payload = await res.json().catch(() => ({ items: [] }));

        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load cart.');
        }

        const remoteItems = sanitizeCartItems(
          Array.isArray(payload?.items) ? payload.items : [],
        );
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
      } catch {
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
      } catch {
        // Ignore transient cart sync failures; the next cart change will retry.
      }
    };

    syncCart();
  }, [cart, isCartSyncReady, persistCartToBackend, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    fetchCustomerOrders();
  }, [fetchCustomerOrders, user?.id]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsSessionExpiryModalOpen(false);
      clearInactivityTimers();
      return;
    }

    // Skip inactivity timer when Remember Me is active
    if (localStorage.getItem('remember_me') === 'true') {
      clearInactivityTimers();
      return;
    }

    resetInactivityTimers();

    const handleUserActivity = () => {
      resetInactivityTimers();
    };

    for (const eventName of INACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    }

    return () => {
      for (const eventName of INACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleUserActivity);
      }

      clearInactivityTimers();
    };
  }, [clearInactivityTimers, isLoggedIn, resetInactivityTimers]);

  const addToCart = useCallback((
    product: Product,
    options?: { openCart?: boolean }
  ) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        const maxQuantity = getMaxCartQuantity(existingItem);
        return prev.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity:
                  maxQuantity === null
                    ? item.quantity + 1
                    : Math.min(item.quantity + 1, maxQuantity),
              }
            : item
        );
      }
      return sanitizeCartItems([...prev, { ...product, quantity: 1 }]);
    });

    if (options?.openCart !== false) {
      setIsCartOpen(true);
    }
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const maxQuantity = getMaxCartQuantity(item);
          const nextQuantity = item.quantity + delta;
          const newQuantity =
            maxQuantity === null
              ? Math.max(0, nextQuantity)
              : Math.min(Math.max(0, nextQuantity), maxQuantity);
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
    checkoutItemIds, setCheckoutItemIds,
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
    setSearchQuery,
    interestMap,
    categoryInterestMap,
    trendingSearches,
  }), [
    view,
    accountSubView,
    isLoggedIn,
    setLoggedIn,
    handleLogout,
    user,
    fetchUserProfile,
    cart,
    checkoutItemIds,
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
    interestMap,
    categoryInterestMap,
    trendingSearches,
  ]);

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
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Inactive Session</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  You&apos;ll be logged out automatically in 2 minutes if there&apos;s still no activity.
                </p>
                <p className="text-slate-500 text-xs leading-relaxed mb-7">
                  Move the mouse, scroll, tap anywhere, or press any key to keep using your account.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={resetInactivityTimers}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    I&apos;m Active
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInactivityLoggedOutModalOpen && (
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
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">🔒</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
                  You&apos;ve Been Logged Out
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-2">
                  For your security, you were automatically logged out after{' '}
                  <span className="font-semibold text-slate-700">15 minutes of inactivity</span>.
                </p>
                <p className="text-slate-400 text-xs leading-relaxed mb-7">
                  Your cart has been saved. Please log in again to continue shopping.
                </p>
                <button
                  onClick={() => setIsInactivityLoggedOutModalOpen(false)}
                  className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  OK, Log Me In
                </button>
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
