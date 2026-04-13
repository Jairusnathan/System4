'use client';

import React from 'react';
import { Pill } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Footer() {
  const { setView } = useAppContext();

  return (
    <footer className="bg-slate-900 text-slate-300 py-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-8">
            <Pill className="w-8 h-8" />
            <span className="text-2xl font-black text-white tracking-tight">PharmaQuick</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Your trusted online pharmacy for medicines, vitamins, and daily essentials. Fast, secure, and reliable delivery to your doorstep.
          </p>
        </div>
        
        <div>
          <h4 className="text-white font-black text-sm uppercase tracking-[0.2em] mb-8">Quick Links</h4>
          <ul className="space-y-4 text-sm font-bold">
            <li><button onClick={() => setView('home')} className="hover:text-emerald-400 transition-colors">Home</button></li>
            <li><button onClick={() => setView('shop')} className="hover:text-emerald-400 transition-colors">Shop Products</button></li>
            <li><button className="hover:text-emerald-400 transition-colors">About Us</button></li>
            <li><button className="hover:text-emerald-400 transition-colors">Contact Support</button></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-black text-sm uppercase tracking-[0.2em] mb-8">Customer Service</h4>
          <ul className="space-y-4 text-sm font-bold">
            <li><button className="hover:text-emerald-400 transition-colors">FAQ</button></li>
            <li><button className="hover:text-emerald-400 transition-colors">Shipping Policy</button></li>
            <li><button className="hover:text-emerald-400 transition-colors">Returns & Refunds</button></li>
            <li><button className="hover:text-emerald-400 transition-colors">Privacy Policy</button></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-black text-sm uppercase tracking-[0.2em] mb-8">Contact Us</h4>
          <ul className="space-y-4 text-sm font-bold">
            <li className="flex items-start gap-3">
              <span className="text-emerald-500">E:</span>
              <a href="mailto:support@pharmaquick.com" className="hover:text-emerald-400 transition-colors">support@pharmaquick.com</a>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-500">P:</span>
              <span>(02) 8123-4567</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-500">A:</span>
              <span className="text-slate-400">123 Health Avenue, Medical District, Manila, Philippines</span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
