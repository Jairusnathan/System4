'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type Settings = Record<string, string>;

const FIELDS = [
  { key: 'delivery_fee',      label: 'Delivery Fee (₱)',          type: 'number', hint: 'Fixed delivery charge per order' },
  { key: 'free_delivery_min', label: 'Free Delivery Min Order (₱)', type: 'number', hint: 'Orders above this amount get free delivery' },
  { key: 'min_order_amount',  label: 'Minimum Order Amount (₱)',   type: 'number', hint: 'Minimum cart total to proceed to checkout' },
  { key: 'max_order_items',   label: 'Max Items Per Order',         type: 'number', hint: 'Maximum number of different products per order' },
  { key: 'order_cutoff_time', label: 'Order Cutoff Time',           type: 'text',   hint: 'Orders after this time are queued for next day (HH:MM)' },
  { key: 'contact_email',     label: 'Support Email',               type: 'email',  hint: 'Displayed on order confirmation emails' },
  { key: 'contact_phone',     label: 'Support Phone',               type: 'text',   hint: 'Displayed on contact pages' },
  { key: 'oos_enabled',       label: 'OOS Online Ordering',         type: 'toggle', hint: 'Toggle the entire online ordering system on/off' },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSettings(d?.data ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="font-black text-slate-900 mb-5">OOS Configuration</h2>
        <div className="space-y-4">
          {FIELDS.map(({ key, label, type, hint }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
              {type === 'toggle' ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setSettings(s => ({ ...s, [key]: s[key] === 'true' ? 'false' : 'true' }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${settings[key] === 'true' ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{settings[key] === 'true' ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : (
                <input
                  type={type}
                  value={settings[key] ?? ''}
                  onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              )}
              <p className="text-xs text-slate-400 mt-1">{hint}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
