'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Clock3,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';
import { UndoToastStack, useUndoQueue } from '@/components/admin/UndoToast';

type ReturnItem = { productId: string; name: string; quantity: number };
type ReturnRequest = {
  id: string;
  receipt_number: string;
  customer_id: string;
  reason: string;
  description?: string;
  items: ReturnItem[];
  status: string;
  created_at: string;
  admin_note?: string;
};

const STATUSES = ['', 'pending', 'reviewing', 'approved', 'rejected'];

// Strict status hierarchy — must go Pending → Reviewing → Approved/Rejected
// Cannot skip a step
const QUICK_TRANSITIONS: Record<string, string[]> = {
  pending:   ['reviewing'],  // quick dropdown: move to reviewing only
  reviewing: [],             // approved/rejected need note — only in expanded view
  approved:  [],
  rejected:  [],
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending:   ['reviewing'],           // ONLY reviewing — cannot approve/reject from pending
  reviewing: ['approved', 'rejected'],// After reviewing, decision required
  approved:  [],
  rejected:  [],
};

const formatStatusLabel = (status: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All statuses';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    pending: 'border-amber-100 bg-amber-50 text-amber-700',
    reviewing: 'border-blue-100 bg-blue-50 text-blue-700',
    approved: 'border-green-100 bg-green-50 text-green-700',
    rejected: 'border-red-100 bg-red-50 text-red-700',
  };
  return map[status] ?? 'border-slate-200 bg-slate-100 text-slate-700';
}

