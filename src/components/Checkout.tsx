'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, MapPin, CreditCard, CheckCircle2, ShoppingBag, Truck, ShieldCheck, ArrowRight, X, Wallet, Banknote } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Order } from '../types';

export default function Checkout() {
  const { 
    cart, setCart,
    cartTotal,
    setView,
    setOrders,
    selectedBranch
  } = useAppContext();

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: 'Manila',
    zipCode: ''
  });
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

  const handlePlaceOrder = () => {
    const newOrder: Order = {
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString(),
      items: [...cart],
      total: cartTotal + 50, // Including shipping
      status: 'Processing',
      shippingAddress: shippingInfo.address,
      paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery' : 
                     paymentMethod === 'gcash' ? 'GCash' : 
                     paymentMethod === 'maya' ? 'Maya' : 'Credit / Debit Card'
    };
    
    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setView('success');
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                      <input 
                        type="text"
                        value={shippingInfo.fullName}
                        onChange={(e) => setShippingInfo({...shippingInfo, fullName: e.target.value})}
                        placeholder="Juan Dela Cruz"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                      <input 
                        type="tel"
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                        placeholder="0912 345 6789"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-wider mb-2">Zip Code</label>
                      <input 
                        type="text"
                        value={shippingInfo.zipCode}
                        onChange={(e) => setShippingInfo({...shippingInfo, zipCode: e.target.value})}
                        placeholder="1000"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-wider mb-2">Delivery Address</label>
                      <textarea 
                        rows={3}
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                        placeholder="House No., Street Name, Barangay"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setCheckoutStep(2)}
                    disabled={!shippingInfo.fullName || !shippingInfo.address || !shippingInfo.phone}
                    className="w-full mt-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    Continue to Payment
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
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
                          <li>Send ₱{(cartTotal + 50).toFixed(2)} to GCash number: <span className="font-bold">0917-123-4567</span></li>
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
                          <li>Send ₱{(cartTotal + 50).toFixed(2)} to Maya number: <span className="font-bold">0918-765-4321</span></li>
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
                        <p className="text-sm text-slate-600 leading-relaxed">{shippingInfo.address}, {shippingInfo.city} {shippingInfo.zipCode}</p>
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
                      Place Order (₱{(cartTotal + 50).toFixed(2)})
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-32">
              <h2 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-wider">Order Summary</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Subtotal</span>
                  <span className="font-black">₱{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-bold">Shipping Fee</span>
                  <span className="font-black">₱50.00</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                  <span className="text-slate-900 font-black">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-emerald-600 tracking-tight">₱{(cartTotal + 50).toFixed(2)}</p>
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
                    <p className="font-medium leading-relaxed">Delivering from <span className="font-black text-emerald-700">{selectedBranch.name}</span>. Estimated time: 45-60 mins.</p>
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
