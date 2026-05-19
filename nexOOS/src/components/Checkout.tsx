'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, CreditCard, CheckCircle2, ShoppingBag, Truck, ShieldCheck, ArrowRight, X, Wallet, Banknote } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Order } from '../types';
import { fetchWithAuth } from '@/lib/auth-client';
import { buildApiUrl } from '@/lib/api';
import {
  MAX_SAVED_ADDRESSES,
  SavedAddress,
  createEmptySavedAddress,
  formatSavedAddress,
  getSavedAddressKey,
  parseSerializedAddresses,
  stringifyAddresses,
} from '@/lib/customer-addresses';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { usePhilippineLocations } from '@/hooks/usePhilippineLocations';
import { useOosSettings, isPastCutoff } from '@/hooks/useOosSettings';

const formatDeliveryAddress = (info: {
  address: string;
  city: string;
  province?: string;
  barangay?: string;
  postalCode?: string;
  formattedAddress?: string;
}) =>
  info.formattedAddress ||
  [info.address, info.barangay, info.city, info.province, info.postalCode]
    .filter(Boolean)
    .join(', ');

type DeliveryMethod = 'claim_at_branch' | 'same_day' | 'scheduled';

type DeliveryEstimate = {
  fee: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  etaLabel: string;
  matchedLocation: string;
  deliveryMethod?: DeliveryMethod;
  branchName?: string;
  distanceKm?: number;
};

type AppliedPromo = {
  id: number;
  code: string;
  description?: string | null;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  minSubtotal: number;
  maxDiscount?: number | null;
};

const getSavedAddressPrompt = (count: number) =>
  count > 0
    ? 'Pick one of your saved delivery addresses from the popup, or add a new one there.'
    : 'No saved address yet. Open the popup to add one for this order.';

const getEmptySavedAddressTitle = (count: number) =>
  count > 0 ? 'No address selected yet' : 'No saved address yet';

const getEmptySavedAddressMessage = (count: number) =>
  count > 0
    ? 'Open Choose Address to select one of your saved addresses or add a new address for this order.'
    : 'Open Choose Address to add a new address for this order.';

const getAddressPickerCopy = (view: 'list' | 'form') => ({
  eyebrow: view === 'list' ? 'Choose Address' : 'Add Address',
  title: view === 'list' ? 'Saved Addresses' : 'Add Address',
  description:
    view === 'list'
      ? 'Select an existing address for this order or add a new one.'
      : 'Fill in the delivery details and use this address for the current checkout.',
});

const getSavedAddressCountMessage = (count: number) =>
  {
    if (count <= 0) {
      return 'No saved addresses available yet';
    }

    const addressLabel = count === 1 ? 'address' : 'addresses';
    return `${count} saved ${addressLabel} available`;
  };

const getPickerChevronClass = (isOpen: boolean) =>
  `text-slate-400 text-xl transition-transform ${isOpen ? 'rotate-180' : ''}`;

const getPromoInputClassName = (status: 'idle' | 'checking' | 'valid' | 'invalid') =>
  {
    let stateClasses = 'border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-slate-200';

    if (status === 'valid') {
      stateClasses = 'border-blue-300 bg-blue-50 text-blue-700 focus:ring-2 focus:ring-blue-200';
    } else if (status === 'invalid') {
      stateClasses = 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200';
    }

    return `w-full rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition-all focus:outline-none ${stateClasses}`;
  };

const getPaymentMethodLabel = (paymentMethod: string, deliveryMethod?: string) => {
  if (paymentMethod === 'cod') {
    return deliveryMethod === 'claim_at_branch' ? 'Cash' : 'Cash on Delivery';
  }

  if (paymentMethod === 'gcash') {
    return 'GCash';
  }

  if (paymentMethod === 'maya') {
    return 'Maya';
  }

  return 'Credit / Debit Card';
};

const getPaymentMethodIcon = (paymentMethod: string) => {
  if (paymentMethod === 'cod') {
    return <Banknote className="w-5 h-5 text-blue-600" />;
  }

  if (paymentMethod === 'gcash' || paymentMethod === 'maya') {
    return <Wallet className="w-5 h-5 text-blue-600" />;
  }

  return <CreditCard className="w-5 h-5 text-blue-600" />;
};


const getDiscountTextClass = (discountAmount: number) => (discountAmount > 0 ? 'text-blue-600' : '');

const getDeliveryMethodCopy = (method: DeliveryMethod) => {
  if (method === 'claim_at_branch') {
    return {
      title: 'Claim at branch',
      description: 'Pick up your order from the branch you selected.',
    };
  }

  if (method === 'same_day') {
    return {
      title: 'Same day delivery',
      description: 'Available for Metro Manila cities and priced from your selected branch to the selected city.',
    };
  }

  return {
    title: 'Scheduled delivery',
    description: 'Best for addresses outside Metro Manila.',
  };
};

