'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, Truck, ShoppingCart, Mail, Power, AlertTriangle } from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type Settings = Record<string, string>;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [original, setOriginal] = useState<Settings>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSettings(d?.data ?? {}); setOriginal(d?.data ?? {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) { setSaved(true); setOriginal(settings); setTimeout(() => setSaved(false), 3000); }
    } catch { } finally { setSaving(false); }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);
  const oosEnabled = settings['oos_enabled'] === 'true';

  if (loading) {
    return <div className="flex items-center justify-center h-60"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">

      {/* ── OOS Master Toggle ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${oosEnabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`p-2.5 rounded-xl shrink-0 ${oosEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
          <Power className={`w-5 h-5 ${oosEnabled ? 'text-green-600' : 'text-red-500'}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-black ${oosEnabled ? 'text-green-800' : 'text-red-800'}`}>
            Online Ordering is {oosEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <p className={`text-xs mt-0.5 ${oosEnabled ? 'text-green-600' : 'text-red-500'}`}>
            {oosEnabled ? 'Customers can browse and place orders online.' : 'The OOS is currently offline. Customers cannot place orders.'}
          </p>
        </div>
        <button
          onClick={() => set('oos_enabled', oosEnabled ? 'false' : 'true')}
          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${oosEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${oosEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* ── Unsaved changes ───────────────────────────────────────────────────── */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-700 flex-1">You have unsaved changes.</p>
          <button onClick={() => setSettings(original)} className="text-xs font-bold text-amber-600 hover:text-amber-800">Discard</button>
        </div>
      )}

      {/* ── Two column grid ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Delivery Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
              <Truck className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Delivery Settings</p>
              <p className="text-xs text-slate-400">Fees and thresholds for delivery</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {/* Delivery Fee */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Fee</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={settings['delivery_fee'] ?? ''}
                  onChange={e => set('delivery_fee', e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Fixed charge added to every order</p>
            </div>

            {/* Free Delivery Min */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Free Delivery Minimum</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={settings['free_delivery_min'] ?? ''}
                  onChange={e => set('free_delivery_min', e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Orders at or above this amount get free delivery</p>
            </div>

            {/* Preview pill */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
              <span className="font-bold">Preview: </span>
              Orders under <span className="font-black">₱{settings['free_delivery_min'] ?? '500'}</span> pay a{' '}
              <span className="font-black">₱{settings['delivery_fee'] ?? '50'}</span> delivery fee.
            </div>
          </div>
        </div>

        {/* Order Rules */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Order Rules</p>
              <p className="text-xs text-slate-400">Limits for online orders</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {/* Min order */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Minimum Order Amount</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={settings['min_order_amount'] ?? ''}
                  onChange={e => set('min_order_amount', e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Cart must reach this total before checkout is allowed</p>
            </div>

            {/* Max items */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Max Items Per Order</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings['max_order_items'] ?? ''}
                  onChange={e => set('max_order_items', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">items</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Maximum number of different products per order</p>
            </div>

          </div>
        </div>

        {/* Contact Info — full width */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
              <Mail className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Contact Information</p>
              <p className="text-xs text-slate-400">Shown on emails and customer-facing pages</p>
            </div>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Support Email</label>
              <input
                type="email"
                value={settings['contact_email'] ?? ''}
                onChange={e => set('contact_email', e.target.value)}
                placeholder="support@pharmaquick.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <p className="text-xs text-slate-400 mt-1.5">Displayed on order confirmation emails</p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Support Phone</label>
              <input
                type="text"
                value={settings['contact_phone'] ?? ''}
                onChange={e => set('contact_phone', e.target.value)}
                placeholder="+63 900 000 0000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <p className="text-xs text-slate-400 mt-1.5">Displayed on the customer contact page</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center gap-3 sticky bottom-4">
        <div className="flex-1">
          {saved ? (
            <p className="text-sm font-bold text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Settings saved successfully.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              {hasChanges ? 'You have unsaved changes.' : 'All settings are up to date.'}
            </p>
          )}
        </div>
        <button
          onClick={() => setSettings(original)}
          disabled={!hasChanges || saving}
          className="px-4 py-2 text-sm font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-colors"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm shadow-blue-100"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
