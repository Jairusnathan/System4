'use client';

import React from 'react';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Home from '../components/Home';
import Shop from '../components/Shop';
import Checkout from '../components/Checkout';
import Success from '../components/Success';
import Account from '../components/Account';
import OrderStatus from '../components/OrderStatus';
import Login from '../components/Login';
import Register from '../components/Register';
import CartDrawer from '../components/CartDrawer';
import ProductDetailsModal from '../components/ProductDetailsModal';
import BranchModal from '../components/BranchModal';
import { useOosSettings } from '@/hooks/useOosSettings';
import { Pill } from 'lucide-react';

function StoreClosed({ phone, email }: { phone: string; email: string }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="bg-slate-100 p-5 rounded-3xl mb-6">
        <Pill className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
        We&apos;re Currently Offline
      </h2>
      <p className="text-slate-500 max-w-sm leading-relaxed mb-6">
        Our online ordering system is temporarily unavailable. Please check back soon or contact us directly.
      </p>
      {(phone || email) && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-600 space-y-1">
          {email && <p>📧 <span className="font-bold">{email}</span></p>}
          {phone && <p>📞 <span className="font-bold">{phone}</span></p>}
        </div>
      )}
    </main>
  );
}

export default function Page() {
  const { view } = useAppContext();
  const { settings, loaded } = useOosSettings();

  const renderView = () => {
    switch (view) {
      case 'home':         return <Home />;
      case 'shop':         return <Shop />;
      case 'checkout':     return <Checkout />;
      case 'success':      return <Success />;
      case 'account':      return <Account />;
      case 'order-status': return <OrderStatus />;
      case 'login':        return <Login />;
      case 'register':     return <Register />;
      default:             return <Home />;
    }
  };

  // Allow login/account/order pages even when OOS is disabled
  const isAuthView = ['login', 'register', 'account', 'order-status', 'success'].includes(view);
  const showClosed = loaded && !settings.oos_enabled && !isAuthView;

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      {showClosed
        ? <StoreClosed phone={settings.contact_phone} email={settings.contact_email} />
        : renderView()
      }
      <Footer />
      <CartDrawer />
      <ProductDetailsModal />
      <BranchModal />
    </div>
  );
}
