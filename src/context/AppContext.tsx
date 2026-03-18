'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Branch, BranchInventory, Order, CartItem } from '../types';

interface AppContextType {
  view: string;
  setView: (view: string) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
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
  addToCart: (product: Product) => void;
  updateQuantity: (id: string, delta: number) => void;
  cartTotal: number;
  isBranchOpen: (branch: Branch) => boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }

    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      setSelectedBranch(JSON.parse(savedBranch));
    }

    const savedOrders = localStorage.getItem('orders');
    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    }

    fetchBranches();
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch));
      fetchBranchInventory(selectedBranch.id);
    }
  }, [selectedBranch]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchBranchInventory = async (branchId: number) => {
    try {
      const res = await fetch(`/api/branches/${branchId}/inventory`);
      const data = await res.json();
      setBranchInventory(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const isBranchOpen = (branch: Branch) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = branch.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = branch.closing_time.split(':').map(Number);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    return currentTime >= openTime && currentTime <= closeTime;
  };

  return (
    <AppContext.Provider value={{
      view, setView,
      isLoggedIn, setIsLoggedIn,
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
    }}>
      {children}
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
