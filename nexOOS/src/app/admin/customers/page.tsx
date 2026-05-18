'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, Loader2, User } from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const LIMIT = 25;

  const fetchCustomers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCustomers(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-black text-slate-900">Customers <span className="text-slate-400 font-normal text-sm ml-1">({total})</span></h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No customers found.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {customers.map(c => (
              <div key={c.id}>
                <div className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.email}</p>
                  </div>
                  <p className="hidden sm:block text-xs text-slate-400 shrink-0">{new Date(c.created_at).toLocaleDateString('en-PH')}</p>
                  {c.is_admin && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold shrink-0">Admin</span>
                  )}
                  <button
                    onClick={() => setExpanded(prev => prev === c.id ? null : c.id)}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {expanded === c.id && (
                  <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                    <div className="grid sm:grid-cols-3 gap-3 pt-4 text-sm">
                      <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p><p className="text-slate-700">{c.phone ?? '—'}</p></div>
                      <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Birthday</p><p className="text-slate-700">{c.birthday ?? '—'}</p></div>
                      <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</p><p className="text-slate-700">{c.gender ?? '—'}</p></div>
                      <div className="sm:col-span-3"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Customer ID</p><p className="text-slate-500 text-xs font-mono">{c.id}</p></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
