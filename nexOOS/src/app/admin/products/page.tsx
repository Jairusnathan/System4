'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import Image from 'next/image';

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  stock?: number;
  image?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data?.data ?? []));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-900">Product Catalog <span className="text-slate-400 font-normal text-sm">(Read-only)</span></h2>
          <span className="text-xs text-slate-400">{filtered.length} products</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No products found.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(p => (
              <div key={p.id} className="px-6 py-3 flex items-center gap-4">
                {p.image ? (
                  <Image src={p.image} alt={p.name} width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0" unoptimized />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">₱{Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  {typeof p.stock === 'number' && (
                    <p className={`text-xs font-medium ${p.stock <= 0 ? 'text-red-500' : p.stock <= 5 ? 'text-amber-500' : 'text-green-600'}`}>
                      {p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
