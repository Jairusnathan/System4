'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, MapPin, CreditCard, CheckCircle2, ShoppingBag, Truck, ShieldCheck, ArrowRight, X, Wallet, Banknote } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Order } from '../types';
import { fetchWithAuth } from '@/lib/auth-client';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const ADDRESS_STORAGE_PREFIX = '__addresses_json__:';

type SavedAddress = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  label: 'Home' | 'Work';
};

const parseSavedAddresses = (
  address?: string,
  user?: { full_name?: string; phone?: string } | null
): SavedAddress[] => {
  if (!address) {
    return [];
  }

  if (address.startsWith(ADDRESS_STORAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(address.slice(ADDRESS_STORAGE_PREFIX.length));
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => {
          const legacyLocation = typeof entry?.location === 'string' ? entry.location : '';
          const [legacyProvince = '', legacyCity = ''] = legacyLocation.split(',').map((item: string) => item.trim());

          return {
            fullName: entry?.fullName || user?.full_name || '',
            phoneNumber: entry?.phoneNumber || user?.phone || '',
            province: entry?.province || entry?.region || legacyProvince,
            city: entry?.city || legacyCity,
            postalCode: entry?.postalCode || '',
            streetAddress: entry?.streetAddress || '',
            label: entry?.label === 'Work' ? 'Work' : 'Home',
          };
        });
      }
    } catch (error) {
      console.error('Failed to parse saved addresses:', error);
    }
  }

  return address
    ? [
        {
          fullName: user?.full_name || '',
          phoneNumber: user?.phone || '',
          province: '',
          city: '',
          postalCode: '',
          streetAddress: address,
          label: 'Home',
        },
      ]
    : [];
};

const formatSavedAddress = (address: SavedAddress) =>
  [address.streetAddress, address.city, address.province].filter(Boolean).join(', ');

const stringifyAddresses = (addresses: SavedAddress[]) =>
  `${ADDRESS_STORAGE_PREFIX}${JSON.stringify(addresses)}`;

const formatDeliveryAddress = (info: {
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
}) =>
  [info.address, info.city, info.province, info.postalCode].filter(Boolean).join(', ');

