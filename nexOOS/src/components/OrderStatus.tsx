'use client';

import React from 'react';
import { ChevronLeft, Package, Truck, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const getDisplayOrderNumber = (order: { orderNumber?: string; txNo?: string; id: string; date: string }) =>
  order.id || order.orderNumber || (order.txNo ? `TXN-${order.txNo}` : `TXN-${new Date(order.date).getTime()}`);

const getOrderStatusBadgeClassName = (status: string) => {
  if (status === 'Delivered' || status === 'Processing') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-amber-100 text-amber-700';
};

const getOrderStatusDotClassName = (status: string) => {
  if (status === 'Delivered' || status === 'Processing') {
    return 'bg-blue-500';
  }

  return 'bg-amber-500';
};

const getTransitHeadingClassName = (status: string) => {
  if (status === 'In Transit') {
    return 'text-blue-600';
  }

  if (status === 'Delivered') {
    return 'text-slate-900';
  }

  return 'text-slate-400';
};

export default function OrderStatus() {
  const { selectedOrder, setView } = useAppContext();

  if (!selectedOrder) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-slate-200">
          <Package className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Order not found</h2>
        <p className="text-slate-500 mb-8 max-w-xs mx-auto">We couldn&apos;t find the order you&apos;re looking for.</p>
        <button 
          onClick={() => setView('account')}
          className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
        >
          Back to Account
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-slate-50 py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => setView('account')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Orders
          </button>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 ${getOrderStatusBadgeClassName(selectedOrder.status)}`}>
              <span className={`w-2 h-2 rounded-full ${getOrderStatusDotClassName(selectedOrder.status)}`} />
              {selectedOrder.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-10">
                <div className="bg-blue-100 p-3 rounded-2xl">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Order Tracking</h2>
              </div>
              
              <div className="relative space-y-12 pl-10">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100" />
                
                <div className="relative">
                  <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full ring-4 ring-white shadow-sm flex items-center justify-center ${
                    selectedOrder.status === 'Processing' || selectedOrder.status === 'In Transit' || selectedOrder.status === 'Delivered' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-slate-900 tracking-tight">Order Confirmed</h3>
                  <p className="text-sm text-slate-500">We&apos;ve received your order and it&apos;s being prepared.</p>
                  <p className="text-xs text-slate-400 mt-1 font-bold">{new Date(selectedOrder.date).toLocaleString()}</p>
                </div>

                <div className="relative">
                  <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full ring-4 ring-white shadow-sm flex items-center justify-center ${
                    selectedOrder.status === 'In Transit' || selectedOrder.status === 'Delivered' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <h3 className={`font-black tracking-tight ${getTransitHeadingClassName(selectedOrder.status)}`}>
                    In Transit
                  </h3>
                  <p className="text-sm text-slate-500">Your order is on the way to your delivery address.</p>
                  {selectedOrder.status === 'In Transit' && <p className="text-xs text-blue-500 mt-1 font-bold animate-pulse">Estimated arrival: 15-20 mins</p>}
                </div>

                <div className="relative">
                  <div className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full ring-4 ring-white shadow-sm flex items-center justify-center ${
                    selectedOrder.status === 'Delivered' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className={`font-black tracking-tight ${selectedOrder.status === 'Delivered' ? 'text-blue-600' : 'text-slate-400'}`}>Delivered</h3>
                  <p className="text-sm text-slate-500">Order has been successfully delivered and received.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Order Items</h3>
              <div className="space-y-4">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 bg-slate-50/50">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl shadow-sm" referrerPolicy="no-referrer" />
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

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Order Details</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Order ID</p>
                  <p className="font-black text-slate-900 tracking-tight">{getDisplayOrderNumber(selectedOrder)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                  <p className="font-bold text-slate-900">{selectedOrder.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Shipping Address</p>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">{selectedOrder.shippingAddress}</p>
                </div>
                {selectedOrder.promoCode && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Promo Code</p>
                    <p className="font-bold text-blue-600">{selectedOrder.promoCode}</p>
                  </div>
                )}
                <div className="pt-6 border-t border-slate-100">
                  <div className="space-y-3">
                    {typeof selectedOrder.subtotal === 'number' && (
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span className="font-bold">Subtotal</span>
                        <span className="font-black">₱{selectedOrder.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {typeof selectedOrder.deliveryFee === 'number' && (
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span className="font-bold">Delivery</span>
                        <span className="font-black">₱{selectedOrder.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {typeof selectedOrder.discountAmount === 'number' && (
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span className="font-bold">Discount</span>
                        <span className="font-black text-slate-900">-₱{selectedOrder.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end pt-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tight">₱{selectedOrder.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-600 p-8 rounded-[3rem] shadow-xl shadow-blue-100 text-white">
              <h3 className="text-lg font-black mb-4 tracking-tight">Need Help?</h3>
              <p className="text-sm text-blue-100 leading-relaxed mb-6">If you have any issues with your order, our support team is available 24/7 to assist you.</p>
              <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-black text-sm hover:bg-blue-50 transition-all">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
