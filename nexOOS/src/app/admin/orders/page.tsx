'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

type OrderItem = { id: string; name: string; price: number; quantity: number; category: string };
type Order = {
  id: string;
  receiptNumber?: string;
  orderNumber?: string;
  date: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
  status: string;
  shippingAddress: string;
  paymentMethod: string;
};

const STATUSES = ['', 'Processing', 'In Transit', 'Delivered', 'Cancelled'];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  Processing: ['In Transit', 'Cancelled'],
  'In Transit': ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    Processing: 'border-blue-100 bg-blue-50 text-blue-700',
    'In Transit': 'border-amber-100 bg-amber-50 text-amber-700',
    Delivered: 'border-green-100 bg-green-50 text-green-700',
    Cancelled: 'border-red-100 bg-red-50 text-red-700',
  };
  return map[status] ?? 'border-slate-200 bg-slate-100 text-slate-600';
}

function summaryCardClass(status: string) {
  const map: Record<string, string> = {
    Processing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    'In Transit': 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    Delivered: 'bg-green-50 text-green-700 ring-1 ring-green-100',
    Cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const LIMIT = 20;

  const fetchOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOrders(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateStatus = async (receiptNumber: string, newStatus: string) => {
    const token = getAccessToken();
    if (!token) return;
    setUpdating(receiptNumber);
    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiptNumber, status: newStatus }),
      });
      if (res.ok) {
        setOrders(prev => prev.map(order =>
          order.receiptNumber === receiptNumber ? { ...order, status: newStatus } : order
        ));
      }
    } finally {
      setUpdating(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const counts = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Visible Orders</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{total}</p>
              <p className="text-sm text-slate-500">Current result set</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('Processing')}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Processing</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black">{counts.Processing ?? 0}</p>
            <Package className="h-5 w-5 opacity-70" />
          </div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('In Transit')}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">In Transit</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black">{counts['In Transit'] ?? 0}</p>
            <Truck className="h-5 w-5 opacity-70" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('Delivered')}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Delivered</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-black">{counts.Delivered ?? 0}</p>
              <CheckCircle2 className="h-5 w-5 opacity-70" />
            </div>
          </div>
          <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('Cancelled')}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Cancelled</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-black">{counts.Cancelled ?? 0}</p>
              <XCircle className="h-5 w-5 opacity-70" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by receipt or order number..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 lg:min-w-52"
          >
            {STATUSES.map(status => (
              <option key={status} value={status}>
                {status || 'All statuses'}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Orders</h2>
              <p className="text-sm text-slate-500">Review shipments, statuses, and totals in one place.</p>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {total} total
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No orders found</h3>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or status filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(order => {
              const orderLabel = order.receiptNumber ?? order.orderNumber ?? order.id.slice(0, 8);
              const transitions = STATUS_TRANSITIONS[order.status] ?? [];
              const isExpanded = expanded === order.id;

              return (
                <article key={order.id} className="bg-white">
                  <div className="px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                          onClick={() => setExpanded(prev => prev === order.id ? null : order.id)}
                          className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                          aria-label={isExpanded ? `Collapse ${orderLabel}` : `Expand ${orderLabel}`}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-black tracking-tight text-slate-900">{orderLabel}</p>
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                              <p className="mt-2 max-w-3xl text-sm text-slate-500">{order.shippingAddress}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:max-w-md xl:min-w-[22rem]">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Total</p>
                                <p className="mt-1 text-base font-black text-slate-900">{formatCurrency(Number(order.total))}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Date</p>
                                <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(order.date)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                              <span className="rounded-full bg-slate-100 px-3 py-1.5">{order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1.5">{order.paymentMethod || 'Unknown payment'}</span>
                            </div>

                            {transitions.length > 0 && (
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Update status</span>
                                {updating === order.receiptNumber ? (
                                  <div className="flex h-11 items-center rounded-2xl border border-slate-200 px-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                  </div>
                                ) : (
                                  <select
                                    defaultValue=""
                                    onChange={e => {
                                      if (e.target.value && order.receiptNumber) {
                                        updateStatus(order.receiptNumber, e.target.value);
                                      }
                                      e.target.value = '';
                                    }}
                                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                  >
                                    <option value="" disabled>Move to...</option>
                                    {transitions.map(status => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-5 sm:px-6">
                      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Items</p>
                          <div className="mt-4 space-y-3">
                            {order.items.map(item => (
                              <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.category || 'Uncategorized'} | Qty {item.quantity}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-bold text-slate-700">
                                  {formatCurrency(item.price * item.quantity)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Order Details</p>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-slate-500">Payment method</span>
                              <span className="font-semibold text-slate-800">{order.paymentMethod}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-slate-500">Subtotal</span>
                              <span className="font-semibold text-slate-800">{formatCurrency(order.subtotal)}</span>
                            </div>
                            {order.discountAmount > 0 && (
                              <div className="flex items-center justify-between gap-4 text-sm text-green-700">
                                <span>Discount</span>
                                <span className="font-semibold">-{formatCurrency(order.discountAmount)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-slate-500">Delivery fee</span>
                              <span className="font-semibold text-slate-800">{formatCurrency(order.deliveryFee)}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-3">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-bold text-slate-900">Grand total</span>
                                <span className="text-base font-black text-slate-900">{formatCurrency(order.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-500">
              Page <span className="font-bold text-slate-700">{page + 1}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(prev => prev - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(prev => prev + 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
