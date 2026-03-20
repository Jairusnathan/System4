'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Pill, Mail, Lock, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, X, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Login() {
  const { setView, setIsLoggedIn, setUser } = useAppContext();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotData, setForgotData] = useState({
    email: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [resetStatus, setResetStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isResetting, setIsResetting] = useState(false);
  const [showForgotPasswords, setShowForgotPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        setUser(data.user);
        setView('home');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 py-24">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 lg:p-16 rounded-[4rem] shadow-2xl border border-slate-100 w-full max-w-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50" />
        
        <div 
          onClick={() => setView('home')} 
          className="flex items-center gap-2 mb-12 cursor-pointer group justify-center"
        >
          <div className="bg-emerald-600 p-2 rounded-xl group-hover:rotate-12 transition-transform">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-black text-slate-900 tracking-tight">PharmaQuick</span>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Welcome Back!</h2>
          <p className="text-slate-500 font-medium">Sign in to your account to continue shopping.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="name@example.com"
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="••••••••"
                className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Remember me</span>
            </label>
            <button 
              type="button" 
              onClick={() => setIsForgotModalOpen(true)}
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-500 font-bold">
            Don't have an account? <button onClick={() => setView('register')} className="text-emerald-600 hover:text-emerald-700 transition-colors font-black">Create Account</button>
          </p>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-lg relative"
          >
            <button 
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>

            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Reset Password</h3>
              <p className="text-slate-500 text-sm font-medium">Please enter your details to update your password.</p>
            </div>

            {resetStatus.type && (
              <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-sm font-bold ${
                resetStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
              }`}>
                {resetStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                {resetStatus.message}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Email</label>
                <input 
                  type="email"
                  value={forgotData.email}
                  onChange={(e) => setForgotData({...forgotData, email: e.target.value})}
                  placeholder="name@example.com"
                  className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Old Password</label>
                <div className="relative">
                  <input 
                    type={showForgotPasswords.old ? "text" : "password"}
                    value={forgotData.oldPassword}
                    onChange={(e) => setForgotData({...forgotData, oldPassword: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowForgotPasswords({...showForgotPasswords, old: !showForgotPasswords.old})}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                  >
                    {showForgotPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">New Password</label>
                <div className="relative">
                  <input 
                    type={showForgotPasswords.new ? "text" : "password"}
                    value={forgotData.newPassword}
                    onChange={(e) => setForgotData({...forgotData, newPassword: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowForgotPasswords({...showForgotPasswords, new: !showForgotPasswords.new})}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                  >
                    {showForgotPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showForgotPasswords.confirm ? "text" : "password"}
                    value={forgotData.confirmPassword}
                    onChange={(e) => setForgotData({...forgotData, confirmPassword: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowForgotPasswords({...showForgotPasswords, confirm: !showForgotPasswords.confirm})}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                  >
                    {showForgotPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                onClick={async () => {
                  if (forgotData.newPassword !== forgotData.confirmPassword) {
                    setResetStatus({ type: 'error', message: 'New passwords do not match' });
                    return;
                  }
                  setIsResetting(true);
                  setResetStatus({ type: null, message: '' });

                  try {
                    const res = await fetch('/api/auth/update-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: forgotData.email,
                        oldPassword: forgotData.oldPassword,
                        newPassword: forgotData.newPassword
                      })
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setResetStatus({ type: 'success', message: 'Password updated successfully!' });
                      setTimeout(() => setIsForgotModalOpen(false), 2000);
                    } else {
                      setResetStatus({ type: 'error', message: data.error || 'Failed to update password' });
                    }
                  } catch (err) {
                    setResetStatus({ type: 'error', message: 'An error occurred' });
                  } finally {
                    setIsResetting(false);
                  }
                }}
                disabled={isResetting || !forgotData.email || !forgotData.oldPassword || !forgotData.newPassword}
                className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isResetting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
