'use client';

import React, { useEffect, useState } from 'react';
import { XCircle, RotateCcw, ShoppingBag, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/auth-client';

type CancelState = 'idle' | 'cancelling' | 'done' | 'error';

export default function PaymentCancelPage() {
  const [receipt, setReceipt] = useState('');
  const [cancelState, setCancelState] = useState<CancelState>('idle');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReceipt(params.get('receipt') ?? '');
  }, []);

  const handleCancelOrder = async () => {
    if (!receipt || cancelState === 'cancelling' || cancelState === 'done') return;
    setCancelState('cancelling');
    try {
      const res = await fetchWithAuth('/api/orders/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptNumber: receipt }),
      });
      setCancelState(res.ok ? 'done' : 'error');
    } catch {
      setCancelState('error');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 p-10 text-center">

        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Payment not completed</h1>
        <p className="text-slate-500 text-sm mb-6">
          You left the payment page before completing your transaction. Your cart items are still reserved.
        </p>

        {receipt && cancelState !== 'done' && (
          <div className="bg-slate-50 rounded-2xl px-5 py-3 text-sm text-slate-500 mb-6">
            Order reference: <span className="font-black text-slate-900">{receipt}</span>
          </div>
        )}

        {cancelState === 'done' && (
          <div className="bg-green-50 rounded-2xl px-5 py-3 text-sm text-green-700 font-bold mb-6">
            Order cancelled and stock released.
          </div>
        )}

        {cancelState === 'error' && (
          <div className="bg-red-50 rounded-2xl px-5 py-3 text-sm text-red-700 font-bold mb-6">
            Could not cancel the order automatically. Please contact support if needed.
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

          {receipt && cancelState === 'idle' && (
            <button
              onClick={handleCancelOrder}
              disabled={cancelState !== 'idle'}
              className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {cancelState === 'cancelling' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</>
              ) : (
                <><ShoppingBag className="w-4 h-4" /> Cancel Order & Return to Shop</>
              )}
            </button>
          )}

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
