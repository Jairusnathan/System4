'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

export type UndoEntry = {
  id: string;
  label: string;
  prevStatus: string;
  newStatus: string;
  expiresAt: number;
};

const UNDO_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function Countdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, expiresAt - Date.now());
      setRemaining(rem);
      if (rem === 0) onExpire();
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSecs = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const pct  = (remaining / UNDO_WINDOW_MS) * 100;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Circular progress */}
      <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="11" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle
          cx="14" cy="14" r="11"
          fill="none"
          stroke={pct > 33 ? '#3b82f6' : pct > 10 ? '#f59e0b' : '#ef4444'}
          strokeWidth="2.5"
          strokeDasharray={`${2 * Math.PI * 11}`}
          strokeDashoffset={`${2 * Math.PI * 11 * (1 - pct / 100)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`text-xs font-black tabular-nums ${pct > 33 ? 'text-slate-700' : pct > 10 ? 'text-amber-600' : 'text-red-600'}`}>
        {mins}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export function UndoToastStack({
  entries,
  onUndo,
  onDismiss,
}: {
  entries: UndoEntry[];
  onUndo: (entry: UndoEntry) => void;
  onDismiss: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      Processing: 'text-blue-600', 'In Transit': 'text-amber-600',
      Delivered: 'text-green-600', Cancelled: 'text-red-600',
      pending: 'text-amber-600', reviewing: 'text-blue-600',
      approved: 'text-green-600', rejected: 'text-red-600',
    };
    return map[status] ?? 'text-slate-600';
  };

  const fmtStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {entries.map(entry => (
        <div
          key={entry.id}
          className="pointer-events-auto bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
        >
          {/* Icon */}
          <div className="p-2 bg-slate-100 rounded-xl shrink-0">
            <RotateCcw className="w-4 h-4 text-slate-600" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-800 truncate">{entry.label}</p>
            <p className="text-[10px] text-slate-400">
              <span className={`font-bold ${statusColor(entry.prevStatus)}`}>{fmtStatus(entry.prevStatus)}</span>
              {' → '}
              <span className={`font-bold ${statusColor(entry.newStatus)}`}>{fmtStatus(entry.newStatus)}</span>
            </p>
          </div>

          {/* Countdown */}
          <Countdown expiresAt={entry.expiresAt} onExpire={() => onDismiss(entry.id)} />

          {/* Undo button */}
          <button
            onClick={() => onUndo(entry)}
            className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-colors"
          >
            Undo
          </button>

          {/* Dismiss */}
          <button
            onClick={() => onDismiss(entry.id)}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useUndoQueue() {
  const [entries, setEntries] = useState<UndoEntry[]>([]);

  const push = (entry: Omit<UndoEntry, 'expiresAt'>) => {
    const expiresAt = Date.now() + UNDO_WINDOW_MS;
    const full: UndoEntry = { ...entry, expiresAt };
    setEntries(prev => {
      // Replace if same id already in queue
      const filtered = prev.filter(e => e.id !== entry.id);
      return [...filtered, full];
    });
    // Auto-expire
    setTimeout(() => {
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    }, UNDO_WINDOW_MS + 100);
  };

  const remove = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  return { entries, push, remove };
}
