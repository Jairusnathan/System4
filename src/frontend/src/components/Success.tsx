'use client';

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShoppingBag, ArrowRight, Truck, ShieldCheck, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Success() {
  const { setView, orders } = useAppContext();
  const latestOrder = orders[0];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 py-24">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 150 }}
        className="bg-white p-12 lg:p-20 rounded-[4rem] shadow-2xl border border-slate-100 text-center max-w-2xl w-full relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50" />
        
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-10 text-emerald-600 shadow-xl shadow-emerald-50">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tight">Order Placed!</h2>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">Thank you for your purchase. Your order <span className="font-black text-emerald-600">#{latestOrder?.id}</span> has been received and is being processed.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Time</p>
            <p className="text-sm font-black text-slate-900">45-60 mins</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Delivery</p>
            <p className="text-sm font-black text-slate-900">Standard</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Status</p>
            <p className="text-sm font-black text-slate-900">Confirmed</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => setView('shop')}
            className="flex-1 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 group"
          >
            <ShoppingBag className="w-5 h-5" />
            Continue Shopping
          </button>
          <button 
            onClick={() => setView('account')}
            className="flex-1 px-8 py-4 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
          >
            View Orders
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </main>
  );
}