function summaryCardClass(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    reviewing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    approved: 'bg-green-50 text-green-700 ring-1 ring-green-100',
    rejected: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<Record<string, boolean>>({});
  const undo = useUndoQueue();
  const LIMIT = 20;

  const fetchReturns = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/returns?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setReturns(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const REQUIRES_NOTE = ['approved', 'rejected'];

  const updateStatus = async (id: string, newStatus: string) => {
    const note = adminNote[id]?.trim() ?? '';

    // Require admin note for approve/reject decisions
    if (REQUIRES_NOTE.includes(newStatus) && !note) {
      setNoteError(prev => ({ ...prev, [id]: true }));
      setExpanded(id); // force expand so user sees the textarea
      return;
    }

    setNoteError(prev => ({ ...prev, [id]: false }));
    const token = getAccessToken();
    if (!token) return;

    // Find current status for undo
    const request = returns.find(r => r.id === id);
    const prevStatus = request?.status ?? '';
    const label = request?.receipt_number ?? id.slice(0, 8);

    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, adminNote: note }),
      });
      if (res.ok) {
        setReturns(prev => prev.map(r =>
          r.id === id ? { ...r, status: newStatus, admin_note: note } : r
        ));
        // Push to undo queue
        if (prevStatus) {
          undo.push({ id, label, prevStatus, newStatus });
        }
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleUndo = async (entry: import('@/components/admin/UndoToast').UndoEntry) => {
    undo.remove(entry.id);
    // Undo: revert to previous status (bypass note requirement for undo)
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/admin/returns/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: entry.prevStatus, adminNote: 'Status reverted by admin (undo)' }),
    });
    if (res.ok) {
      setReturns(prev => prev.map(r =>
        r.id === entry.id ? { ...r, status: entry.prevStatus } : r
      ));
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const counts = returns.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Visible Requests</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-3xl font-black text-slate-900">{total}</p>
              <p className="text-sm text-slate-500">Current result set</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
              <RotateCcw className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('pending')}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Pending</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black">{counts.pending ?? 0}</p>
            <Clock3 className="h-5 w-5 opacity-70" />
          </div>
        </div>

        <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('reviewing')}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Reviewing</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black">{counts.reviewing ?? 0}</p>
            <ClipboardCheck className="h-5 w-5 opacity-70" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('approved')}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Approved</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-black">{counts.approved ?? 0}</p>
              <CheckCircle2 className="h-5 w-5 opacity-70" />
            </div>
          </div>
          <div className={`rounded-2xl p-4 shadow-sm ${summaryCardClass('rejected')}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Rejected</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-2xl font-black">{counts.rejected ?? 0}</p>
              <XCircle className="h-5 w-5 opacity-70" />
            </div>
          </div>
        </div>
      </section>

<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Filter Requests</p>
            <p className="mt-1 text-sm text-slate-500">Narrow returns by current review status.</p>
          </div>

          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 lg:min-w-56"
          >
            {STATUSES.map(status => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Return &amp; Refund Requests</h2>
              <p className="text-sm text-slate-500">Track customer issues, notes, and resolution progress.</p>
            </div>
            <p className="text-sm font-semibold text-slate-400">{total} total</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <RotateCcw className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No return requests found</h3>
            <p className="mt-1 text-sm text-slate-500">Try another filter or check back after new submissions arrive.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {returns.map(request => {
              const quickStatuses = QUICK_TRANSITIONS[request.status] ?? [];
              const nextStatuses  = NEXT_STATUSES[request.status] ?? [];
              const isExpanded = expanded === request.id;

              return (
                <article key={request.id} className="bg-white">
                  <div className="px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                          onClick={() => setExpanded(prev => prev === request.id ? null : request.id)}
                          className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                          aria-label={isExpanded ? `Collapse ${request.receipt_number}` : `Expand ${request.receipt_number}`}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-black tracking-tight text-slate-900">{request.receipt_number}</p>
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(request.status)}`}>
                                  {formatStatusLabel(request.status)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">{request.reason}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:max-w-md xl:min-w-[22rem]">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Submitted</p>
                                <p className="mt-1 text-sm font-bold text-slate-700">{formatDate(request.created_at)}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Items</p>
                                <p className="mt-1 text-base font-black text-slate-900">{Array.isArray(request.items) ? request.items.length : 0}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                              <span className="rounded-full bg-slate-100 px-3 py-1.5">Customer ID: {request.customer_id}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1.5">
                                {Array.isArray(request.items) ? request.items.reduce((sum, item) => sum + item.quantity, 0) : 0} unit claim
                              </span>
                            </div>

                            {quickStatuses.length > 0 && (
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Quick update</span>
                                {updating === request.id ? (
                                  <div className="flex h-11 items-center rounded-2xl border border-slate-200 px-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                  </div>
                                ) : (
                                  <select
                                    defaultValue=""
                                    onChange={e => {
                                      if (e.target.value) updateStatus(request.id, e.target.value);
                                      e.target.value = '';
                                    }}
                                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                  >
                                    <option value="" disabled>Move to...</option>
                                    {quickStatuses.map(status => (
                                      <option key={status} value={status}>
                                        {formatStatusLabel(status)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                            {/* Hint: approve/reject requires expanded note */}
                            {nextStatuses.some(s => s === 'approved' || s === 'rejected') && (
                              <p className="text-xs text-slate-400 italic">
                                Expand to Approve or Reject — admin review note required.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-5 sm:px-6">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Requested Items</p>
                          <div className="mt-4 space-y-3">
                            {(Array.isArray(request.items) ? request.items : []).map((item, index) => (
                              <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">Product ID: {item.productId}</p>
                                </div>
                                <p className="shrink-0 text-sm font-bold text-slate-700">x{item.quantity}</p>
                              </div>
                            ))}
                          </div>

                          {request.description && (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Customer Note</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{request.description}</p>
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Admin Review</p>
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                              Required for Approve / Reject
                            </span>
                          </div>
                          <textarea
                            rows={5}
                            value={adminNote[request.id] ?? request.admin_note ?? ''}
                            onChange={e => {
                              setAdminNote(prev => ({ ...prev, [request.id]: e.target.value }));
                              if (e.target.value.trim()) setNoteError(prev => ({ ...prev, [request.id]: false }));
                            }}
                            placeholder="Add an internal note for the refund or replacement decision..."
                            className={`mt-1 w-full rounded-2xl border px-4 py-3 text-sm text-slate-700 outline-none transition resize-none ${
                              noteError[request.id]
                                ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                                : 'border-slate-200 bg-slate-50 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10'
                            }`}
                          />
                          {noteError[request.id] && (
                            <p className="mt-1.5 text-xs font-bold text-red-500 flex items-center gap-1">
                              ⚠ Admin review note is required before approving or rejecting.
                            </p>
                          )}

                          {nextStatuses.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {nextStatuses.map(status => {
                                const requiresNote = status === 'approved' || status === 'rejected';
                                const currentNote = (adminNote[request.id] ?? request.admin_note ?? '').trim();
                                const isDisabled = updating === request.id || (requiresNote && !currentNote);

                                const buttonClass =
                                  status === 'approved'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : status === 'rejected'
                                      ? 'bg-red-600 text-white hover:bg-red-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700';

                                return (
                                  <button
                                    key={status}
                                    onClick={() => updateStatus(request.id, status)}
                                    disabled={isDisabled}
                                    title={requiresNote && !currentNote ? 'Admin review note is required' : undefined}
                                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                                  >
                                    {updating === request.id ? <Loader2 className="h-4 w-4 animate-spin inline" /> : formatStatusLabel(status)}
                                  </button>
                                );
                              })}
                              {nextStatuses.some(s => s === 'approved' || s === 'rejected') && (
                                <p className="w-full text-xs text-slate-400 mt-1">
                                  Approve / Reject buttons enable once you add a review note.
                                </p>
                              )}
                            </div>
                          )}
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
      <UndoToastStack
        entries={undo.entries}
        onUndo={handleUndo}
        onDismiss={undo.remove}
      />
    </div>
  );
}
