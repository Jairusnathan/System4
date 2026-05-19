'use client';

import React, { useEffect, useState } from 'react';
import { XCircle, RotateCcw, ShoppingBag, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/auth-client';

type CancelState = 'cancelling' | 'done' | 'error';

export default function PaymentCancelPage() {
  const [receipt, setReceipt] = useState('');
  const [cancelState, setCancelState] = useState<CancelState | null>(null);

  // Auto-cancel the order as soon as the page loads with a receipt number.
  // This fires when the user is redirected here by PayMongo (payment not completed)
  // OR when they hit the browser back button from the PayMongo checkout page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receiptParam = params.get('receipt') ?? '';
    setReceipt(receiptParam);

    if (!receiptParam) return;

    // Start cancelling immediately — no button click required
    setCancelState('cancelling');
    fetchWithAuth('/api/orders/payment/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptNumber: receiptParam }),
    })
      .then((res) => setCancelState(res.ok ? 'done' : 'error'))
      .catch(() => setCancelState('error'));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 p-10 text-center">

        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Payment not completed</h1>
        <p className="text-slate-500 text-sm mb-6">
          You left the payment page before completing your transaction.
        </p>

        {/* Status messages */}
        {cancelState === 'cancelling' && (
          <div className="bg-slate-50 rounded-2xl px-5 py-3 text-sm text-slate-500 mb-6 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Cancelling order and releasing reserved items…
          </div>
        )}

        {cancelState === 'done' && (
          <div className="bg-green-50 rounded-2xl px-5 py-3 text-sm text-green-700 font-bold mb-6">
            Order cancelled — your cart items have been released.
          </div>
        )}

        {cancelState === 'error' && receipt && (
          <div className="bg-red-50 rounded-2xl px-5 py-3 text-sm text-red-700 font-bold mb-6">
            Could not cancel order <span className="font-black">{receipt}</span> automatically. Please contact support if needed.
          </div>
        )}

        {!receipt && (
          <div className="bg-slate-50 rounded-2xl px-5 py-3 text-sm text-slate-500 mb-6">
            No order reference found.
          </div>
        )}

        <div className="space-y-3">
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </a>

          {(cancelState === 'done' || cancelState === 'error') && (
            <a
              href="/"
              className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Go to Shop
            </a>
          )}
        </div>

      </div>
    </main>
  );
}
