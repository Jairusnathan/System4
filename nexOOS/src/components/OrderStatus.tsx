'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Package, Truck, CheckCircle2, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { fetchWithAuth } from '@/lib/auth-client';
import type { Order } from '../types';

const getDisplayOrderNumber = (order: { receiptNumber?: string; orderNumber?: string; id: string }) =>
  order.receiptNumber || order.orderNumber || order.id;

const getOrderStatusBadgeClassName = (status: string) => {
  if (status === 'Delivered') return 'bg-green-100 text-green-700';
  if (status === 'Processing') return 'bg-blue-100 text-blue-700';
  if (status === 'Cancelled') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

const getOrderStatusDotClassName = (status: string) => {
  if (status === 'Delivered') return 'bg-green-500';
  if (status === 'Processing') return 'bg-blue-500';
  if (status === 'Cancelled') return 'bg-red-500';
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

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

export default function OrderStatus() {
  const { selectedOrder, setView, setOrders, setSelectedOrder } = useAppContext();
  const delayRef = useRef(30_000);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonOther, setCancelReasonOther] = useState('');

  const CANCEL_REASONS = [
    'Changed my mind',
    'Found a better price elsewhere',
    'Ordered by mistake',
    'Other',
  ];

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDescription, setReturnDescription] = useState('');
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, boolean>>({});
  const [existingReturnRequest, setExistingReturnRequest] = useState<{
    status: string; reason: string; created_at: string;
  } | null>(null);

  const RETURN_REASONS = [
    'Damaged / Defective product',
    'Wrong item received',
    'Expired product',
    'Item not as described',
    'Other',
  ];

  const handleSubmitReturn = async () => {
    if (!selectedOrder?.receiptNumber || isSubmittingReturn) return;
    if (!returnReason) { setReturnError('Please select a reason.'); return; }
    const itemsToReturn = (selectedOrder.items ?? []).filter((item) => selectedReturnItems[item.id]);
    if (itemsToReturn.length === 0) { setReturnError('Please select at least one item to return.'); return; }

    setIsSubmittingReturn(true);
    setReturnError('');
    try {
      const res = await fetchWithAuth('/api/orders/return-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptNumber: selectedOrder.receiptNumber,
          reason: returnReason,
          description: returnDescription.trim() || undefined,
          items: itemsToReturn.map((item) => ({
            productId: item.id,
            name: item.name,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit return request');
      setReturnSuccess(true);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Failed to submit return request');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    const TERMINAL = new Set(['Delivered', 'Cancelled']);
    if (!selectedOrder?.receiptNumber || TERMINAL.has(selectedOrder.status)) return;

    delayRef.current = 30_000;
    let timeoutId: ReturnType<typeof setTimeout>;
    const { id, receiptNumber, status } = selectedOrder;

    const applyStatusUpdate = (newStatus: Order['status']) => {
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/track?receiptNumber=${encodeURIComponent(receiptNumber!)}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.status === 'string' && data.status !== status) {
            const nextStatus = data.status as Order['status'];
            applyStatusUpdate(nextStatus);
          }
          delayRef.current = 30_000;
        }
      } catch {
        delayRef.current = Math.min(delayRef.current * 2, 300_000);
      }
      if (!TERMINAL.has(selectedOrder.status)) timeoutId = setTimeout(poll, delayRef.current);
    };

    timeoutId = setTimeout(poll, delayRef.current);
    return () => clearTimeout(timeoutId);
  }, [selectedOrder?.id, selectedOrder?.status]);

  // Fetch existing return request for this order if it's Delivered
  useEffect(() => {
    if (selectedOrder?.status !== 'Delivered' || !selectedOrder?.receiptNumber) return;
    fetchWithAuth('/api/orders/my-return-requests')
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((payload) => {
        const requests: { receipt_number: string; status: string; reason: string; created_at: string }[] = payload?.data ?? [];
        const match = requests.find((r) => r.receipt_number === selectedOrder.receiptNumber);
        setExistingReturnRequest(match ?? null);
      })
      .catch(() => {});
  }, [selectedOrder?.receiptNumber, selectedOrder?.status, returnSuccess]);

  const canCancel =
    selectedOrder?.status === 'Processing' &&
    Date.now() - new Date(selectedOrder.date).getTime() < CANCEL_WINDOW_MS;

  const handleCancelOrder = async () => {
    if (!selectedOrder?.receiptNumber || isCancelling) return;
    const finalReason = cancelReason === 'Other' ? cancelReasonOther.trim() : cancelReason;
    if (!finalReason) { setCancelError('Please select a reason for cancellation.'); return; }
    setIsCancelling(true);
    setCancelError('');
    try {
      const res = await fetchWithAuth('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptNumber: selectedOrder.receiptNumber, reason: finalReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');
      const cancelled = { ...selectedOrder, status: 'Cancelled' as const };
      setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? cancelled : o));
      setSelectedOrder(cancelled);
      setIsCancelModalOpen(false);
      setCancelReason('');
      setCancelReasonOther('');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Receipt No.</p>
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

            {canCancel && (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-red-100">
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">Cancel Order</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">Orders can only be cancelled within 5 minutes of placement.</p>
                <button
                  onClick={() => { setCancelError(''); setCancelReason(''); setCancelReasonOther(''); setIsCancelModalOpen(true); }}
                  className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-black text-sm hover:bg-red-50 transition-all"
                >
                  Cancel This Order
                </button>
              </div>
            )}

            {selectedOrder.status === 'Delivered' &&
             Date.now() - new Date(selectedOrder.date).getTime() < 30 * 24 * 60 * 60 * 1000 && (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-amber-100">
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">Return / Refund</h3>

                {existingReturnRequest ? (
                  <>
                    <p className="text-sm text-slate-500 mb-4">You have submitted a return request for this order.</p>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                          existingReturnRequest.status === 'approved' || existingReturnRequest.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : existingReturnRequest.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {existingReturnRequest.status.charAt(0).toUpperCase() + existingReturnRequest.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Reason</span>
                        <span className="text-xs text-slate-700 text-right">{existingReturnRequest.reason}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submitted</span>
                        <span className="text-xs text-slate-700">{new Date(existingReturnRequest.created_at).toLocaleDateString('en-PH')}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 leading-relaxed mb-5">Not satisfied with your order? Submit a return or refund request.</p>
                    <button
                      onClick={() => { setReturnError(''); setReturnReason(''); setReturnDescription(''); setReturnSuccess(false); setSelectedReturnItems({}); setIsReturnModalOpen(true); }}
                      className="w-full py-3 border-2 border-amber-200 text-amber-700 rounded-xl font-black text-sm hover:bg-amber-50 transition-all"
                    >
                      Request Return / Refund
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel order confirmation modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              onClick={() => { if (!isCancelling) setIsCancelModalOpen(false); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-7 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Cancel Order?</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Are you sure you want to cancel order <span className="font-bold text-slate-700">{selectedOrder.receiptNumber}</span>? This cannot be undone.
                </p>
                <div className="text-left mb-3">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    Reason for cancellation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => { setCancelReason(e.target.value); setCancelError(''); }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition"
                  >
                    <option value="">Select a reason...</option>
                    {CANCEL_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                {cancelReason === 'Other' && (
                  <div className="text-left mb-3">
                    <textarea
                      value={cancelReasonOther}
                      onChange={(e) => setCancelReasonOther(e.target.value)}
                      placeholder="Please describe your reason..."
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition resize-none"
                    />
                  </div>
                )}
                {cancelError && (
                  <p className="mt-1 text-sm font-bold text-red-600">{cancelError}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setIsCancelModalOpen(false)}
                    disabled={isCancelling}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                    className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-60"
                  >
                    {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Return / Refund modal */}
      <AnimatePresence>
        {isReturnModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              onClick={() => { if (!isSubmittingReturn) setIsReturnModalOpen(false); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-7">
                {returnSuccess ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Request Submitted</h3>
                    <p className="text-slate-500 text-sm mb-6">Your return/refund request has been received. We'll review it and get back to you within 1-3 business days.</p>
                    <button onClick={() => setIsReturnModalOpen(false)} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors">
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Request Return / Refund</h3>
                      <button onClick={() => setIsReturnModalOpen(false)} disabled={isSubmittingReturn} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 mb-4">Order <span className="font-bold text-slate-700">{selectedOrder.receiptNumber}</span></p>

                    {/* Item selection */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Select items to return <span className="text-red-500">*</span></label>
                      <div className="space-y-2">
                        {(selectedOrder.items ?? []).map((item) => (
                          <label key={item.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!selectedReturnItems[item.id]}
                              onChange={(e) => setSelectedReturnItems((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                            <span className="text-xs text-slate-500">Qty: {item.quantity}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
                      <select
                        value={returnReason}
                        onChange={(e) => { setReturnReason(e.target.value); setReturnError(''); }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition"
                      >
                        <option value="">Select a reason...</option>
                        {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Additional details <span className="text-slate-400">(optional)</span></label>
                      <textarea
                        value={returnDescription}
                        onChange={(e) => setReturnDescription(e.target.value)}
                        placeholder="Describe the issue in more detail..."
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition resize-none"
                      />
                    </div>

                    {returnError && <p className="text-sm font-bold text-red-600 mb-3">{returnError}</p>}

                    <div className="flex gap-3">
                      <button onClick={() => setIsReturnModalOpen(false)} disabled={isSubmittingReturn} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50">
                        Cancel
                      </button>
                      <button onClick={handleSubmitReturn} disabled={isSubmittingReturn} className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-colors shadow-lg disabled:opacity-60">
                        {isSubmittingReturn ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
