'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2, Save, CheckCircle2, AlertCircle,
  Eye, EyeOff, Shield, User, Mail, Hash, Calendar, Lock,
} from 'lucide-react';
import { getAccessToken, storeAdminDisplayName } from '@/lib/auth-client';

type AdminProfile = {
  id: string;
  staff_number: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  username: string | null;
  email: string | null;
  created_at: string;
};

type Toast = { type: 'success' | 'error'; message: string } | null;

export default function AdminProfilePage() {
  const [profile,    setProfile]    = useState<AdminProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<Toast>(null);

  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPw,  setChangingPw]  = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch('/api/admin/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setProfile(d); setFirstName(d.first_name ?? ''); setLastName(d.last_name ?? ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    const token = getAccessToken();
    if (!token || !firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        // Sync name to sidebar
        const fullName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || data.full_name || '';
        storeAdminDisplayName(fullName);
        window.dispatchEvent(new CustomEvent('admin-name-updated', { detail: fullName }));
        showToast('success', 'Profile updated successfully.');
      }
      else showToast('error', data?.message ?? 'Failed to update profile.');
    } catch { showToast('error', 'Network error.'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { showToast('error', 'All fields are required.'); return; }
    if (newPw !== confirmPw) { showToast('error', 'New passwords do not match.'); return; }
    if (newPw.length < 6) { showToast('error', 'New password must be at least 6 characters.'); return; }
    const token = getAccessToken();
    if (!token) return;
    setChangingPw(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Password changed successfully.');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      } else showToast('error', data?.message ?? data?.error ?? 'Incorrect current password.');
    } catch { showToast('error', 'Network error.'); }
    finally { setChangingPw(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-60"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;
  }

  const fn = profile?.first_name ?? '';
  const ln = profile?.last_name ?? '';
  const initials = fn && ln ? (fn[0] + ln[0]).toUpperCase() : (profile?.full_name ?? 'AD').slice(0, 2).toUpperCase();
  const nameChanged = firstName.trim() !== (profile?.first_name ?? '') || lastName.trim() !== (profile?.last_name ?? '');

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* LEFT: Admin card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Gradient banner */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-6 pt-8 pb-12 relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl mx-auto">
                <span className="text-3xl font-black text-white">{initials}</span>
              </div>
            </div>

            {/* Info below banner */}
            <div className="px-6 pt-4 pb-6 text-center border-b border-slate-100">
              <p className="text-xl font-black text-slate-900">{profile?.full_name}</p>
              {profile?.username && <p className="text-sm text-slate-400 mt-0.5">@{profile.username}</p>}
              {profile?.email && <p className="text-xs text-slate-400">{profile.email}</p>}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-full flex items-center gap-1 border border-blue-100">
                  <Shield className="w-3 h-3" /> Administrator
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-black rounded-full border border-slate-200">
                  {profile?.staff_number}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              {[
                { icon: Hash,     label: 'Staff ID',    value: profile?.staff_number ?? '—' },
                { icon: User,     label: 'Username',    value: profile?.username ? `@${profile.username}` : '—' },
                { icon: Mail,     label: 'Email',       value: profile?.email ?? 'Not set yet' },
                { icon: Shield,   label: 'Role',        value: 'Administrator' },
                { icon: Calendar, label: 'Member Since', value: profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="p-1.5 bg-slate-100 rounded-lg shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Edit forms */}
        <div className="lg:col-span-2 space-y-4">

          {/* Edit name */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Edit Profile</p>
                <p className="text-xs text-slate-400">Update your display name</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-colors"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">This name appears in the admin sidebar and top navigation bar.</p>

              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-slate-100">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !firstName.trim() || !lastName.trim() || !nameChanged}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-100"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
                {nameChanged && (
                  <button onClick={() => { setFirstName(profile?.first_name ?? ''); setLastName(profile?.last_name ?? ''); }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                    Discard
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Change Password</p>
                <p className="text-xs text-slate-400">Use a strong password you don&apos;t use elsewhere</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid sm:grid-cols-1 gap-4">
                {/* Current */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Password</label>
                  <div className="relative">
                    <input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-colors" />
                    <button onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New + Confirm side by side */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                    <div className="relative">
                      <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-colors" />
                      <button onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full px-4 py-3 pr-11 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
                          confirmPw && newPw
                            ? newPw === confirmPw
                              ? 'border-green-400 focus:ring-green-400/20'
                              : 'border-red-300 focus:ring-red-400/20'
                            : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400/20'
                        }`} />
                      <button onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Match indicator */}
                {confirmPw && newPw && (
                  <p className={`text-xs font-bold flex items-center gap-1.5 ${newPw === confirmPw ? 'text-green-600' : 'text-red-500'}`}>
                    {newPw === confirmPw
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</>
                      : <><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-slate-100">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPw || !currentPw || !newPw || !confirmPw || newPw !== confirmPw}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Update Password
                </button>
                {(currentPw || newPw || confirmPw) && (
                  <button onClick={() => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
