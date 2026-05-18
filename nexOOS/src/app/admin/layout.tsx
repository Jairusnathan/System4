'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, RotateCcw, Users, Package,
  MapPin, Settings, Shield, Pill, LogOut, Menu,
  X, Mail, Bell, ChevronRight,
} from 'lucide-react';
import { getAccessToken, clearAccessToken } from '@/lib/auth-client';

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
    label: 'Insights',
    items: [
      { href: '/admin/emails',     label: 'Email Center',     icon: Mail },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/settings',   label: 'OOS Settings',     icon: Settings },
      { href: '/admin/accounts',   label: 'Admin Accounts',   icon: Shield },
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

function getInitials(email: string) {
  return (email.split('@')[0] ?? 'AD').slice(0, 2).toUpperCase();
}

function formatName(email: string) {
  return (
    email.split('@')[0]
      ?.replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()) || 'Admin'
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [adminEmail,   setAdminEmail]   = useState('');
  const [adminName,    setAdminName]    = useState('Admin');
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [checked,      setChecked]      = useState(false);
  const [dateStr,      setDateStr]      = useState('');

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
    if (!payload?.isAdmin && localStorage.getItem('is_admin') !== 'true') {
      router.replace('/');
      return;
    }
    const email = (payload?.email as string) ?? '';
    setAdminEmail(email);
    setAdminName(formatName(email));
    setChecked(true);
  }, [router]);

  const handleLogout = () => {
    clearAccessToken();
    localStorage.removeItem('is_admin');
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

              {group.items.map(({ href, label, icon: Icon }) => {
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
          {/* User info row */}
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-[11px] font-black text-white">{getInitials(adminEmail)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-white truncate leading-tight">{adminName}</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">{adminEmail}</p>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
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
            <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* User chip */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
                <span className="text-[11px] font-black text-white">{getInitials(adminEmail)}</span>
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-black text-slate-900">{adminName}</p>
                <p className="text-[10px] text-slate-400">Administrator</p>
              </div>
            </div>
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
    </div>
  );
}
