'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ShoppingBag } from 'lucide-react';

type PaymentStatus = 'polling' | 'paid' | 'failed';

type OrderDetail = {
  receiptNumber?: string;
  orderNumber?: string;
  total?: number;
  shippingAddress?: string;
  paymentMethod?: string;
};

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2500;

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<PaymentStatus>('polling');
  const [order, setOrder] = useState<OrderDetail>({});
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receiptParam = params.get('receipt') ?? '';
    setReceipt(receiptParam);

    if (!receiptParam) {
      setStatus('failed');
      return;
    }

    let polls = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/payment/status?receipt=${encodeURIComponent(receiptParam)}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.status === 'paid') {
          setOrder({
            receiptNumber: data.receiptNumber,
            orderNumber: data.orderNumber,
            total: data.total,
            shippingAddress: data.shippingAddress,
            paymentMethod: data.paymentMethod,
          });
          setStatus('paid');
          return;
        }

        if (data.status === 'failed') {
          setStatus('failed');
          return;
        }
      } catch {
        // network blip — keep polling
      }

      polls += 1;
      if (polls >= MAX_POLLS) {
        if (!cancelled) setStatus('failed');
        return;
      }

      globalThis.setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 p-10 text-center">

        {status === 'polling' && (
          <>
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Confirming payment…</h1>
            <p className="text-slate-500 text-sm">Please wait while we verify your payment. Do not close this tab.</p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Payment confirmed!</h1>
            <p className="text-slate-500 text-sm mb-6">Your order has been placed and is now being processed.</p>

            <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-2 mb-8">
              {order.receiptNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Receipt</span>
                  <span className="font-black text-slate-900">{order.receiptNumber}</span>
                </div>
              )}
              {order.orderNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Order No.</span>
                  <span className="font-black text-slate-900">{order.orderNumber}</span>
                </div>
              )}
              {order.total !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total paid</span>
                  <span className="font-black text-slate-900">₱{Number(order.total).toFixed(2)}</span>
                </div>
              )}
              {order.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Payment</span>
                  <span className="font-black text-slate-900">{order.paymentMethod}</span>
                </div>
              )}
              {order.shippingAddress && (
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-slate-500 shrink-0">Deliver to</span>
                  <span className="font-bold text-slate-900 text-right">{order.shippingAddress}</span>
                </div>
              )}
            </div>

            <a
              href="/"
              className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
            >
              <ShoppingBag className="w-4 h-4" />
              View My Orders
            </a>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Payment not confirmed</h1>
            <p className="text-slate-500 text-sm mb-6">
              We could not verify your payment
              {receipt ? ` for order ${receipt}` : ''}.
              If you were charged, please contact support with your receipt number.
            </p>
            <a
              href="/"
              className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-700 transition-colors"
            >
              Return to Shop
            </a>
          </>
        )}

      </div>
    </main>
  );
}