export default function Checkout() {
  const {
    cart, setCart,
    cartTotal,
    checkoutItemIds, setCheckoutItemIds,
    setView,
    logout,
    setOrders,
    setAccountSubView,
    selectedBranch,
    user,
    setUser,
    addToCart,
    updateQuantity,
  } = useAppContext();

  // Derive live from cart so quantity changes and removals reflect immediately
  const effectiveCart = checkoutItemIds
    ? cart.filter(i => checkoutItemIds.includes(i.id))
    : cart;
  const effectiveCartTotal = effectiveCart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [suggestions, setSuggestions] = useState<import('../types').Product[]>([]);
  const [addedSuggestion, setAddedSuggestion] = useState('');
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollSuggestionsLeft, setCanScrollSuggestionsLeft] = useState(false);
  const [canScrollSuggestionsRight, setCanScrollSuggestionsRight] = useState(false);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: 'Manila',
    province: '',
    barangay: '',
    postalCode: '',
    formattedAddress: '',
    placeId: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('same_day');
  const [shippingError, setShippingError] = useState('');
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [deliveryEstimateStatus, setDeliveryEstimateStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deliveryEstimateError, setDeliveryEstimateError] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [promoMessage, setPromoMessage] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [selectedSavedAddressIndex, setSelectedSavedAddressIndex] = useState<number | null>(null);
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [addressPickerView, setAddressPickerView] = useState<'list' | 'form'>('list');
  const [checkoutAddresses, setCheckoutAddresses] = useState<SavedAddress[]>(() => parseSerializedAddresses(user?.address, user));
  const [checkoutAddressForm, setCheckoutAddressForm] = useState<SavedAddress>(() => createEmptySavedAddress(user));
  const [checkoutMakeDefault, setCheckoutMakeDefault] = useState(false);
  const [isProvincePickerOpen, setIsProvincePickerOpen] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const [checkoutAddressError, setCheckoutAddressError] = useState('');

  useBodyScrollLock(isAddressPickerOpen);

  const savedAddresses = checkoutAddresses;
  const {
    provinces: provinceOptions,
    cities: cityOptions,
    provincesStatus,
    citiesStatus,
  } = usePhilippineLocations(checkoutAddressForm.province, checkoutAddressForm.city);
  const { settings: oosSettings } = useOosSettings();
  const MIN_ORDER_AMOUNT = oosSettings.min_order_amount;
  const isFreeDelivery = deliveryMethod !== 'claim_at_branch' && effectiveCartTotal >= oosSettings.free_delivery_min;
  const baseDeliveryFee = isFreeDelivery ? 0 : (deliveryEstimate?.fee ?? oosSettings.delivery_fee);
  const deliveryFee = deliveryMethod === 'claim_at_branch' ? 0 : baseDeliveryFee;
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const orderTotal = Math.max(0, effectiveCartTotal + deliveryFee - discountAmount);
  const isBelowMinOrder = effectiveCartTotal < MIN_ORDER_AMOUNT;
  const isAboveMaxItems = effectiveCart.length > oosSettings.max_order_items;
  const isPastOrderCutoff = isPastCutoff(oosSettings.order_cutoff_time);
  const savedAddressPrompt = getSavedAddressPrompt(savedAddresses.length);
  const emptySavedAddressTitle = getEmptySavedAddressTitle(savedAddresses.length);
  const emptySavedAddressMessage = getEmptySavedAddressMessage(savedAddresses.length);
  const addressPickerCopy = getAddressPickerCopy(addressPickerView);
  const savedAddressCountMessage = getSavedAddressCountMessage(savedAddresses.length);
  const promoInputClassName = getPromoInputClassName(promoStatus);
  const paymentMethodLabel = getPaymentMethodLabel(paymentMethod, deliveryMethod);

  const applySavedAddress = React.useCallback((address: SavedAddress) => {
    setShippingInfo({
      fullName: address.fullName || user?.full_name || '',
      phone: address.phoneNumber || user?.phone || '',
      address: address.streetAddress || '',
      city: address.city || 'Manila',
      province: address.province || '',
      barangay: address.barangay || '',
      postalCode: address.postalCode || '',
      formattedAddress: address.formattedAddress || formatSavedAddress(address),
      placeId: address.placeId || '',
      latitude: address.latitude,
      longitude: address.longitude,
    });
    setShippingError('');
  }, [user?.full_name, user?.phone]);

  const persistCheckoutAddresses = async (nextAddresses: SavedAddress[]) => {
    if (!user) {
      setCheckoutAddresses(nextAddresses);
      return true;
    }

    const cleanedAddressValue = stringifyAddresses(nextAddresses);
    const res = await fetchWithAuth('/api/auth/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name: user.full_name,
        phone: user.phone || null,
        birthday: user.birthday || user.dob || null,
        gender: user.gender || null,
        address: cleanedAddressValue,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setCheckoutAddressError(data.error || 'Failed to save address.');
      return false;
    }

    setUser(data);
    setCheckoutAddresses(parseSerializedAddresses(data.address, data));
    return true;
  };

  const startNewAddressEntry = () => {
    if (savedAddresses.length >= MAX_SAVED_ADDRESSES) {
      setCheckoutAddressError(`You can only save up to ${MAX_SAVED_ADDRESSES} addresses.`);
      setAddressPickerView('list');
      return;
    }

    setSelectedSavedAddressIndex(null);
    setAddressPickerView('form');
    setCheckoutAddressForm(createEmptySavedAddress(user));
    setCheckoutMakeDefault(savedAddresses.length === 0);
    setCheckoutAddressError('');
    setIsProvincePickerOpen(false);
    setIsCityPickerOpen(false);
    setShippingInfo({
      fullName: user?.full_name || '',
      phone: user?.phone || '',
      address: '',
      city: 'Manila',
      province: '',
      barangay: '',
      postalCode: '',
      formattedAddress: '',
      placeId: '',
      latitude: undefined,
      longitude: undefined,
    });
    setShippingError('');
  };

  // Fetch suggestions: try co-purchase recommendations for ALL cart items first,
  // then fall back to all unique categories across the cart
  React.useEffect(() => {
    if (cart.length === 0) return;
    const cartIds = new Set(cart.map((i) => i.id));

    const fetchAll = async () => {
      // Fetch recommendations for every cart item in parallel
      const results = await Promise.all(
        cart.map((item) =>
          fetch(`/api/products/${encodeURIComponent(item.id)}/recommendations?limit=15`)
            .then((res) => res.ok ? res.json() : { data: [] })
            .catch(() => ({ data: [] }))
        )
      );

      // Merge, deduplicate, and filter out items already in cart
      const seen = new Set<string>();
      const merged: import('../types').Product[] = [];
      for (const payload of results) {
        const recs = (payload?.data ?? []) as import('../types').Product[];
        for (const p of recs) {
          if (!cartIds.has(p.id) && !seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
      }

      if (merged.length > 0) {
        setSuggestions(merged);
        return;
      }

      // Fallback: fetch by ALL unique categories in the cart
      const categories = [...new Set(cart.map((i) => (i as any).category).filter(Boolean))];
      const qs = categories.length > 0
        ? `category=${encodeURIComponent(categories[0])}&limit=15`
        : 'limit=15';
      const fallback = await fetch(`/api/products?${qs}`)
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []);
      const fallbackRecs = (Array.isArray(fallback) ? fallback : fallback?.data ?? []) as import('../types').Product[];

      // If multiple categories, also fetch for the rest and merge
      if (categories.length > 1) {
        const extras = await Promise.all(
          categories.slice(1).map((cat) =>
            fetch(`/api/products?category=${encodeURIComponent(cat)}&limit=15`)
              .then((r) => r.ok ? r.json() : [])
              .catch(() => [])
          )
        );
        const allFallback = [...fallbackRecs];
        for (const res of extras) {
          const items = (Array.isArray(res) ? res : res?.data ?? []) as import('../types').Product[];
          allFallback.push(...items);
        }
        const seenFallback = new Set<string>();
        const dedupedFallback = allFallback.filter((p) => {
          if (cartIds.has(p.id) || seenFallback.has(p.id)) return false;
          seenFallback.add(p.id);
          return true;
        });
        setSuggestions(dedupedFallback);
        return;
      }

      setSuggestions(fallbackRecs.filter((p) => !cartIds.has(p.id)));
    };

    fetchAll().catch(() => {});
  }, [cart.length]);

  const CARD_W = 176; // card width 160 + gap 16

  React.useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const updateArrowState = () => {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      setCanScrollSuggestionsLeft(el.scrollLeft > 8);
      setCanScrollSuggestionsRight(el.scrollLeft < maxScrollLeft - 8);
    };

    el.style.scrollBehavior = 'auto';
    el.scrollLeft = 0;
    updateArrowState();

    el.addEventListener('scroll', updateArrowState, { passive: true });
    window.addEventListener('resize', updateArrowState);

    return () => {
      el.removeEventListener('scroll', updateArrowState);
      window.removeEventListener('resize', updateArrowState);
    };
  }, [suggestions]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el || suggestions.length === 0) return;
    const step = Math.max(CARD_W * 2, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === 'right' ? step : -step,
      behavior: 'smooth',
    });
  };

  React.useEffect(() => {
    const parsedAddresses = parseSerializedAddresses(user?.address, user);

    setCheckoutAddresses(parsedAddresses);
    setCheckoutAddressForm(createEmptySavedAddress(user));
    setCheckoutMakeDefault(parsedAddresses.length === 0);
    setCheckoutAddressError('');
    setAddressPickerView('list');
    setIsProvincePickerOpen(false);
    setIsCityPickerOpen(false);

    if (parsedAddresses.length > 0) {
      setSelectedSavedAddressIndex(0);
      applySavedAddress(parsedAddresses[0]);
      return;
    }

    setSelectedSavedAddressIndex(null);
    setShippingInfo((prev) => ({
      ...prev,
      fullName: user?.full_name || prev.fullName,
      phone: user?.phone || prev.phone,
    }));
  }, [applySavedAddress, user, user?.address, user?.full_name, user?.phone]);

  React.useEffect(() => {
    const address = shippingInfo.address.trim();
    const city = shippingInfo.city.trim();
    const province = shippingInfo.province.trim();

    if (deliveryMethod !== 'claim_at_branch' && (!address || !city || !province)) {
      setDeliveryEstimate(null);
      setDeliveryEstimateStatus('idle');
      setDeliveryEstimateError('');
      return;
    }

    let cancelled = false;

    setDeliveryEstimateStatus('loading');
    setDeliveryEstimateError('');

    const timeoutId = globalThis.setTimeout(async () => {
      try {
        const res = await fetch(buildApiUrl('/api/delivery/estimate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            city,
            province,
            barangay: shippingInfo.barangay,
            latitude: shippingInfo.latitude,
            longitude: shippingInfo.longitude,
            placeId: shippingInfo.placeId,
            branchId: selectedBranch?.id,
            deliveryMethod,
          }),
        });

        const data = await res.json();

        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setDeliveryEstimate(null);
          setDeliveryEstimateStatus('error');
          setDeliveryEstimateError(data.error || 'Unable to estimate delivery for this address.');
          return;
        }

        setDeliveryEstimate(data.estimate);
        setDeliveryEstimateStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Delivery estimate request failed:', error);
        setDeliveryEstimate(null);
        setDeliveryEstimateStatus('error');
        setDeliveryEstimateError('Unable to estimate delivery for this address.');
      }
    }, 300);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [
    deliveryMethod,
    selectedBranch?.id,
    shippingInfo.address,
    shippingInfo.barangay,
    shippingInfo.city,
    shippingInfo.latitude,
    shippingInfo.longitude,
    shippingInfo.placeId,
    shippingInfo.province,
  ]);

  React.useEffect(() => {
    const trimmedCode = promoCodeInput.trim();

    if (!trimmedCode) {
      setPromoStatus('idle');
      setPromoMessage('');
      setAppliedPromo(null);
      return;
    }

    let cancelled = false;

    setPromoStatus('checking');
    setPromoMessage('');

    const timeoutId = globalThis.setTimeout(async () => {
      try {
        const res = await fetch(buildApiUrl('/api/promos/validate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: trimmedCode,
            subtotal: cartTotal,
          }),
        });

        const data = await res.json();

        if (cancelled) {
          return;
        }

        if (!res.ok || !data.valid) {
          setPromoStatus('invalid');
          setPromoMessage(data.reason || data.error || 'Promo code is invalid.');
          setAppliedPromo(null);
          return;
        }

        setPromoStatus('valid');
        setPromoMessage(data.message || 'Promo code applied.');
        setAppliedPromo(data.promo);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Promo validation request failed:', error);
        setPromoStatus('invalid');
        setPromoMessage('Unable to validate promo code right now.');
        setAppliedPromo(null);
      }
    }, 350);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [promoCodeInput, effectiveCartTotal]);

  const isOnlinePayment = paymentMethod === 'gcash' || paymentMethod === 'maya' || paymentMethod === 'card';

  const buildOrderPayload = (shippingAddress: string, paymentMethodLabel: string) => ({
    shippingAddress,
    deliveryFee,
    deliveryMethod,
    branchId: selectedBranch?.id,
    promoCode: appliedPromo?.code || '',
    paymentMethod: paymentMethodLabel,
    items: effectiveCart.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      quantity: item.quantity,
    })),
  });

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      const paymentMethodLabel = getPaymentMethodLabel(paymentMethod, deliveryMethod);
      const shippingAddress = deliveryMethod === 'claim_at_branch' && selectedBranch
        ? `Pickup at ${selectedBranch.name}, ${selectedBranch.address}`
        : formatDeliveryAddress(shippingInfo);

      const orderPayload = buildOrderPayload(shippingAddress, paymentMethodLabel);

      // ── Online payment (GCash / Maya / Card) ────────────────────────────────
      if (isOnlinePayment) {
        const res = await fetchWithAuth('/api/orders/payment/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyRef.current,
          },
          body: JSON.stringify(orderPayload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to initiate payment');
        }

        // Reset idempotency key so a retry gets a fresh key
        idempotencyKeyRef.current = crypto.randomUUID();

        // Clear ordered items synchronously before navigating away. The localStorage
        // effect is async and won't flush before the page redirect, so we write directly.
        const remainingItems = cart.filter(i => !effectiveCart.some(e => e.id === i.id));
        setCart(remainingItems);
        setCheckoutItemIds(null);
        localStorage.setItem('cart', JSON.stringify(remainingItems));

        // Redirect browser to PayMongo hosted checkout — page will navigate away
        window.location.href = data.checkoutUrl;
        return;
      }

      // ── Cash on Delivery ─────────────────────────────────────────────────────
      const res = await fetchWithAuth('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      const newOrder: Order = {
        id: data.order.id,
        receiptNumber: data.order.receiptNumber,
        orderNumber: data.order.orderNumber,
        txNo: data.order.txNo,
        date: data.order.date,
        items: effectiveCart.map((item) => ({ ...item })),
        subtotal: Number(data.order.subtotal ?? effectiveCartTotal),
        deliveryFee: Number(data.order.deliveryFee ?? deliveryFee),
        discountAmount: Number(data.order.discountAmount ?? discountAmount),
        promoCode: data.order.promoCode || appliedPromo?.code,
        total: Number(data.order.total ?? orderTotal),
        status: 'Processing',
        shippingAddress,
        paymentMethod: paymentMethodLabel,
      };

      setOrders((prev) => [newOrder, ...prev]);
      setCart(cart.filter(i => !effectiveCart.some(e => e.id === i.id)));
      setCheckoutItemIds(null);
      idempotencyKeyRef.current = crypto.randomUUID();
      setView('success');
    } catch (error) {
      console.error('Place order failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to place order.';
      if (message === 'Unauthorized' || message === 'Invalid or expired token') {
        alert('Your session has expired. Please log in again.');
        logout();
        setView('login');
      } else {
        alert(message);
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200">
          <ShoppingBag className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Your cart is empty</h2>
        <p className="text-slate-500 mb-8 max-w-xs mx-auto">Add some items to your cart before checking out.</p>
        <button 
          onClick={() => setView('shop')}
          className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
        >
          Go to Shop
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-slate-50 py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Checkout Header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => setView('shop')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Shop
          </button>
          <div className="flex items-center gap-3">
            {[
              { step: 1, label: 'Cart' },
              { step: 2, label: 'Shipping' },
              { step: 3, label: 'Payment' },
              { step: 4, label: 'Review' },
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    checkoutStep >= step ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {step}
                  </div>
                  <span className={`text-[10px] font-bold hidden sm:block ${checkoutStep >= step ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                </div>
                {step < 4 && <div className={`w-6 h-0.5 rounded-full mb-4 ${checkoutStep > step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <AnimatePresence mode="wait">

              {/* ── NEW STEP 1: Order Summary ── */}
              {checkoutStep === 1 && (
                <motion.div
                  key="step-summary"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Cart items */}
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Your Cart</h2>
                    <div className="space-y-4">
                      {effectiveCart.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50">
                          <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 text-sm line-clamp-2">{item.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>
                            <p className="font-black text-slate-900 mt-1">₱{(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors"
                            >−</button>
                            <span className="w-8 text-center font-black text-slate-900">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, +1)}
                              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 font-bold transition-colors"
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Subtotal</span>
                      <span className="text-xl font-black text-slate-900">₱{effectiveCartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Suggestions carousel */}
                  {suggestions.length > 0 && (
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">You Might Also Need</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-medium">{suggestions.length} items</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => scrollCarousel('left')}
                              aria-label="Scroll suggestions left"
                              disabled={!canScrollSuggestionsLeft}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-white"
                            >
                              <ChevronLeft className="h-4 w-4 shrink-0" />
                            </button>
                            <button
                              onClick={() => scrollCarousel('right')}
                              aria-label="Scroll suggestions right"
                              disabled={!canScrollSuggestionsRight}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-white"
                            >
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mb-5">Customers who bought your items also bought these.</p>
                      <div ref={carouselRef} className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar">
                        {suggestions.map((product) => (
                          <div key={product.id} className="shrink-0 w-40 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 flex flex-col">
                            <img src={product.image} alt={product.name} className="w-full h-36 object-cover" referrerPolicy="no-referrer" />
                            <div className="p-3 flex flex-col flex-1">
                              <p className="text-xs font-bold text-slate-900 line-clamp-2 flex-1">{product.name}</p>
                              <p className="text-xs font-black text-slate-700 mt-1">₱{product.price.toFixed(2)}</p>
                              <button
                                onClick={() => {
                                  addToCart(product, { openCart: false });
                                  setAddedSuggestion(product.id);
                                  setTimeout(() => setAddedSuggestion(''), 1500);
                                }}
                                className={`mt-2 w-full py-1.5 rounded-xl text-xs font-black transition-colors ${
                                  addedSuggestion === product.id
                                    ? 'bg-green-500 text-white'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {addedSuggestion === product.id ? '✓ Added' : '+ Add'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continue button */}
                  <button
                    onClick={() => setCheckoutStep(2)}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    Continue to Shipping →
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2: Shipping (was step 1) ── */}
              {checkoutStep === 2 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-100 p-3 rounded-2xl">
                      <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shipping Information</h2>
                  </div>
                  
                  <div className="mb-8 rounded-[2.25rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6">
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Delivery Method</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {([
                        'claim_at_branch',
                        'same_day',
                        'scheduled',
                      ] as const).map((method) => {
                        const copy = getDeliveryMethodCopy(method);
                        const isSelected = deliveryMethod === method;

                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              setDeliveryMethod(method);
                              setShippingError('');
                            }}
                            className={`rounded-[1.75rem] border p-4 text-left transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                              {method.replaceAll('_', ' ')}
                            </p>
                            <p className="mt-3 text-lg font-black text-slate-900">{copy.title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">{copy.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    {selectedBranch && (
                      <p className="mt-4 text-sm font-medium text-slate-500">
                        Fulfillment branch: <span className="font-black text-slate-900">{selectedBranch.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="mb-8 rounded-[2.25rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Saved Addresses</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {deliveryMethod === 'claim_at_branch'
                            ? 'Pickup is free. You can still save an address for contact details and future deliveries.'
                            : savedAddressPrompt}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddressPickerOpen(true)}
                        className="inline-flex shrink-0 items-center justify-center self-start rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        Choose Address
                      </button>
                    </div>

                    {selectedSavedAddressIndex !== null && savedAddresses[selectedSavedAddressIndex] ? (
                      <div className="mt-5 rounded-[2rem] border border-blue-200 bg-white p-5 shadow-md shadow-blue-100/70">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Selected Address</p>
                            <p className="mt-3 text-2xl font-black text-slate-900">{shippingInfo.fullName || 'Receiver name'}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500">{shippingInfo.phone || 'Add a phone number'}</p>
                            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                              {formatDeliveryAddress(shippingInfo) || 'Choose an address to continue.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
                              {savedAddresses[selectedSavedAddressIndex].label}
                            </span>
                            {selectedSavedAddressIndex === 0 && (
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-[2rem] border border-dashed border-slate-300 bg-slate-50/80 p-6">
                        <div className="flex items-start gap-4">
                          <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
                            <MapPin className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900">{emptySavedAddressTitle}</p>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{emptySavedAddressMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedSavedAddressIndex !== null && shippingError && (
                    <p className="mt-4 text-sm font-bold text-red-600">{shippingError}</p>
                  )}
                  {deliveryEstimateStatus === 'loading' && (
                    <p className="mt-4 text-sm font-bold text-slate-500">
                      {deliveryMethod === 'claim_at_branch'
                        ? 'Preparing free pickup details...'
                        : 'Checking delivery fee for this address...'}
                    </p>
                  )}
                  {deliveryEstimateStatus === 'ready' && deliveryEstimate && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <p className="font-black">Delivery fee: ₱{deliveryEstimate.fee.toFixed(2)}</p>
                      <p className="mt-1 font-medium">ETA: {deliveryEstimate.etaLabel}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-600">Matched area: {deliveryEstimate.matchedLocation}</p>
                      {typeof deliveryEstimate.distanceKm === 'number' && (
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-600">
                          Branch distance: {deliveryEstimate.distanceKm.toFixed(2)} km
                        </p>
                      )}
                    </div>
                  )}
                  {deliveryEstimateStatus === 'error' && deliveryEstimateError && (
                    <p className="mt-4 text-sm font-bold text-red-600">{deliveryEstimateError}</p>
                  )}
                   
                  {isBelowMinOrder && (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                      Minimum order is ₱{MIN_ORDER_AMOUNT.toFixed(2)}. Add ₱{(MIN_ORDER_AMOUNT - cartTotal).toFixed(2)} more to continue.
                    </div>
                  )}

                  <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(1)}
                    className="flex-1 mt-10 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
                  >
                    ← Back to Cart
                  </button>
                  <button
                    onClick={() => {
                      const normalizedPhone = normalizePhilippinePhone(shippingInfo.phone);

                      if (!normalizedPhone) {
                        setShippingError(PH_PHONE_MESSAGE);
                        return;
                      }

                      if (!deliveryEstimate) {
                        setShippingError(deliveryEstimateError || 'Choose a deliverable address before continuing.');
                        return;
                      }

                      setShippingInfo((prev) => ({ ...prev, phone: normalizedPhone }));
                      setShippingError('');
                      setCheckoutStep(3);
                    }}
                    disabled={selectedSavedAddressIndex === null || !deliveryEstimate || isBelowMinOrder || !selectedBranch}
                    className="flex-1 mt-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    Continue to Payment
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  </div>

                  <AnimatePresence>
                    {isAddressPickerOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsAddressPickerOpen(false)}
                          className="fixed inset-0 z-50 bg-slate-900/35"
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.97, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97, y: 20 }}
                          className="fixed left-1/2 top-1/2 z-[51] max-h-[calc(100vh-2rem)] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_32px_90px_rgba(15,23,42,0.22)] sm:p-8"
                        >
                          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{addressPickerCopy.eyebrow}</p>
                              <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{addressPickerCopy.title}</h3>
                              <p className="mt-2 text-sm text-slate-500">{addressPickerCopy.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddressPickerOpen(false);
                                setAddressPickerView('list');
                                setCheckoutAddressError('');
                                setIsProvincePickerOpen(false);
                                setIsCityPickerOpen(false);
                              }}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                              aria-label="Close address picker"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>

                          {addressPickerView === 'list' ? (
                            <>
                              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-slate-500">{savedAddressCountMessage}</p>
                                <button
                                  type="button"
                                  onClick={startNewAddressEntry}
                                  disabled={savedAddresses.length >= MAX_SAVED_ADDRESSES}
                                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  Add New Address
                                </button>
                              </div>

                              {savedAddresses.length >= MAX_SAVED_ADDRESSES && (
                                <p className="text-sm font-bold text-slate-500">You can only save up to 4 addresses.</p>
                              )}

                              {savedAddresses.length > 0 ? (
                                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                  {savedAddresses.map((address, index) => {
                                    const isSelected = selectedSavedAddressIndex === index;
                                    const isDefault = index === 0;

                                    return (
                                      <button
                                        key={`modal-${getSavedAddressKey(address)}`}
                                        type="button"
                                        onClick={() => {
                                          setSelectedSavedAddressIndex(index);
                                          applySavedAddress(address);
                                          setIsAddressPickerOpen(false);
                                          setAddressPickerView('list');
                                        }}
                                        className={`rounded-[2rem] border p-5 text-left transition-all ${
                                          isSelected
                                            ? 'border-blue-500 bg-blue-50/80 shadow-lg shadow-blue-100'
                                            : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/60'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-lg font-black text-slate-900">{address.fullName || user?.full_name || 'Saved Address'}</p>
                                            <p className="mt-1 text-sm font-medium text-slate-500">{address.phoneNumber || user?.phone || 'No phone number'}</p>
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
                                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                              {address.label}
                                            </span>
                                            {isDefault && (
                                              <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
                                                Default
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-6 text-slate-600">
                                          {formatSavedAddress(address) || 'Address details not available yet.'}
                                        </p>
                                        {address.postalCode && (
                                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                            ZIP Code {address.postalCode}
                                          </p>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-slate-50/80 p-6">
                                  <div className="flex items-start gap-4">
                                    <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
                                      <MapPin className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-lg font-black text-slate-900">No saved address yet</p>
                                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                                        Create a new shipping address for this order, then continue to payment once the details are complete.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="mt-6">
                              <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                  <label htmlFor="checkout-address-full-name" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Full Name</label>
                                  <input
                                    id="checkout-address-full-name"
                                    type="text"
                                    value={checkoutAddressForm.fullName}
                                    onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                    className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                  />
                                </div>
                                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                  <label htmlFor="checkout-address-phone" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Phone Number</label>
                                  <input
                                    id="checkout-address-phone"
                                    type="text"
                                    value={checkoutAddressForm.phoneNumber}
                                    onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                                    placeholder="09123456789 or +639123456789"
                                    className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                                <div className="relative">
                                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                    <label htmlFor="checkout-address-province" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Province</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsProvincePickerOpen((prev) => !prev);
                                        setIsCityPickerOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 text-left"
                                    >
                                        <input
                                          id="checkout-address-province"
                                          type="text"
                                        readOnly
                                        value={checkoutAddressForm.province}
                                        placeholder="Select province"
                                        className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                                      />
                                      <ChevronDown className={`${getPickerChevronClass(isProvincePickerOpen)} h-5 w-5 shrink-0`} />
                                    </button>
                                  </div>

                                  {isProvincePickerOpen && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                                      {provincesStatus === 'loading' && (
                                        <div className="px-3 py-2 text-sm text-slate-400">Loading provinces...</div>
                                      )}
                                      {provinceOptions.map((province) => (
                                        <button
                                          key={province}
                                          type="button"
                                          onClick={() => {
                                            setCheckoutAddressForm((prev) => ({
                                              ...prev,
                                              province,
                                              city: prev.province === province ? prev.city : '',
                                              barangay: '',
                                              formattedAddress: '',
                                              placeId: '',
                                              latitude: undefined,
                                              longitude: undefined,
                                            }));
                                            setIsProvincePickerOpen(false);
                                            setCheckoutAddressError('');
                                          }}
                                          className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${checkoutAddressForm.province === province ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'}`}
                                        >
                                          {province}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="relative">
                                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                    <label htmlFor="checkout-address-city" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">City</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCityPickerOpen((prev) => !prev);
                                        setIsProvincePickerOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 text-left"
                                    >
                                        <input
                                          id="checkout-address-city"
                                          type="text"
                                        readOnly
                                        value={checkoutAddressForm.city}
                                        placeholder="Select city"
                                        className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                                      />
                                      <ChevronDown className={`${getPickerChevronClass(isCityPickerOpen)} h-5 w-5 shrink-0`} />
                                    </button>
                                  </div>

                                  {isCityPickerOpen && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                                      {!checkoutAddressForm.province && (
                                        <div className="px-3 py-2 text-sm text-slate-400">Select a province first.</div>
                                      )}
                                      {checkoutAddressForm.province && citiesStatus === 'loading' && (
                                        <div className="px-3 py-2 text-sm text-slate-400">Loading cities...</div>
                                      )}
                                      {checkoutAddressForm.province && citiesStatus !== 'loading' && cityOptions.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-slate-400">No cities found for this province.</div>
                                      )}
                                      {cityOptions.map((city) => (
                                        <button
                                          key={city}
                                          type="button"
                                          onClick={() => {
                                            setCheckoutAddressForm((prev) => ({
                                              ...prev,
                                              city,
                                              barangay: '',
                                              formattedAddress: '',
                                              placeId: '',
                                              latitude: undefined,
                                              longitude: undefined,
                                            }));
                                            setIsCityPickerOpen(false);
                                            setCheckoutAddressError('');
                                          }}
                                          className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${checkoutAddressForm.city === city ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'}`}
                                        >
                                          {city}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="relative mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                <label htmlFor="checkout-address-postal-code" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Postal Code</label>
                                <input
                                  id="checkout-address-postal-code"
                                  type="text"
                                  value={checkoutAddressForm.postalCode}
                                  onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                                  className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                />
                              </div>

                              <div className="relative mb-8 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-blue-100">
                                <label htmlFor="checkout-address-street" className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Street Name, Building, House No.</label>
                                <textarea
                                  id="checkout-address-street"
                                  rows={4}
                                  value={checkoutAddressForm.streetAddress}
                                  onChange={(e) =>
                                    setCheckoutAddressForm((prev) => ({
                                      ...prev,
                                      streetAddress: e.target.value,
                                      formattedAddress: '',
                                      placeId: '',
                                      latitude: undefined,
                                      longitude: undefined,
                                    }))
                                  }
                                  className="w-full resize-none bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                />
                                <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                  Street details are used as delivery notes. Same day pricing is based on your selected city and branch.
                                </p>
                              </div>

                              <label htmlFor="checkout-address-default" className="mb-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-700 transition-colors hover:border-slate-300 hover:bg-white">
                                <input
                                  id="checkout-address-default"
                                  type="checkbox"
                                  aria-label="Make this my default address"
                                  checked={checkoutMakeDefault}
                                  onChange={(e) => setCheckoutMakeDefault(e.target.checked)}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                                />
                                <span>
                                  <span className="block text-sm font-bold text-slate-800">Make this my default address</span>
                                  <span className="block text-sm text-slate-500">This address will be selected first during checkout.</span>
                                </span>
                              </label>

                              {checkoutAddressError && (
                                <p className="mb-6 text-sm font-bold text-red-600">{checkoutAddressError}</p>
                              )}

                              <div className="flex flex-col gap-6 border-t border-slate-100 pt-6 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Label As</p>
                                  <div className="flex gap-3">
                                    {(['Home', 'Work'] as const).map((label) => (
                                      <button
                                        key={label}
                                        type="button"
                                        onClick={() => setCheckoutAddressForm((prev) => ({ ...prev, label }))}
                                        className={`rounded-2xl px-6 py-3 text-base font-bold transition-all sm:text-lg ${
                                          checkoutAddressForm.label === label
                                            ? 'border border-blue-500 bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                                            : 'border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:gap-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddressPickerView('list');
                                      setCheckoutAddressError('');
                                      setIsProvincePickerOpen(false);
                                      setIsCityPickerOpen(false);
                                    }}
                                    className="rounded-2xl border border-slate-200 px-6 py-3 text-base font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:text-lg"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const normalizedPhone = normalizePhilippinePhone(checkoutAddressForm.phoneNumber);

                                      if (!checkoutAddressForm.fullName.trim() || !normalizedPhone || !checkoutAddressForm.province.trim() || !checkoutAddressForm.city.trim() || !checkoutAddressForm.streetAddress.trim()) {
                                        setCheckoutAddressError(
                                          !normalizedPhone && checkoutAddressForm.phoneNumber.trim()
                                            ? PH_PHONE_MESSAGE
                                            : 'Please complete Full Name, Phone Number, Province, City, and Street Address before saving.'
                                        );
                                        return;
                                      }

                                      const preparedAddress: SavedAddress = {
                                        ...checkoutAddressForm,
                                        phoneNumber: normalizedPhone,
                                      };

                                      let nextAddresses = [...savedAddresses, preparedAddress];
                                      let nextSelectedIndex = nextAddresses.length - 1;

                                      if (nextAddresses.length > MAX_SAVED_ADDRESSES) {
                                        setCheckoutAddressError(`You can only save up to ${MAX_SAVED_ADDRESSES} addresses.`);
                                        return;
                                      }

                                      if (checkoutMakeDefault) {
                                        nextAddresses = [preparedAddress, ...savedAddresses];
                                        nextSelectedIndex = 0;
                                      }

                                      const success = await persistCheckoutAddresses(nextAddresses);

                                      if (!success) {
                                        return;
                                      }

                                      setSelectedSavedAddressIndex(nextSelectedIndex);
                                      applySavedAddress(preparedAddress);
                                      setAddressPickerView('list');
                                      setIsAddressPickerOpen(false);
                                      setCheckoutAddressForm(createEmptySavedAddress(user));
                                      setCheckoutMakeDefault(false);
                                      setCheckoutAddressError('');
                                      setIsProvincePickerOpen(false);
                                      setIsCityPickerOpen(false);
                                    }}
                                    className="rounded-2xl bg-orange-500 px-8 py-3 text-base font-bold text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-600 sm:text-lg"
                                  >
                                    Submit
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {checkoutStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Wallet className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-slate-900">Payment Method</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[
                      { id: 'card', name: 'Credit / Debit Card', desc: 'Pay securely with card', icon: <CreditCard className="w-5 h-5 text-slate-500" /> },
                      { id: 'cod', name: deliveryMethod === 'claim_at_branch' ? 'Cash' : 'Cash on Delivery', desc: deliveryMethod === 'claim_at_branch' ? 'Pay at the branch' : 'Pay when you receive', icon: <Banknote className="w-5 h-5 text-slate-500" /> },
                      { id: 'gcash', name: 'GCash', desc: 'Pay via GCash', icon: <Wallet className="w-5 h-5 text-blue-600" /> },
                      { id: 'maya', name: 'Maya', desc: 'Pay via Maya', icon: <Wallet className="w-5 h-5 text-blue-600" /> }
                    ].map(method => (
                      <button
                        type="button"
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`w-full p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 text-left ${
                          paymentMethod === method.id 
                            ? 'border-blue-500 bg-blue-50/30' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          paymentMethod === method.id ? 'border-blue-600' : 'border-slate-300'
                        }`}>
                          {paymentMethod === method.id && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                        </div>
                        <div className="flex items-center gap-3">
                          {method.icon}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{method.name}</p>
                            <p className="text-xs text-slate-500">{method.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {isOnlinePayment && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 overflow-hidden"
                    >
                      <p className="text-sm text-slate-500 text-center">
                        You will be redirected to a secure payment page to complete your payment.
                      </p>
                    </motion.div>
                  )}

                  {paymentMethod === 'maya' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 overflow-hidden mt-6"
                    />
                  )}
                  
                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setCheckoutStep(2)}
                      className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-base hover:bg-slate-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCheckoutStep(4)}
                      disabled={false}
                      className="flex-[2] py-3.5 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Review Order
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-100 p-3 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Review & Confirm</h2>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                          {deliveryMethod === 'claim_at_branch' ? 'Pickup Contact' : 'Shipping To'}
                        </h3>
                        <p className="font-black text-slate-900 mb-1">{shippingInfo.fullName}</p>
                        <p className="text-sm text-slate-600 mb-1">{shippingInfo.phone}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {deliveryMethod === 'claim_at_branch' && selectedBranch
                            ? `${selectedBranch.name}, ${selectedBranch.address}`
                            : formatDeliveryAddress(shippingInfo) || 'Address will be confirmed during checkout.'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Payment Method</h3>
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                            {getPaymentMethodIcon(paymentMethod)}
                          </div>
                          <p className="font-black text-slate-900">{paymentMethodLabel}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Delivery Method</h3>
                      <p className="font-black text-slate-900">{getDeliveryMethodCopy(deliveryMethod).title}</p>
                      <p className="mt-2 text-sm text-slate-600">{getDeliveryMethodCopy(deliveryMethod).description}</p>
                    </div>
                    {deliveryEstimate && (
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Delivery Estimate</h3>
                        <p className="font-black text-slate-900 mb-1">₱{deliveryEstimate.fee.toFixed(2)}</p>
                        <p className="text-sm text-slate-600 mb-1">ETA: {deliveryEstimate.etaLabel}</p>
                        <p className="text-sm text-slate-600">{deliveryEstimate.matchedLocation}</p>
                        {typeof deliveryEstimate.distanceKm === 'number' && (
                          <p className="text-sm text-slate-600 mt-1">Branch distance: {deliveryEstimate.distanceKm.toFixed(2)} km</p>
                        )}
                      </div>
                    )}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Promo Code</h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value)}
                          placeholder="Enter code like Happy50"
                          className={promoInputClassName}
                        />
                        {promoStatus === 'checking' && (
                          <p className="text-sm font-bold text-slate-500">Checking promo code...</p>
                        )}
                        {promoStatus === 'valid' && (
                          <p className="text-sm font-bold text-blue-600">{promoMessage}</p>
                        )}
                        {promoStatus === 'invalid' && (
                          <p className="text-sm font-bold text-red-600">{promoMessage}</p>
                        )}
                        {appliedPromo?.description && promoStatus === 'valid' && (
                          <p className="text-xs font-medium leading-relaxed text-slate-500">{appliedPromo.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Order Summary</h3>
                      <div className="space-y-4">
                        {effectiveCart.map(item => (
                          <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100">
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <p className="font-bold text-slate-900 line-clamp-1">{item.name}</p>
                              <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-black text-slate-900">₱{(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-10">
                    <button 
                      onClick={() => setCheckoutStep(3)}
                      className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isPlacingOrder || isBelowMinOrder || isAboveMaxItems}
                      className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isPlacingOrder
                        ? (isOnlinePayment ? 'Redirecting to payment…' : 'Placing Order…')
                        : isOnlinePayment
                          ? `Pay ₱${orderTotal.toFixed(2)} Online`
                          : `Place Order (₱${orderTotal.toFixed(2)})`}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1 lg:self-start">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-32">
              <h2 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-wider">Order Summary</h2>

              <div className="mb-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Promo Code</p>
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Enter code like Happy50"
                    className={promoInputClassName}
                  />
                  {promoStatus === 'checking' && (
                    <p className="text-sm font-bold text-slate-500">Checking promo code...</p>
                  )}
                  {promoStatus === 'valid' && (
                    <p className="text-sm font-bold text-blue-600">{promoMessage}</p>
                  )}
                  {promoStatus === 'invalid' && (
                    <p className="text-sm font-bold text-red-600">{promoMessage}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Subtotal</span>
                  <span className="font-black">₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Delivery</span>
                  <span className="font-black">₱{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Discount</span>
                  <span className={`font-black ${getDiscountTextClass(discountAmount)}`}>
                    -₱{discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                  <span className="text-slate-900 font-black">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-slate-900 tracking-tight">₱{orderTotal.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">VAT Included</p>
                  </div>
                </div>
              </div>
              
              {/* Notices */}
              <div className="space-y-2 mb-4">
                {isBelowMinOrder && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                    ⚠️ Minimum order is ₱{MIN_ORDER_AMOUNT.toFixed(2)} — add ₱{(MIN_ORDER_AMOUNT - cartTotal).toFixed(2)} more to continue.
                  </div>
                )}
                {isAboveMaxItems && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                    ⚠️ Max {oosSettings.max_order_items} different products per order. Please remove {effectiveCart.length - oosSettings.max_order_items} item type(s).
                  </div>
                )}
                {isPastOrderCutoff && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                    🕒 Order cutoff is {oosSettings.order_cutoff_time}. Your order will be queued for tomorrow.
                  </div>
                )}
                {isFreeDelivery && deliveryMethod !== 'claim_at_branch' && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-bold text-green-700">
                    🎉 Your order qualifies for <span className="font-black">free delivery!</span>
                  </div>
                )}
                {!isFreeDelivery && deliveryMethod !== 'claim_at_branch' && oosSettings.free_delivery_min > cartTotal && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    Add <span className="font-black">₱{(oosSettings.free_delivery_min - cartTotal).toFixed(2)}</span> more for free delivery.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 p-4 rounded-2xl">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="font-medium leading-relaxed">Secure payment processed by PharmaQuick. Your data is protected.</p>
                </div>
                {selectedBranch && (
                  <div className="flex items-center gap-3 text-xs text-slate-500 bg-blue-50 p-4 rounded-2xl">
                    <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                    <p className="font-medium leading-relaxed">
                      {deliveryMethod === 'claim_at_branch'
                        ? <>Pickup branch: <span className="font-black text-blue-700">{selectedBranch.name}</span>. <span className="font-black text-blue-700">{deliveryEstimate?.etaLabel || 'Preparing pickup details'}</span>.</>
                        : <>Delivering from <span className="font-black text-blue-700">{selectedBranch.name}</span>. Estimated time: <span className="font-black text-blue-700">{deliveryEstimate?.etaLabel || 'Waiting for address'}</span>.</>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

