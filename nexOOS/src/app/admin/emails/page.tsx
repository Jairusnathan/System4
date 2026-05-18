'use client';

import React, { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

const EMAIL_TYPES = [
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'order_confirmation', label: 'Order Confirmation' },
  { value: 'order_cancellation', label: 'Order Cancellation' },
  { value: 'return_request', label: 'Return Request Confirmation' },
  { value: 'password_reset', label: 'Password Reset Code' },
  { value: 'account_locked', label: 'Account Locked Notice' },
];

export default function AdminEmailsPage() {
  const [testEmail, setTestEmail] = useState('');
  const [emailType, setEmailType] = useState('welcome');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) return;
    const token = getAccessToken();
    if (!token) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: testEmail.trim(), type: emailType }),
      });
      if (res.ok) {
        setResult({ type: 'success', message: `Test email sent to ${testEmail}` });
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ type: 'error', message: data?.error ?? 'Failed to send test email. Check SMTP settings in .env.' });
      }
    } catch {
      setResult({ type: 'error', message: 'Unable to reach the backend.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">Email Notifications</p>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              PharmaQuick sends automated emails for order confirmations, cancellations, return requests, welcome messages, and password resets.
              Configure SMTP settings in <code className="bg-blue-100 px-1 rounded font-mono">greenovate-be/order-service/.env</code> and <code className="bg-blue-100 px-1 rounded font-mono">greenovate-be/auth-service/.env</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Email trigger list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-black text-slate-900">Automated Email Triggers</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { event: 'Customer registers', template: 'Welcome Email', service: 'auth-service' },
            { event: 'Order placed', template: 'Order Confirmation', service: 'order-service' },
            { event: 'Order cancelled', template: 'Cancellation + Reason', service: 'order-service' },
            { event: 'Return request submitted', template: 'Return Request Confirmation', service: 'order-service' },
            { event: 'Password reset requested', template: 'Reset Code (6-digit OTP)', service: 'auth-service' },
            { event: 'Account locked (5 failed logins)', template: 'Account Locked Notice', service: 'auth-service' },
          ].map(({ event, template, service }) => (
            <div key={event} className="px-6 py-3 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{event}</p>
                <p className="text-xs text-slate-400">Template: {template}</p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">{service}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Send test email */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="font-black text-slate-900 mb-4">Send Test Email</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Recipient Email</label>
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Type</label>
            <select
              value={emailType}
              onChange={e => setEmailType(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {EMAIL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${result.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {result.message}
            </div>
          )}
          <button
            onClick={sendTestEmail}
            disabled={!testEmail.trim() || sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test
          </button>
        </div>
      </div>
    </div>
  );
}
