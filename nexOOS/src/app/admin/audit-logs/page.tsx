'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Filter,
  Loader2,
  LogIn,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  ShoppingBag,
  User,
  Users,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type AuditLog = {
  id: string;
  log_number: string;
  staff_id: string | null;
  staff_name: string;
  staff_role: string | null;
  action: string;
  category: string;
  details: string | null;
  entity_id: string | null;
  created_at: string;
};

type CategoryCounts = Record<string, number>;

const CATEGORIES = [
  { key: 'all', label: 'All', icon: ScrollText },
  { key: 'auth', label: 'Auth', icon: LogIn },
  { key: 'orders', label: 'Orders', icon: ShoppingBag },
  { key: 'returns', label: 'Returns', icon: RotateCcw },
  { key: 'accounts', label: 'Accounts', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'profile', label: 'Profile', icon: User },
];

const CAT_STYLES: Record<string, { bg: string; text: string; border: string; fill: string }> = {
  auth: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', fill: 'bg-violet-500' },
  orders: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', fill: 'bg-blue-500' },
  returns: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', fill: 'bg-amber-500' },
  accounts: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', fill: 'bg-green-500' },
  settings: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', fill: 'bg-slate-500' },
  profile: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100', fill: 'bg-pink-500' },
  general: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', fill: 'bg-slate-500' },
};

const CAT_ICON_BG: Record<string, string> = {
  auth: 'bg-violet-100',
  orders: 'bg-blue-100',
  returns: 'bg-amber-100',
  accounts: 'bg-green-100',
  settings: 'bg-slate-200',
  profile: 'bg-pink-100',
  general: 'bg-slate-200',
};

const PAGE_SIZE = 20;

function CategoryIcon({ category }: { category: string }) {
  const bg = CAT_ICON_BG[category] ?? 'bg-slate-100';
  const props = { className: 'h-4 w-4' };
  const icon =
    category === 'auth' ? <LogIn {...props} /> :
    category === 'orders' ? <ShoppingBag {...props} /> :
    category === 'returns' ? <RotateCcw {...props} /> :
    category === 'accounts' ? <Users {...props} /> :
    category === 'settings' ? <Settings {...props} /> :
    category === 'profile' ? <User {...props} /> :
    <ScrollText {...props} />;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
      {icon}
    </div>
  );
}

function roleBadgeClass(role: string | null) {
  if (role === 'super_admin') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (role === 'admin') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function roleLabel(role: string | null) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'Staff';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [catCounts, setCatCounts] = useState<CategoryCounts>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const total30d = Object.values(catCounts).reduce((a, b) => a + b, 0);
  const visibleCategories = CATEGORIES
    .filter(({ key }) => key !== 'all')
    .map(({ key, label }) => ({ key, label, count: catCounts[key] ?? 0 }))
    .filter(item => item.count > 0);

  const fetchLogs = useCallback(async (cat: string, q: string, pg: number) => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((pg - 1) * PAGE_SIZE),
      });
      if (cat && cat !== 'all') params.set('category', cat);
      if (q) params.set('search', q);

      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data?.data ?? []);
      setTotal(data?.total ?? 0);
      if (data?.categoryCounts) setCatCounts(data.categoryCounts);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(category, search, page);
  }, [category, search, page, fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleCategory = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="w-full space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Events (30d)', value: total30d, color: 'text-slate-900', sub: 'all categories' },
          { label: 'Auth Events', value: catCounts.auth ?? 0, color: 'text-violet-600', sub: 'logins & logouts' },
          {
            label: 'Order Changes',
            value: (catCounts.orders ?? 0) + (catCounts.returns ?? 0),
            color: 'text-blue-600',
            sub: 'orders & returns',
          },
          {
            label: 'System Changes',
            value: (catCounts.accounts ?? 0) + (catCounts.settings ?? 0),
            color: 'text-green-600',
            sub: 'accounts & settings',
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {CATEGORIES.map(({ key, label }) => {
            const count = key === 'all' ? total30d : (catCounts[key] ?? 0);
            return (
              <button
                key={key}
                onClick={() => handleCategory(key)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  category === key
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      category === key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch} className="flex w-full gap-2 xl:w-auto xl:min-w-[360px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
          >
            <Filter className="h-3 w-3" /> Filter
          </button>
        </form>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="min-h-[420px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <p className="text-sm font-black text-slate-900">Activity Log</p>
            <p className="text-xs text-slate-400">{total.toLocaleString()} total entries</p>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center">
              <ScrollText className="mx-auto mb-3 h-8 w-8 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">No log entries found</p>
              <p className="mt-1 text-xs text-slate-300">Actions will appear here as they happen</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map(log => {
                const style = CAT_STYLES[log.category] ?? CAT_STYLES.general;
                return (
                  <div
                    key={log.id}
                    className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-slate-50/50 lg:flex-row lg:items-start lg:gap-4"
                  >
                    <CategoryIcon category={log.category} />

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{log.staff_name}</p>
                        {log.staff_role && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${roleBadgeClass(log.staff_role)}`}
                          >
                            {roleLabel(log.staff_role)}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${style.bg} ${style.text} ${style.border}`}
                        >
                          {log.category.charAt(0).toUpperCase() + log.category.slice(1)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-700">{log.action}</p>
                      {log.details && <p className="mt-0.5 break-words text-xs text-slate-400">{log.details}</p>}
                    </div>

                    <div className="shrink-0 lg:min-w-[108px] lg:text-right">
                      <p className="text-xs font-medium text-slate-500">
                        {new Date(log.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleTimeString('en-PH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="mt-0.5 text-[10px] font-mono text-slate-300">{log.log_number}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = page <= 3 ? i + 1 : page + i - 2;
                  if (pg < 1 || pg > totalPages) return null;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                        pg === page
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">Audit Summary</p>
                <p className="mt-0.5 text-xs text-slate-400">Breakdown of tracked activity</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-900">{total30d.toLocaleString()}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">events in 30 days</p>
              </div>
            </div>

            <div className="space-y-3">
              {visibleCategories.length > 0 ? (
                visibleCategories.map(({ key, label, count }) => {
                  const ratio = total30d > 0 ? Math.max(8, Math.round((count / total30d) * 100)) : 0;
                  const style = CAT_STYLES[key] ?? CAT_STYLES.general;

                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-700">{label}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${style.bg} ${style.text} ${style.border}`}
                        >
                          {count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${style.fill}`} style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center">
                  <p className="text-sm font-bold text-slate-500">No activity yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Category totals will appear once admins start using the console.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-900">Current View</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category Filter</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {CATEGORIES.find(item => item.key === category)?.label ?? 'All'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Query</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{search || 'No keyword applied'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{page}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pages</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{totalPages}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
