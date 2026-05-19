'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, RotateCcw, Users, Package,
  MapPin, Settings, Shield, Pill, LogOut, Menu,
  X, Bell, ChevronRight, Clock, ScrollText,
} from 'lucide-react';
import { getAccessToken, clearAccessToken, getAdminDisplayName, clearAdminDisplayName } from '@/lib/auth-client';

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',            label: 'Dashboard',        icon: LayoutDashboard },
    ],
  },
  {
    label: 'Orders',
    items: [
      { href: '/admin/orders',     label: 'All Orders',       icon: ShoppingBag },
      { href: '/admin/returns',    label: 'Returns & Refunds',icon: RotateCcw },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/customers',  label: 'Customers',        icon: Users },
      { href: '/admin/products',   label: 'Product Catalog',  icon: Package },
      { href: '/admin/branches',   label: 'Branches',         icon: MapPin },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/settings',     label: 'OOS Settings',   icon: Settings },
      { href: '/admin/accounts',     label: 'User Accounts',  icon: Shield },
      { href: '/admin/audit-logs',   label: 'Audit Trail',    icon: ScrollText },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/admin':            'Overview of your online ordering system',
  '/admin/orders':     'View and manage all customer orders',
  '/admin/returns':    'Process return and refund requests',
  '/admin/customers':  'Browse registered customer accounts',
  '/admin/products':   'Read-only view of the product catalog',
  '/admin/branches':   'View branch information and hours',
  '/admin/analytics':  'Search trends and product view data',
  '/admin/emails':     'Automated email triggers and test sender',
  '/admin/settings':   'Configure online ordering system options',
  '/admin/accounts':   'Manage administrator accounts',
  '/admin/audit-logs': 'Complete history of all admin actions',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getInitials(identifier: string) {
  const base = identifier.includes('@') ? identifier.split('@')[0] : identifier;
  const parts = base.replace(/[._-]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (base ?? 'AD').slice(0, 2).toUpperCase();
}

function formatName(identifier: string) {
  const base = identifier.includes('@') ? identifier.split('@')[0] : identifier;
  return (
    base
      ?.replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()) || 'Admin'
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminName,     setAdminName]     = useState('Admin');
  const [staffRole,     setStaffRole]     = useState<'super_admin' | 'admin' | 'staff'>('staff');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [checked,       setChecked]       = useState(false);
  const [dateStr,       setDateStr]       = useState('');
  const [bellOpen,      setBellOpen]      = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingReturns,setPendingReturns]= useState(0);
  const [recentPending, setRecentPending] = useState<{id:string;receiptNumber?:string;date:string}[]>([]);
  const [recentReturns, setRecentReturns] = useState<{id:string;receipt_number:string;reason:string}[]>([]);

  // Auto-logout after 15 minutes of inactivity
  useEffect(() => {
    const TIMEOUT_MS = 15 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        // Log inactivity logout before clearing the token
        const token = getAccessToken();
        if (token) {
          try {
            await fetch('/api/admin/audit-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                action: 'Automatically logged out due to 15 minutes of inactivity',
                category: 'auth',
              }),
            });
          } catch { /* non-fatal */ }
        }
        clearAccessToken();
        clearAdminDisplayName();
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        window.location.replace('/?session=expired');
      }, TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start the timer

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, []);

  // Listen for profile name updates from the profile page
  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      if (name) setAdminName(name);
    };
    window.addEventListener('admin-name-updated', handler);
    return () => window.removeEventListener('admin-name-updated', handler);
  }, []);

  // Clock — update every minute
  useEffect(() => {
    const tick = () =>
      setDateStr(
        new Date().toLocaleDateString('en-PH', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })
      );
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Auth check
  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.replace('/'); return; }
    const payload = decodeJwtPayload(token);
    if (!payload?.isAdmin) {
      router.replace('/');
      return;
    }
    // Redirect unboarded staff to onboarding page
    if (payload?.isOnboarded === false) {
      router.replace('/onboarding');
      return;
    }
    const email = (payload?.email as string) ?? '';
    const rawRole = (payload?.staffRole as string) ?? 'staff';
    const role: 'super_admin' | 'admin' | 'staff' = rawRole === 'super_admin' ? 'super_admin' : rawRole === 'admin' ? 'admin' : 'staff';
    setAdminEmail(email);
    const storedName = getAdminDisplayName();
    const jwtFullName = (payload?.fullName as string) ?? '';
    setAdminName(storedName || jwtFullName || formatName(email));
    setStaffRole(role);
    setChecked(true);

    // Fetch notification data (reuse token already declared above)
    {
      const h = { Authorization: `Bearer ${token}` };
      Promise.all([
        fetch('/api/admin/stats', { headers: h }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/orders?status=Processing&limit=4', { headers: h }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/returns?status=pending&limit=4', { headers: h }).then(r => r.json()).catch(() => ({})),
      ]).then(([stats, ords, rets]) => {
        setPendingOrders(stats?.pendingOrders ?? 0);
        setPendingReturns(stats?.pendingReturns ?? 0);
        setRecentPending(ords?.data ?? []);
        setRecentReturns(rets?.data ?? []);
      }).catch(() => {});
    }
  }, [router]);

  const handleLogout = () => {
    clearAccessToken();
    clearAdminDisplayName();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.href = '/';
  };

  const currentItem = ALL_NAV.find(n =>
    n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href)
  );

  // Loading
  if (!checked) {
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
    /*
      Grid layout: sidebar (fixed 256px) + main (1fr)
      On mobile: sidebar slides over content
    */
    <div className="h-screen flex overflow-hidden bg-slate-100">

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════ SIDEBAR ═══════════════════════════════════ */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 flex flex-col z-40
          bg-[#0f172a] border-r border-white/5
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:shrink-0
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 h-16 px-5 shrink-0 border-b border-white/5">
          <div className="bg-blue-500 p-2 rounded-xl shadow-lg shadow-blue-500/40 shrink-0">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white tracking-tight leading-none">PharmaQuick</p>
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.16em] mt-0.5">Admin Console</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4 scrollbar-hide">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {/* Group label */}
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 mb-1">
                {group.label}
              </p>

              {group.items.filter(({ href }) => {
                // Hide Admin Accounts from staff role
                if (href === '/admin/accounts' && staffRole === 'staff') return false;
                return true;
              }).map(({ href, label, icon: Icon }) => {
                const active = href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      relative flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5
                      text-[13px] font-semibold transition-all duration-150 group
                      ${active
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white/70 rounded-r-full" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-white' : 'text-slate-600 group-hover:text-slate-300'
                      }`}
                    />
                    <span className="truncate flex-1">{label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + Sign out */}
        <div className="shrink-0 px-3 py-3 border-t border-white/5">
          {/* User info row — clicks to profile */}
          <Link href="/admin/profile" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-2 py-2.5 rounded-xl mb-1 hover:bg-white/[0.06] transition-colors group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-[11px] font-black text-white">{getInitials(adminEmail)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-white truncate leading-tight group-hover:text-blue-300 transition-colors">{adminName}</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">{adminEmail}</p>
              <span className={`inline-block mt-0.5 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                staffRole === 'super_admin' ? 'bg-amber-500/20 text-amber-300'
                : staffRole === 'admin' ? 'bg-blue-500/20 text-blue-300'
                : 'bg-slate-500/20 text-slate-400'
              }`}>
                {staffRole === 'super_admin' ? 'Super Admin' : staffRole === 'admin' ? 'Admin' : 'Staff'}
              </span>
            </div>
          </Link>

          {/* Log out */}
          <button
            onClick={() => setLogoutModalOpen(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ══════════════════════════ MAIN ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top navbar ──────────────────────────────────────────────────── */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 lg:px-5 shrink-0 shadow-sm">

          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xs text-slate-400 hidden sm:block shrink-0">Admin</span>
            <ChevronRight className="w-3 h-3 text-slate-300 hidden sm:block shrink-0" />
            {currentItem && (
              <currentItem.icon className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <span className="text-sm font-black text-slate-800 truncate">
              {currentItem?.label ?? 'Dashboard'}
            </span>
          </div>

          {/* Date — center, desktop only */}
          <p className="hidden lg:block text-xs text-slate-400 font-medium shrink-0 whitespace-nowrap">
            {dateStr}
          </p>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => setBellOpen(v => !v)}
                className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Bell className={`w-5 h-5 ${(pendingOrders + pendingReturns) > 0 ? 'text-slate-700' : 'text-slate-400'}`} />
                {(pendingOrders + pendingReturns) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                    {pendingOrders + pendingReturns}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-sm font-black text-slate-900">Notifications</p>
                      {(pendingOrders + pendingReturns) > 0 && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-black rounded-full">
                          {pendingOrders + pendingReturns} pending
                        </span>
                      )}
                    </div>

                    {/* Pending Orders */}
                    {pendingOrders > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">
                          Pending Orders ({pendingOrders})
                        </p>
                        {recentPending.map(o => (
                          <Link key={o.id} href="/admin/orders" onClick={() => setBellOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800">{o.receiptNumber ?? o.id.slice(0,8)}</p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(o.date).toLocaleDateString('en-PH')}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 shrink-0">Processing</span>
                          </Link>
                        ))}
                        {pendingOrders > 4 && (
                          <Link href="/admin/orders" onClick={() => setBellOpen(false)}
                            className="block text-center text-xs font-bold text-blue-500 hover:text-blue-700 py-2 px-4">
                            +{pendingOrders - 4} more orders →
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Pending Returns */}
                    {pendingReturns > 0 && (
                      <div className={pendingOrders > 0 ? 'border-t border-slate-100' : ''}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">
                          Return Requests ({pendingReturns})
                        </p>
                        {recentReturns.map(r => (
                          <Link key={r.id} href="/admin/returns" onClick={() => setBellOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800">{r.receipt_number}</p>
                              <p className="text-[10px] text-slate-400 truncate">{r.reason}</p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-600 shrink-0">Pending</span>
                          </Link>
                        ))}
                        {pendingReturns > 4 && (
                          <Link href="/admin/returns" onClick={() => setBellOpen(false)}
                            className="block text-center text-xs font-bold text-amber-500 hover:text-amber-700 py-2 px-4">
                            +{pendingReturns - 4} more returns →
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Empty state */}
                    {pendingOrders === 0 && pendingReturns === 0 && (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">All caught up! No pending items.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* User chip — clicks to profile */}
            <Link href="/admin/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
                <span className="text-[11px] font-black text-white">{getInitials(adminEmail)}</span>
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-black text-slate-900">{adminName}</p>
                <p className="text-[10px] text-slate-400">{staffRole === 'super_admin' ? 'Super Admin' : staffRole === 'admin' ? 'Admin' : 'Admin Staff'}</p>
              </div>
            </Link>
          </div>
        </header>

        {/* ── Scrollable page area ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto w-full">

            {/* Page title strip */}
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {currentItem?.label ?? 'Dashboard'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {PAGE_DESCRIPTIONS[currentItem?.href ?? '/admin'] ?? ''}
              </p>
            </div>

            {children}
          </div>
        </main>
      </div>

      {logoutModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setLogoutModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                <LogOut className="h-5 w-5 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Log Out</h2>
              <p className="mt-2 text-sm text-slate-500">Are you sure you want to log out?</p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
