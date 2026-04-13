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

export default function Page() {
  const { view } = useAppContext();

  const renderView = () => {
    switch (view) {
      case 'home': return <Home />;
      case 'shop': return <Shop />;
      case 'checkout': return <Checkout />;
      case 'success': return <Success />;
      case 'account': return <Account />;
      case 'order-status': return <OrderStatus />;
      case 'login': return <Login />;
      case 'register': return <Register />;
      default: return <Home />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />
      {renderView()}
      <Footer />
      
      {/* Modals & Drawers */}
      <CartDrawer />
      <ProductDetailsModal />
      <BranchModal />
    </div>
  );
}
