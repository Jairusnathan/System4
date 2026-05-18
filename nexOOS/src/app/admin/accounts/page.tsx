'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Shield, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type AdminAccount = { id: string; full_name: string; email: string; is_admin: boolean; created_at: string };

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAccounts = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/accounts', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAccounts(data?.data ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const createAccount = async () => {
    const token = getAccessToken();
    if (!token) return;
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      showToast('error', 'All fields are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', `Admin account created for ${form.email}`);
        setForm({ full_name: '', email: '', password: '' });
        setShowForm(false);
        fetchAccounts();
      } else {
        showToast('error', data?.message ?? data?.error ?? 'Failed to create account');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const removeAccount = async (id: string, email: string) => {
    if (!confirm(`Remove admin access for ${email}?`)) return;
    const token = getAccessToken();
    if (!token) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('success', `Removed admin access for ${email}`);
        setAccounts(prev => prev.filter(a => a.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message ?? 'Failed to remove admin');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-4 rounded-2xl text-sm font-bold ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Admin accounts list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-900">Admin Accounts</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Admin
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="px-6 py-5 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-black text-slate-900 mb-4">New Admin Account</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={createAccount}
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No admin accounts found.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {accounts.map(a => (
              <div key={a.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{a.full_name}</p>
                  <p className="text-xs text-slate-400">{a.email}</p>
                </div>
                <p className="hidden sm:block text-xs text-slate-400 shrink-0">
                  {new Date(a.created_at).toLocaleDateString('en-PH')}
                </p>
                <button
                  onClick={() => removeAccount(a.id, a.email)}
                  disabled={removing === a.id}
                  className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Remove admin access"
                >
                  {removing === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