type DeliveryEstimate = {
  fee: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  etaLabel: string;
  matchedLocation: string;
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

const MAX_SAVED_ADDRESSES = 4;

const createEmptyCheckoutAddress = (user?: { full_name?: string; phone?: string } | null): SavedAddress => ({
  fullName: user?.full_name || '',
  phoneNumber: user?.phone || '',
  province: '',
  city: '',
  postalCode: '',
  streetAddress: '',
  label: 'Home',
});

const PROVINCE_OPTIONS = [
  'Abra',
  'Agusan Del Norte',
  'Agusan Del Sur',
  'Aklan',
  'Albay',
  'Antique',
  'Apayao',
  'Aurora',
  'Basilan',
  'Bataan',
  'Batangas',
  'Benguet',
  'Biliran',
  'Bohol',
  'Bukidnon',
  'Bulacan',
  'Cagayan',
  'Camarines Norte',
  'Camarines Sur',
  'Camiguin',
  'Capiz',
  'Catanduanes',
  'Cavite',
  'Cebu',
  'Cotabato',
  'Davao Del Norte',
  'Davao Del Sur',
  'Davao de Oro',
  'Davao Occidental',
  'Davao Oriental',
  'Dinagat Islands',
  'Eastern Samar',
  'Guimaras',
  'Ifugao',
  'Ilocos Norte',
  'Ilocos Sur',
  'Iloilo',
  'Isabela',
  'Kalinga',
  'Laguna',
  'Lanao Del Norte',
  'La Union',
  'Lazada Office',
  'Leyte',
  'Maguindanao',
  'Marinduque',
  'Masbate',
  'Metro Manila',
  'Misamis Occidental',
  'Misamis Oriental',
  'Mountain Province',
  'Negros Occidental',
  'Negros Oriental',
  'North Cotabato',
  'Northern Samar',
  'Nueva Ecija',
  'Nueva Vizcaya',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Palawan',
  'Pampanga',
  'Pangasinan',
  'Quezon',
  'Quirino',
  'Rizal',
  'Romblon',
  'Sarangani',
  'Siquijor',
  'Sorsogon',
  'South Cotabato',
  'Southern Leyte',
  'Sultan Kudarat',
  'Surigao Del Norte',
  'Surigao Del Sur',
  'Tarlac',
  'Tawi-Tawi',
  'Western Samar',
  'Zambales',
  'Zamboanga Del Norte',
  'Zamboanga Del Sur',
  'Zamboanga Sibugay',
] as const;

const CITY_OPTIONS_BY_PROVINCE: Partial<Record<(typeof PROVINCE_OPTIONS)[number], readonly string[]>> = {
  'Metro Manila': [
    'Caloocan',
    'Las Pinas',
    'Makati',
    'Malabon',
    'Mandaluyong',
    'Manila',
    'Marikina',
    'Muntinlupa',
    'Navotas',
    'Paranaque',
    'Pasay',
    'Pasig',
    'Pateros',
    'Quezon City',
    'San Juan',
    'Taguig',
    'Valenzuela',
  ],
};

export default function Checkout() {
  const { 
    cart, setCart,
    cartTotal,
    setView,
    setOrders,
    setAccountSubView,
    selectedBranch,
    user,
    setUser
  } = useAppContext();

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: 'Manila',
    province: '',
    postalCode: '',
  });
  const [shippingError, setShippingError] = useState('');
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [deliveryEstimateStatus, setDeliveryEstimateStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deliveryEstimateError, setDeliveryEstimateError] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [promoMessage, setPromoMessage] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [gcashInfo, setGcashInfo] = useState({
    number: '',
    reference: ''
  });
  const [mayaInfo, setMayaInfo] = useState({
    number: '',
    reference: ''
  });
  const [cardInfo, setCardInfo] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });
  const [selectedSavedAddressIndex, setSelectedSavedAddressIndex] = useState<number | null>(null);
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [addressPickerView, setAddressPickerView] = useState<'list' | 'form'>('list');
  const [checkoutAddresses, setCheckoutAddresses] = useState<SavedAddress[]>(() => parseSavedAddresses(user?.address, user));
  const [checkoutAddressForm, setCheckoutAddressForm] = useState<SavedAddress>(() => createEmptyCheckoutAddress(user));
  const [checkoutMakeDefault, setCheckoutMakeDefault] = useState(false);
  const [isProvincePickerOpen, setIsProvincePickerOpen] = useState(false);
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const [checkoutAddressError, setCheckoutAddressError] = useState('');

  useBodyScrollLock(isAddressPickerOpen);

  const savedAddresses = checkoutAddresses;
  const cityOptions = checkoutAddressForm.province
    ? CITY_OPTIONS_BY_PROVINCE[checkoutAddressForm.province as keyof typeof CITY_OPTIONS_BY_PROVINCE] || [checkoutAddressForm.province]
    : [];
  const deliveryFee = deliveryEstimate?.fee ?? 0;
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const orderTotal = Math.max(0, cartTotal + deliveryFee - discountAmount);

  const applySavedAddress = (address: SavedAddress) => {
    setShippingInfo({
      fullName: address.fullName || user?.full_name || '',
      phone: address.phoneNumber || user?.phone || '',
      address: address.streetAddress || '',
      city: address.city || 'Manila',
      province: address.province || '',
      postalCode: address.postalCode || '',
    });
    setShippingError('');
  };

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
    setCheckoutAddresses(parseSavedAddresses(data.address, data));
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
    setCheckoutAddressForm(createEmptyCheckoutAddress(user));
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
      postalCode: '',
    });
    setShippingError('');
  };

  React.useEffect(() => {
    const parsedAddresses = parseSavedAddresses(user?.address, user);

    setCheckoutAddresses(parsedAddresses);
    setCheckoutAddressForm(createEmptyCheckoutAddress(user));
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
  }, [user?.address, user?.full_name, user?.phone]);

  React.useEffect(() => {
    const address = shippingInfo.address.trim();
    const city = shippingInfo.city.trim();
    const province = shippingInfo.province.trim();

    if (!address || !city || !province) {
      setDeliveryEstimate(null);
      setDeliveryEstimateStatus('idle');
      setDeliveryEstimateError('');
      return;
    }

    let cancelled = false;

    setDeliveryEstimateStatus('loading');
    setDeliveryEstimateError('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/delivery/estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            city,
            province,
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
      window.clearTimeout(timeoutId);
    };
  }, [shippingInfo.address, shippingInfo.city, shippingInfo.province]);

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

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/promos/validate', {
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
      window.clearTimeout(timeoutId);
    };
  }, [promoCodeInput, cartTotal]);

  const handlePlaceOrder = async () => {
    try {
      const paymentMethodLabel =
        paymentMethod === 'cod'
          ? 'Cash on Delivery'
          : paymentMethod === 'gcash'
            ? 'GCash'
            : paymentMethod === 'maya'
              ? 'Maya'
              : 'Credit / Debit Card';

      const shippingAddress = formatDeliveryAddress(shippingInfo);

      const res = await fetchWithAuth('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingAddress,
          deliveryFee,
          promoCode: appliedPromo?.code || '',
          paymentMethod: paymentMethodLabel,
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      const newOrder: Order = {
        id: data.order.id,
        orderNumber: data.order.orderNumber,
        txNo: data.order.txNo,
        date: data.order.date,
        items: cart.map((item) => ({ ...item })),
        subtotal: Number(data.order.subtotal ?? cartTotal),
        deliveryFee: Number(data.order.deliveryFee ?? deliveryFee),
        discountAmount: Number(data.order.discountAmount ?? discountAmount),
        promoCode: data.order.promoCode || appliedPromo?.code,
        total: Number(data.order.total ?? orderTotal),
        status: 'Processing',
        shippingAddress,
        paymentMethod: paymentMethodLabel,
      };

      setOrders((prev) => [newOrder, ...prev]);
      setCart([]);
      setAccountSubView('orders');
      setView('account');
    } catch (error) {
      console.error('Place order failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to place order.');
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
          className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
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
          <div className="flex items-center gap-4">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  checkoutStep >= step ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-200 text-slate-400'
                }`}>
                  {step}
                </div>
                {step < 3 && <div className={`w-8 h-0.5 rounded-full ${checkoutStep > step ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <AnimatePresence mode="wait">
              {checkoutStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-emerald-100 p-3 rounded-2xl">
                      <MapPin className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shipping Information</h2>
                  </div>
                  
                  <div className="mb-8 rounded-[2.25rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Saved Addresses</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {savedAddresses.length > 0
                            ? 'Pick one of your saved delivery addresses from the popup, or add a new one there.'
                            : 'No saved address yet. Open the popup to add one for this order.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddressPickerOpen(true)}
                        className="inline-flex shrink-0 items-center justify-center self-start rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                      >
                        Choose Address
                      </button>
                    </div>

                    {selectedSavedAddressIndex !== null && savedAddresses[selectedSavedAddressIndex] ? (
                      <div className="mt-5 rounded-[2rem] border border-emerald-200 bg-white p-5 shadow-md shadow-emerald-100/70">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Selected Address</p>
                            <p className="mt-3 text-2xl font-black text-slate-900">{shippingInfo.fullName || 'Receiver name'}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500">{shippingInfo.phone || 'Add a phone number'}</p>
                            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                              {formatDeliveryAddress(shippingInfo) || 'Choose an address to continue.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
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
                            <MapPin className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900">
                              {savedAddresses.length > 0 ? 'No address selected yet' : 'No saved address yet'}
                            </p>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                              {savedAddresses.length > 0
                                ? 'Open Choose Address to select one of your saved addresses or add a new address for this order.'
                                : 'Open Choose Address to add a new address for this order.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedSavedAddressIndex !== null && shippingError && (
                    <p className="mt-4 text-sm font-bold text-red-600">{shippingError}</p>
                  )}
                  {deliveryEstimateStatus === 'loading' && (
                    <p className="mt-4 text-sm font-bold text-slate-500">Checking delivery fee for this address...</p>
                  )}
                  {deliveryEstimateStatus === 'ready' && deliveryEstimate && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-black">Delivery fee: ₱{deliveryEstimate.fee.toFixed(2)}</p>
                      <p className="mt-1 font-medium">ETA: {deliveryEstimate.etaLabel}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-600">Matched area: {deliveryEstimate.matchedLocation}</p>
                    </div>
                  )}
                  {deliveryEstimateStatus === 'error' && deliveryEstimateError && (
                    <p className="mt-4 text-sm font-bold text-red-600">{deliveryEstimateError}</p>
                  )}
                   
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
                      setCheckoutStep(2);
                    }}
                    disabled={selectedSavedAddressIndex === null || !deliveryEstimate}
                    className="w-full mt-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    Continue to Payment
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>

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
                              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                                {addressPickerView === 'list' ? 'Choose Address' : 'Add Address'}
                              </p>
                              <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                                {addressPickerView === 'list' ? 'Saved Addresses' : 'Add Address'}
                              </h3>
                              <p className="mt-2 text-sm text-slate-500">
                                {addressPickerView === 'list'
                                  ? 'Select an existing address for this order or add a new one.'
                                  : 'Fill in the delivery details and use this address for the current checkout.'}
                              </p>
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
                                <p className="text-sm text-slate-500">
                                  {savedAddresses.length > 0
                                    ? `${savedAddresses.length} saved ${savedAddresses.length === 1 ? 'address' : 'addresses'} available`
                                    : 'No saved addresses available yet'}
                                </p>
                                <button
                                  type="button"
                                  onClick={startNewAddressEntry}
                                  disabled={savedAddresses.length >= MAX_SAVED_ADDRESSES}
                                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
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
                                        key={`modal-${address.label}-${index}`}
                                        type="button"
                                        onClick={() => {
                                          setSelectedSavedAddressIndex(index);
                                          applySavedAddress(address);
                                          setIsAddressPickerOpen(false);
                                          setAddressPickerView('list');
                                        }}
                                        className={`rounded-[2rem] border p-5 text-left transition-all ${
                                          isSelected
                                            ? 'border-emerald-500 bg-emerald-50/80 shadow-lg shadow-emerald-100'
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
                                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
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
                                      <MapPin className="h-6 w-6 text-emerald-600" />
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
                                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                  <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Full Name</label>
                                  <input
                                    type="text"
                                    value={checkoutAddressForm.fullName}
                                    onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                    className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                  />
                                </div>
                                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                  <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Phone Number</label>
                                  <input
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
                                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                    <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Province</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsProvincePickerOpen((prev) => !prev);
                                        setIsCityPickerOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 text-left"
                                    >
                                      <input
                                        type="text"
                                        readOnly
                                        value={checkoutAddressForm.province}
                                        placeholder="Select province"
                                        className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                                      />
                                      <span className={`text-slate-400 text-xl transition-transform ${isProvincePickerOpen ? 'rotate-180' : ''}`}>▾</span>
                                    </button>
                                  </div>

                                  {isProvincePickerOpen && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                                      {PROVINCE_OPTIONS.map((province) => (
                                        <button
                                          key={province}
                                          type="button"
                                          onClick={() => {
                                            setCheckoutAddressForm((prev) => ({
                                              ...prev,
                                              province,
                                              city: CITY_OPTIONS_BY_PROVINCE[province]?.includes(prev.city) ? prev.city : '',
                                            }));
                                            setIsProvincePickerOpen(false);
                                          }}
                                          className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${checkoutAddressForm.province === province ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50'}`}
                                        >
                                          {province}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="relative">
                                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                    <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">City</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCityPickerOpen((prev) => !prev);
                                        setIsProvincePickerOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 text-left"
                                    >
                                      <input
                                        type="text"
                                        readOnly
                                        value={checkoutAddressForm.city}
                                        placeholder="Select city"
                                        className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-300 sm:text-lg"
                                      />
                                      <span className={`text-slate-400 text-xl transition-transform ${isCityPickerOpen ? 'rotate-180' : ''}`}>▾</span>
                                    </button>
                                  </div>

                                  {isCityPickerOpen && cityOptions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-2 py-2 text-left text-base text-slate-700 shadow-xl shadow-slate-200/60">
                                      {cityOptions.map((city) => (
                                        <button
                                          key={city}
                                          type="button"
                                          onClick={() => {
                                            setCheckoutAddressForm((prev) => ({ ...prev, city }));
                                            setIsCityPickerOpen(false);
                                          }}
                                          className={`block w-full rounded-xl px-3 py-2 text-left font-medium transition-colors ${checkoutAddressForm.city === city ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50'}`}
                                        >
                                          {city}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="relative mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Postal Code</label>
                                <input
                                  type="text"
                                  value={checkoutAddressForm.postalCode}
                                  onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                                  className="w-full bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                />
                              </div>

                              <div className="relative mb-8 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pt-6 pb-3 shadow-sm shadow-slate-100/70 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-emerald-100">
                                <label className="absolute -top-2 left-4 bg-white px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Street Name, Building, House No.</label>
                                <textarea
                                  rows={4}
                                  value={checkoutAddressForm.streetAddress}
                                  onChange={(e) => setCheckoutAddressForm((prev) => ({ ...prev, streetAddress: e.target.value }))}
                                  className="w-full resize-none bg-transparent text-base font-semibold text-slate-800 outline-none sm:text-lg"
                                />
                              </div>

                              <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-700 transition-colors hover:border-slate-300 hover:bg-white">
                                <input
                                  type="checkbox"
                                  checked={checkoutMakeDefault}
                                  onChange={(e) => setCheckoutMakeDefault(e.target.checked)}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
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
                                            ? 'border border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100'
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
                                      setCheckoutAddressForm(createEmptyCheckoutAddress(user));
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

              {checkoutStep === 2 && (
                <motion.div 
                  key="step2"
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
                      { id: 'cod', name: 'Cash on Delivery', desc: 'Pay when you receive', icon: <Banknote className="w-5 h-5 text-slate-500" /> },
                      { id: 'gcash', name: 'GCash', desc: 'Pay via GCash', icon: <Wallet className="w-5 h-5 text-blue-600" /> },
                      { id: 'maya', name: 'Maya', desc: 'Pay via Maya', icon: <Wallet className="w-5 h-5 text-emerald-600" /> }
                    ].map(method => (
                      <div 
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${
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
                      </div>
                    ))}
                  </div>

                  {paymentMethod === 'card' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 overflow-hidden mt-6"
                    >
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Card Number *</label>
                        <input 
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardInfo.number}
                          onChange={(e) => setCardInfo({...cardInfo, number: e.target.value})}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Cardholder Name *</label>
                        <input 
                          type="text"
                          placeholder="JUAN DELA CRUZ"
                          value={cardInfo.name}
                          onChange={(e) => setCardInfo({...cardInfo, name: e.target.value})}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Expiry Date *</label>
                          <input 
                            type="text"
                            placeholder="MM/YY"
                            value={cardInfo.expiry}
                            onChange={(e) => setCardInfo({...cardInfo, expiry: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">CVV *</label>
                          <input 
                            type="text"
                            placeholder="123"
                            value={cardInfo.cvv}
                            onChange={(e) => setCardInfo({...cardInfo, cvv: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentMethod === 'gcash' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 overflow-hidden mt-6"
                    >
                      <div className="bg-[#f4f8ff] border border-blue-200 p-5 rounded-xl text-sm text-[#1e3a8a]">
                        <p className="font-bold mb-3 text-base">GCash Payment Instructions:</p>
                        <ol className="space-y-2 list-decimal list-inside">
                          <li>Send ₱{orderTotal.toFixed(2)} to GCash number: <span className="font-bold">0917-123-4567</span></li>
                          <li>Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>Enter your GCash number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Your GCash Number *</label>
                          <input 
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={gcashInfo.number}
                            onChange={(e) => setGcashInfo({...gcashInfo, number: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">GCash Reference Number *</label>
                          <input 
                            type="text"
                            placeholder="Enter reference number"
                            value={gcashInfo.reference}
                            onChange={(e) => setGcashInfo({...gcashInfo, reference: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentMethod === 'maya' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 overflow-hidden mt-6"
                    >
                      <div className="bg-[#f0fdf4] border border-emerald-200 p-5 rounded-xl text-sm text-[#064e3b]">
                        <p className="font-bold mb-3 text-base">Maya Payment Instructions:</p>
                        <ol className="space-y-2 list-decimal list-inside">
                          <li>Send ₱{orderTotal.toFixed(2)} to Maya number: <span className="font-bold">0918-765-4321</span></li>
                          <li>Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>Enter your Maya number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Your Maya Number *</label>
                          <input 
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={mayaInfo.number}
                            onChange={(e) => setMayaInfo({...mayaInfo, number: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">Maya Reference Number *</label>
                          <input 
                            type="text"
                            placeholder="Enter reference number"
                            value={mayaInfo.reference}
                            onChange={(e) => setMayaInfo({...mayaInfo, reference: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setCheckoutStep(1)}
                      className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-base hover:bg-slate-200 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => setCheckoutStep(3)}
                      disabled={
                        (paymentMethod === 'gcash' && (!gcashInfo.number || !gcashInfo.reference)) ||
                        (paymentMethod === 'maya' && (!mayaInfo.number || !mayaInfo.reference)) ||
                        (paymentMethod === 'card' && (!cardInfo.number || !cardInfo.name || !cardInfo.expiry || !cardInfo.cvv))
                      }
                      className="flex-[2] py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Review Order
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-emerald-100 p-3 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Review & Confirm</h2>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Shipping To</h3>
                        <p className="font-black text-slate-900 mb-1">{shippingInfo.fullName}</p>
                        <p className="text-sm text-slate-600 mb-1">{shippingInfo.phone}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{formatDeliveryAddress(shippingInfo) || 'Address will be confirmed during checkout.'}</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Payment Method</h3>
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                            {paymentMethod === 'cod' ? <Banknote className="w-5 h-5 text-emerald-600" /> : 
                             paymentMethod === 'gcash' ? <Wallet className="w-5 h-5 text-blue-600" /> :
                             paymentMethod === 'maya' ? <Wallet className="w-5 h-5 text-blue-600" /> :
                             <CreditCard className="w-5 h-5 text-emerald-600" />}
                          </div>
                          <p className="font-black text-slate-900">
                            {paymentMethod === 'cod' ? 'Cash on Delivery' : 
                             paymentMethod === 'gcash' ? 'GCash' : 
                             paymentMethod === 'maya' ? 'Maya' : 'Credit / Debit Card'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {deliveryEstimate && (
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Delivery Estimate</h3>
                        <p className="font-black text-slate-900 mb-1">₱{deliveryEstimate.fee.toFixed(2)}</p>
                        <p className="text-sm text-slate-600 mb-1">ETA: {deliveryEstimate.etaLabel}</p>
                        <p className="text-sm text-slate-600">{deliveryEstimate.matchedLocation}</p>
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
                          className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition-all focus:outline-none ${
                            promoStatus === 'valid'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-2 focus:ring-emerald-200'
                              : promoStatus === 'invalid'
                                ? 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200'
                                : 'border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-slate-200'
                          }`}
                        />
                        {promoStatus === 'checking' && (
                          <p className="text-sm font-bold text-slate-500">Checking promo code...</p>
                        )}
                        {promoStatus === 'valid' && (
                          <p className="text-sm font-bold text-emerald-600">{promoMessage}</p>
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
                        {cart.map(item => (
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
                      onClick={() => setCheckoutStep(2)}
                      className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handlePlaceOrder}
                      className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                    >
                      Place Order (₱{orderTotal.toFixed(2)})
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
                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition-all focus:outline-none ${
                      promoStatus === 'valid'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-2 focus:ring-emerald-200'
                        : promoStatus === 'invalid'
                          ? 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200'
                          : 'border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-slate-200'
                    }`}
                  />
                  {promoStatus === 'checking' && (
                    <p className="text-sm font-bold text-slate-500">Checking promo code...</p>
                  )}
                  {promoStatus === 'valid' && (
                    <p className="text-sm font-bold text-emerald-600">{promoMessage}</p>
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
                  <span className={`font-black ${discountAmount > 0 ? 'text-emerald-600' : ''}`}>
                    -₱{discountAmount.toFixed(2)}
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                  <span className="text-slate-900 font-black">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-emerald-600 tracking-tight">₱{orderTotal.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">VAT Included</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 p-4 rounded-2xl">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="font-medium leading-relaxed">Secure payment processed by PharmaQuick. Your data is protected.</p>
                </div>
                {selectedBranch && (
                  <div className="flex items-center gap-3 text-xs text-slate-500 bg-emerald-50 p-4 rounded-2xl">
                    <Truck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="font-medium leading-relaxed">Delivering from <span className="font-black text-emerald-700">{selectedBranch.name}</span>. Estimated time: <span className="font-black text-emerald-700">{deliveryEstimate?.etaLabel || 'Waiting for address'}</span>.</p>
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

