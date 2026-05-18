'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Loader2, Clock } from 'lucide-react';

type Branch = {
  id: number;
  name: string;
  address: string;
  opening_time: string;
  closing_time: string;
  contact_number?: string;
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, []);

  function isOpenNow(b: Branch) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = b.opening_time.split(':').map(Number);
    const [ch, cm] = b.closing_time.split(':').map(Number);
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-900">Branch Information <span className="text-slate-400 font-normal text-sm">(View-only)</span></h2>
          <span className="text-xs text-slate-400">{branches.length} branches</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : branches.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No branches found.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {branches.map(b => (
              <div key={b.id} className="px-6 py-5 flex items-start gap-4">
                <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-900">{b.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isOpenNow(b) ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isOpenNow(b) ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{b.address}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {b.opening_time} – {b.closing_time}
                    </span>
                    {b.contact_number && (
                      <span className="text-xs text-slate-400">{b.contact_number}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
