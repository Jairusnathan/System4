'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Package, MapPin, LogOut, ChevronRight, Clock, CheckCircle2, Truck, X, Settings, Bell, Lock, Calendar, Phone, Mail, Camera, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Account() {
  const { 
    orders, setSelectedOrder, setView,
    setIsLoggedIn
  } = useAppContext();

  const [subView, setSubView] = useState<'profile' | 'orders' | 'settings'>('profile');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [profileData, setProfileData] = useState({
    fullName: 'Admin User',
    email: 'admin@gmail.com',
    phone: '+639000000000',
    dob: '1990-01-01',
    address: '123 Main St, Brgy. San Jose, Quezon City, Metro Manila, 1115'
  });

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: true
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setView('home');
    setIsLogoutModalOpen(false);
  };

  const renderProfileDetails = () => (
    <div className="space-y-8">
      <div className="flex items-center gap-6">
        <div className="relative group">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border-4 border-white shadow-md">
            <User className="w-12 h-12" />
          </div>
          <button className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full shadow-lg hover:bg-emerald-700 transition-colors">
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">Profile Picture</h3>
          <p className="text-sm text-slate-500">Upload a new profile picture. Max size 2MB.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
          <input 
            type="text"
            value={profileData.fullName}
            onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
          <input 
            type="email"
            value={profileData.email}
            onChange={(e) => setProfileData({...profileData, email: e.target.value})}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
          <input 
            type="tel"
            value={profileData.phone}
            onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Date of Birth</label>
          <div className="relative">
            <input 
              type="date"
              value={profileData.dob}
              onChange={(e) => setProfileData({...profileData, dob: e.target.value})}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">Default Delivery Address</label>
          <textarea 
            rows={3}
            value={profileData.address}
            onChange={(e) => setProfileData({...profileData, address: e.target.value})}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="px-10 py-3 bg-emerald-600 text-white rounded-full font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderOrderHistory = () => (
    <div className="space-y-6">
      {orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto">You haven't placed any orders yet. Start shopping to see your history!</p>
          <button 
            onClick={() => setView('shop')}
            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            Go to Shop
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div 
              key={order.id}
              onClick={() => {
                setSelectedOrder(order);
                setView('order-status');
              }}
              className="group p-6 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Order ID</p>
                  <p className="font-black text-slate-900 tracking-tight">{order.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 ${
                    order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                    order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      order.status === 'Delivered' ? 'bg-emerald-500' : 
                      order.status === 'Processing' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {order.status}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-bold text-slate-900">{new Date(order.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Amount</p>
                  <p className="text-sm font-black text-emerald-600">₱{order.total.toFixed(2)}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Items</p>
                  <p className="text-sm font-bold text-slate-900">{order.items.length} Product{order.items.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
          <div>
            <h4 className="font-black text-slate-900">Email Notifications</h4>
            <p className="text-sm text-slate-500">Receive order updates and promotions</p>
          </div>
          <button 
            onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.emailNotifications ? 'bg-emerald-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.emailNotifications ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
          <div>
            <h4 className="font-black text-slate-900">SMS Notifications</h4>
            <p className="text-sm text-slate-500">Receive delivery updates via SMS</p>
          </div>
          <button 
            onClick={() => setSettings({...settings, smsNotifications: !settings.smsNotifications})}
            className={`w-12 h-6 rounded-full transition-all relative ${settings.smsNotifications ? 'bg-emerald-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.smsNotifications ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h4 className="font-black text-slate-900 mb-6">Change Password</h4>
        <button className="px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all">
          Update Password
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex-1 bg-slate-50 py-8 sm:py-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <button 
          onClick={() => setView('shop')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-8 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Shop
        </button>

        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-12">My Account</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Info Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-black text-slate-900">{profileData.fullName}</h2>
                <p className="text-sm text-slate-400 font-medium">{profileData.email}</p>
              </div>
            </div>

            {/* Menu Card */}
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="space-y-1">
                {[
                  { id: 'profile', name: 'Profile Details', icon: <User className="w-5 h-5" /> },
                  { id: 'orders', name: 'Order History', icon: <Package className="w-5 h-5" /> },
                  { id: 'settings', name: 'Account Settings', icon: <Settings className="w-5 h-5" /> }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setSubView(item.id as any)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold text-sm transition-all group ${
                      subView === item.id 
                        ? 'bg-emerald-50 text-emerald-600 border-l-4 border-emerald-600 rounded-l-none' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {item.name}
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${subView === item.id ? 'text-emerald-600 translate-x-1' : 'text-slate-300'}`} />
                  </button>
                ))}
                
                <div className="pt-4 mt-4 border-t border-slate-50">
                  <button 
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-8">
            <motion.div 
              key={subView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px]"
            >
              <h2 className="text-2xl font-black text-slate-900 mb-10 tracking-tight">
                {subView === 'profile' ? 'Profile Details' : subView === 'orders' ? 'Order History' : 'Account Settings'}
              </h2>
              
              {subView === 'profile' && renderProfileDetails()}
              {subView === 'orders' && renderOrderHistory()}
              {subView === 'settings' && renderAccountSettings()}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Log Out?</h3>
                <p className="text-slate-500 mb-6">Are you sure you want to log out of your account?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
