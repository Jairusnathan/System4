'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill, Mail, ArrowRight, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { getAccessToken, storeAccessToken } from '@/lib/auth-client';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch { return null; }
}

type Step = 'email' | 'otp' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const [step,       setStep]       = useState<Step>('email');
  const [email,      setEmail]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [checking,   setChecking]   = useState(true);
  const [error,      setError]      = useState('');
  const [staffName,  setStaffName]  = useState('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.replace('/'); return; }
    const payload = decodeJwtPayload(token);
    if (!payload?.isAdmin) { router.replace('/'); return; }
    // Already onboarded — send to admin
    if (payload?.isOnboarded !== false) { router.replace('/admin'); return; }
    setStaffName((payload?.email as string) ?? 'Staff');
    setChecking(false);
  }, [router]);

  const handleRequestEmail = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/staff/request-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailToken(data.emailToken);
        setStep('otp');
      } else {
        setError(data?.message ?? 'Failed to send verification code');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/staff/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, code: otp, emailToken }),
      });
      const data = await res.json();
      if (res.ok) {
        // Store the new token which has isOnboarded: true
        if (data.token) storeAccessToken(data.token);
        setStep('done');
        setTimeout(() => { window.location.replace('/admin'); }, 1800);
      } else {
        setError(data?.message ?? 'Invalid verification code');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    setOtp('');
    setError('');
    await handleRequestEmail();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-2xl shadow-blue-600/40">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/30">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">PharmaQuick</span>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-t-[2.5rem]" />

          {/* Step: done */}
          {step === 'done' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Account Ready!</h2>
              <p className="text-slate-500 text-sm">Your email has been verified. Redirecting you to the dashboard...</p>
              <div className="mt-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          ) : step === 'email' ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1.5">Welcome, {staffName.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}!</h2>
                <p className="text-slate-500 text-sm leading-relaxed">Before you begin, please set up your email address. This will be used for account recovery and notifications.</p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2.5 text-red-600 text-sm font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Your Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRequestEmail()}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleRequestEmail}
                  disabled={loading || !email.trim()}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Send Verification Code <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* OTP step */}
              <div className="mb-8">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1.5">Check Your Email</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  We sent a 6-digit code to <span className="font-bold text-slate-700">{email}</span>. Enter it below to verify your email.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2.5 text-red-600 text-sm font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                    placeholder="000000"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Verify & Continue <ArrowRight className="w-4 h-4" /></>)}
                </button>

                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="w-full py-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors disabled:opacity-60"
                >
                  Resend Code
                </button>

                <button
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          PharmaQuick Admin Console · Account Setup
        </p>
      </div>
    </main>
  );
}
