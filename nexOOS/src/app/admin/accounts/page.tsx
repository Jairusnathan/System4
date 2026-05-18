'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Shield,
  Trash2,
  User,
  X,
  TriangleAlert,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning';
  onConfirm: () => void;
};

function ConfirmModal({ dialog, onClose }: { dialog: ConfirmDialog; onClose: () => void }) {
  const isDanger = dialog.variant === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden">
        {/* Top accent */}
        <div className={`h-1 w-full ${isDanger ? 'bg-red-500' : 'bg-amber-500'}`} />
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${isDanger ? 'bg-red-50' : 'bg-amber-50'}`}>
            <TriangleAlert className={`w-6 h-6 ${isDanger ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1">{dialog.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{dialog.message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { dialog.onConfirm(); onClose(); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type StaffAccount = {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  is_onboarded: boolean;
  created_at: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

export default function AdminAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    role: 'staff',
  });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dialog,  setDialog]  = useState<ConfirmDialog | null>(null);
  const [myId, setMyId] = useState('');
  const [myRole, setMyRole] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/');
      return;
    }

    const payload = decodeJwtPayload(token);
    const role = (payload?.staffRole as string) ?? '';
    if (role !== 'super_admin' && role !== 'admin') {
      router.replace('/admin');
      return;
    }

    setMyId((payload?.userId as string) ?? '');
    setMyRole(role);
    fetchAccounts(token);
  }, [router]);

  const fetchAccounts = async (token?: string) => {
    const t = token ?? getAccessToken();
    if (!t) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setAccounts(data?.data ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    const token = getAccessToken();
    if (!token) return;

    if (!form.first_name.trim() || !form.last_name.trim() || !form.username.trim() || !form.password.trim()) {
      showToast('error', 'All fields are required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        showToast('success', `Account created for @${form.username}`);
        setForm({ first_name: '', last_name: '', username: '', password: '', role: 'staff' });
        setShowForm(false);
        fetchAccounts();
      } else {
        showToast('error', data?.message ?? 'Failed to create account');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const removeAccount = (id: string, username: string) => {
    setDialog({
      title: 'Delete Account',
      message: `This will permanently delete the account for @${username}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => doRemoveAccount(id, username),
    });
  };

  const doRemoveAccount = async (id: string, username: string) => {
    const token = getAccessToken();
    if (!token) return;

    setRemoving(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast('success', `Deleted account for @${username}`);
        setAccounts(prev => prev.filter(a => a.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message ?? 'Failed to delete');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setRemoving(null);
    }
  };

  const toggleActive = (id: string, name: string, currentActive: boolean) => {
    setDialog({
      title: currentActive ? 'Deactivate Account' : 'Activate Account',
      message: currentActive
        ? `${name}'s account will be deactivated and they won't be able to log in.`
        : `${name}'s account will be reactivated and they'll regain access.`,
      confirmLabel: currentActive ? 'Deactivate' : 'Activate',
      variant: currentActive ? 'danger' : 'warning',
      onConfirm: () => doToggleActive(id, currentActive),
    });
  };

  const doToggleActive = async (id: string, currentActive: boolean) => {
    const token = getAccessToken();
    if (!token) return;

    setToggling(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/toggle-active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        showToast('success', `Account ${data.is_active ? 'activated' : 'deactivated'} successfully`);
        setAccounts(prev => prev.map(a => (a.id === id ? { ...a, is_active: data.is_active } : a)));
      } else {
        showToast('error', data?.message ?? 'Failed to update');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setToggling(null);
    }
  };

  const closeDialog = () => setDialog(null);

  const isSuperAdmin = myRole === 'super_admin';
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a.is_active).length;
  const pendingAccounts = accounts.filter(a => a.is_onboarded === false).length;
  const adminAccounts = accounts.filter(a => a.role === 'admin').length;
  const staffAccounts = accounts.filter(a => a.role === 'staff').length;
  const inactiveAccounts = totalAccounts - activeAccounts;

  const roleLabel = (role: string) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    return 'Admin Staff';
  };

  const roleIcon = (role: string) => {
    if (role === 'super_admin') return <Crown className="h-4 w-4 text-amber-500" />;
    if (role === 'admin') return <Shield className="h-4 w-4 text-blue-500" />;
    return <User className="h-4 w-4 text-slate-400" />;
  };

  const roleBadgeClass = (role: string) => {
    if (role === 'super_admin') return 'border border-amber-100 bg-amber-50 text-amber-700';
    if (role === 'admin') return 'border border-blue-100 bg-blue-50 text-blue-700';
    return 'border border-slate-200 bg-slate-100 text-slate-600';
  };

  return (
    <div className="w-full space-y-5">
      {dialog && <ConfirmModal dialog={dialog} onClose={closeDialog} />}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-4 text-sm font-bold ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
            <Shield className="h-3.5 w-3.5" /> Role Permissions
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: 'Super Admin',
                icon: Crown,
                color: 'text-amber-500',
                bg: 'border-amber-100 bg-amber-50',
                perms: ['Add accounts', 'Delete accounts', 'Activate / Deactivate', 'Full access - 1 only'],
              },
              {
                label: 'Admin',
                icon: Shield,
                color: 'text-blue-500',
                bg: 'border-blue-100 bg-blue-50',
                perms: ['Add accounts', 'Activate / Deactivate', 'Cannot delete', 'Cannot touch Super Admin'],
              },
              {
                label: 'Admin Staff',
                icon: User,
                color: 'text-slate-500',
                bg: 'border-slate-200 bg-slate-50',
                perms: ['No access to this tab', 'All other sections'],
              },
            ].map(({ label, icon: Icon, color, bg, perms }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <p className={`mb-3 flex items-center gap-1.5 text-xs font-black ${color}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </p>
                <ul className="space-y-1">
                  {perms.map(p => (
                    <li key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">Account Overview</p>
              <p className="mt-0.5 text-xs text-slate-400">Quick summary of administrator access</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2 text-right">
              <p className="text-2xl font-black text-blue-600">{totalAccounts}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">total accounts</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active</p>
              <p className="mt-1 text-lg font-black text-slate-900">{activeAccounts}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inactive</p>
              <p className="mt-1 text-lg font-black text-slate-900">{inactiveAccounts}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admins</p>
              <p className="mt-1 text-lg font-black text-slate-900">{adminAccounts}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff</p>
              <p className="mt-1 text-lg font-black text-slate-900">{staffAccounts}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending Setup</p>
            <p className="mt-1 text-sm font-bold text-amber-800">
              {pendingAccounts} account{pendingAccounts === 1 ? '' : 's'} still need first-time onboarding
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-black text-slate-900">Staff Accounts</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add Account
          </button>
        </div>

        {showForm && (
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <p className="mb-4 text-sm font-black text-slate-900">New Staff Account</p>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <input
                type="text"
                placeholder="Username (e.g. juan.dela.cruz)"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              <p className="-mt-1 ml-1 text-[10px] text-slate-400">
                Staff will use this to log in. They will set their email during first login.
              </p>

              <input
                type="password"
                placeholder="Temporary password (min 6 characters)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Role
                </label>
                <div className="flex flex-col gap-2 md:flex-row">
                  {[
                    { value: 'staff', label: 'Admin Staff', icon: User, desc: 'No accounts tab' },
                    ...(isSuperAdmin ? [{ value: 'admin', label: 'Admin', icon: Shield, desc: 'Can add & inactivate' }] : []),
                  ].map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: value }))}
                      className={`flex flex-1 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        form.role === value
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          form.role === value ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <div>
                        <p className={`text-xs font-black ${form.role === value ? 'text-blue-700' : 'text-slate-700'}`}>
                          {label}
                        </p>
                        <p className="text-[10px] text-slate-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={createAccount}
                  disabled={creating}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setForm({ first_name: '', last_name: '', username: '', password: '', role: 'staff' });
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No accounts found.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {accounts.map(a => {
              const isSelf = a.id === myId;
              const isSuperAdminAcc = a.role === 'super_admin';
              const canDelete = isSuperAdmin && !isSelf && !isSuperAdminAcc;
              const canToggle = !isSelf && !isSuperAdminAcc;

              return (
                <div
                  key={a.id}
                  className={`flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:gap-4 ${!a.is_active ? 'opacity-60' : ''}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isSuperAdminAcc ? 'bg-amber-50' : a.role === 'admin' ? 'bg-blue-50' : 'bg-slate-100'
                    }`}
                  >
                    {roleIcon(a.role)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{a.full_name}</p>
                      {!a.is_active && (
                        <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-500">
                          Inactive
                        </span>
                      )}
                      {a.is_onboarded === false && (
                        <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">
                          Pending Setup
                        </span>
                      )}
                    </div>
                    <p className="break-all text-xs text-slate-400">
                      {a.username ? `@${a.username}` : ''}
                      {a.username && a.email ? ' · ' : ''}
                      {a.email ?? ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0">
                    <span className="shrink-0 text-xs font-mono text-slate-400">{a.staff_number}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${roleBadgeClass(a.role)}`}>
                      {roleLabel(a.role)}
                    </span>
                    <p className="shrink-0 text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleDateString('en-PH')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelf && <span className="px-2 text-[10px] font-bold text-slate-400">You</span>}

                    {canToggle && (
                      <button
                        onClick={() => toggleActive(a.id, a.full_name, a.is_active)}
                        disabled={toggling === a.id}
                        title={a.is_active ? 'Deactivate account' : 'Activate account'}
                        className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${
                          a.is_active
                            ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-700'
                            : 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        }`}
                      >
                        {toggling === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : a.is_active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => removeAccount(a.id, a.username)}
                        disabled={removing === a.id}
                        title="Delete account"
                        className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {removing === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
