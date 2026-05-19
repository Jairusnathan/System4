'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingBag, Users, RotateCcw, TrendingUp, Clock,
  CheckCircle2, XCircle, Truck, Loader2, ArrowRight,
  AlertCircle, Package, Search, Eye,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth-client';

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderItem  = { id?: string; name: string; price: number; quantity: number; category: string };
type Order      = { id: string; receiptNumber?: string; date: string; total: number; subtotal: number; deliveryFee: number; discountAmount: number; status: string; shippingAddress: string; paymentMethod: string; items: OrderItem[] };
type ReturnReq  = { id: string; receipt_number: string; reason: string; created_at: string; status: string };
type SearchRow  = { query: string; count: number };
type ViewRow    = { product_id: string; category: string; total_views: number };
type OrderStats = { totalOrders: number; ordersToday: number; pendingOrders: number; todayRevenue: number; pendingReturns: number; processingOrders: number; inTransitOrders: number; deliveredOrders: number; cancelledOrders: number };
type AuthStats  = { totalCustomers: number; newToday: number };
type ViewType   = 'overall' | 'month' | 'year' | 'compare';
type BasketPairRow = {
  pair: string;            // "Antecedent → Consequent" label for chart
  count: number;           // support count (times both appear together)
  support: number;         // P(A∩B) as percentage
  confidence: number;      // P(B|A) as percentage
  lift: number;            // confidence / P(B)
  leverage: number;        // P(A∩B) - P(A)*P(B)
  conviction: number;      // (1-P(B)) / (1-confidence)
  antecedentItems: string[];
  consequentItems: string[];
  left: string;            // formatted antecedent e.g. "{Coffee, Milk}"
  right: string;           // formatted consequent e.g. "{Sugar}"
};

// ─── Colour palette — accent-restrained ──────────────────────────────────────
// One blue, one green, one amber, one red — all slightly muted
const C_BLUE   = '#3b82f6';   // primary accent
const C_GREEN  = '#16a34a';   // positive / delivered
const C_AMBER  = '#d97706';   // warning / in-transit
const C_RED    = '#dc2626';   // danger / cancelled
const C_INDIGO = '#6366f1';   // secondary accent
const C_SLATE  = '#64748b';   // neutral mid

// Chart palette — cohesive, not rainbow
const CHART_PAL = [C_BLUE, C_INDIGO, C_SLATE, '#94a3b8', '#334155', '#0ea5e9', '#8b5cf6', '#475569'];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOW      = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MON  = NOW.getMonth();
const YEARS    = Array.from({ length: 5 }, (_, i) => CUR_YEAR - i);

const TT = {
  contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.06)', fontSize: 12 },
  labelStyle: { fontWeight: 700, color: '#0f172a' },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt  = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt2 = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Data builders ────────────────────────────────────────────────────────────
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function filterMonth(orders: Order[], y: number, m: number) { return orders.filter(o => { const d = new Date(o.date); return d.getFullYear() === y && d.getMonth() === m; }); }
function filterYear(orders: Order[], y: number) { return orders.filter(o => new Date(o.date).getFullYear() === y); }

function buildDaily(orders: Order[], y: number, m: number) {
  const days = daysInMonth(y, m);
  const rows = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), revenue: 0, orders: 0 }));
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const d = new Date(o.date);
    if (d.getFullYear() === y && d.getMonth() === m) { rows[d.getDate()-1].revenue += o.total; rows[d.getDate()-1].orders += 1; }
  }
  return rows.map(r => ({ ...r, revenue: Math.round(r.revenue) }));
}

function buildMonthly(orders: Order[], y: number) {
  const rows = MONTHS_SHORT.map(m => ({ label: m, revenue: 0, orders: 0 }));
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const d = new Date(o.date);
    if (d.getFullYear() === y) { rows[d.getMonth()].revenue += o.total; rows[d.getMonth()].orders += 1; }
  }
  return rows.map(r => ({ ...r, revenue: Math.round(r.revenue) }));
}

function buildOverall(orders: Order[]) {
  // Group by "Mon YYYY" sorted chronologically
  const map = new Map<string, { revenue: number; orders: number; sortKey: number }>();
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const d = new Date(o.date);
    const label = `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    const sortKey = d.getFullYear() * 100 + d.getMonth();
    if (!map.has(label)) map.set(label, { revenue: 0, orders: 0, sortKey });
    const row = map.get(label)!;
    row.revenue += o.total;
    row.orders  += 1;
  }
  return [...map.entries()]
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, { revenue, orders }]) => ({ label, revenue: Math.round(revenue), orders }));
}

function buildCompare(orders: Order[], yA: number, yB: number) {
  const rows = MONTHS_SHORT.map(m => ({ label: m, [yA]: 0, [yB]: 0 }));
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const d = new Date(o.date);
    const yr = d.getFullYear();
    if (yr === yA || yr === yB) (rows[d.getMonth()] as Record<string, number>)[yr] += o.total;
  }
  return rows.map(r => ({ ...r, [yA]: Math.round((r as Record<string,number>)[yA]), [yB]: Math.round((r as Record<string,number>)[yB]) }));
}

function buildPayment(orders: Order[]) {
  const m: Record<string, number> = {};
  for (const o of orders) { if (o.status === 'Cancelled') continue; const k = o.paymentMethod || 'Unknown'; m[k] = (m[k] ?? 0) + 1; }
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}

function buildTopProducts(orders: Order[], n = 7) {
  const m: Record<string, number> = {};
  for (const o of orders) { if (o.status === 'Cancelled') continue; for (const i of o.items ?? []) m[i.name] = (m[i.name] ?? 0) + i.quantity; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, qty]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, qty }));
}

function buildCategory(orders: Order[], n = 6) {
  const m: Record<string, number> = {};
  for (const o of orders) { if (o.status === 'Cancelled') continue; for (const i of o.items ?? []) { const c = i.category || 'Other'; m[c] = (m[c] ?? 0) + i.price * i.quantity; } }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value: Math.round(value) }));
}

// ─── Apriori algorithm (mirrors Python mlxtend basis) ─────────────────────────
// Equivalent to: apriori(df, min_support=minsup, use_colnames=True)
// Returns all frequent itemsets with their support counts.
type FreqItemset = { items: string[]; support: number; count: number };

function aprioriMine(transactions: string[][], minSupport: number, maxLen = 4): FreqItemset[] {
  const N = transactions.length;
  if (N === 0) return [];
  const minCount = Math.ceil(minSupport * N);
  const txSets = transactions.map(t => new Set(t));
  const result: FreqItemset[] = [];

  // Count how many transactions contain all items in the itemset
  const countItemset = (items: string[]) => txSets.filter(tx => items.every(i => tx.has(i))).length;

  // ── Level 1: frequent single items ───────────────────────────────────────────
  const itemCounts = new Map<string, number>();
  for (const tx of transactions) for (const item of new Set(tx))
    itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);

  let currentLevel: string[][] = [];
  for (const [item, cnt] of itemCounts) {
    if (cnt >= minCount) {
      currentLevel.push([item]);
      result.push({ items: [item], support: cnt / N, count: cnt });
    }
  }
  // Sort for consistent candidate generation (required by Apriori join step)
  currentLevel.sort((a, b) => a[0].localeCompare(b[0]));

  // ── Levels k = 2..maxLen ─────────────────────────────────────────────────────
  for (let k = 2; k <= maxLen && currentLevel.length >= 2; k++) {
    const candidates: string[][] = [];
    // Join step: merge two (k-1)-itemsets that share the same (k-2) prefix
    for (let i = 0; i < currentLevel.length; i++) {
      for (let j = i + 1; j < currentLevel.length; j++) {
        const a = currentLevel[i], b = currentLevel[j];
        let match = true;
        for (let x = 0; x < k - 2; x++) { if (a[x] !== b[x]) { match = false; break; } }
        if (match && a[k - 2] < b[k - 2]) candidates.push([...a, b[k - 2]]);
      }
    }
    const nextLevel: string[][] = [];
    for (const c of candidates) {
      const cnt = countItemset(c);
      if (cnt >= minCount) {
        nextLevel.push(c);
        result.push({ items: c, support: cnt / N, count: cnt });
      }
    }
    currentLevel = nextLevel;
  }
  return result;
}

// Equivalent to: association_rules(frequent_itemsets, metric="confidence", min_threshold=minconf)
type RawRule = { antecedent: string[]; consequent: string[]; support: number; count: number; confidence: number; lift: number; leverage: number; conviction: number };

function generateRules(frequentItemsets: FreqItemset[], minConfidence: number): RawRule[] {
  const supportMap = new Map<string, { support: number; count: number }>();
  for (const fi of frequentItemsets)
    supportMap.set([...fi.items].sort().join('||'), { support: fi.support, count: fi.count });

  const getSupport = (items: string[]) => supportMap.get([...items].sort().join('||'))?.support ?? 0;

  // All non-empty proper subsets of an array (used for antecedent candidates)
  const properSubsets = (arr: string[]): string[][] => {
    const n = arr.length, subs: string[][] = [];
    for (let mask = 1; mask < (1 << n) - 1; mask++) {
      const sub: string[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) sub.push(arr[i]);
      subs.push(sub);
    }
    return subs;
  };

  const rules: RawRule[] = [];
  for (const { items, support: supAB, count } of frequentItemsets) {
    if (items.length < 2) continue;
    for (const ant of properSubsets(items)) {
      const con = items.filter(x => !ant.includes(x));
      if (con.length === 0) continue;
      const supA = getSupport(ant), supB = getSupport(con);
      if (supA === 0 || supB === 0) continue;
      const confidence = supAB / supA;
      if (confidence < minConfidence) continue;
      const lift       = confidence / supB;
      const leverage   = supAB - supA * supB;
      const rawConv    = (1 - supB) / Math.max(1e-9, 1 - confidence);
      const conviction = Number.isFinite(rawConv) ? rawConv : 999;
      rules.push({ antecedent: [...ant].sort(), consequent: [...con].sort(), support: supAB, count, confidence, lift, leverage, conviction });
    }
  }
  // Sort: lift desc → confidence desc → support desc (same as Python basis)
  return rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence || b.support - a.support);
}

// minsup=0.3 and minconf=0.5 mirrors the Python basis code defaults
const MBA_MIN_SUP  = 0.3;
const MBA_MIN_CONF = 0.5;

function buildMarketBasket(orders: Order[], n = 8) {
  // ── 1) Build transactions (one list of product names per non-cancelled order)
  const transactions: string[][] = [];
  for (const order of orders) {
    if (order.status === 'Cancelled') continue;
    const seen = new Map<string, string>();
    for (const item of order.items ?? []) {
      const rawName = String(item.name ?? '').trim();
      const rawId   = String(item.id   ?? '').trim();
      const identity = rawId || rawName.toLowerCase();
      if (!identity || !rawName) continue;
      if (!seen.has(identity)) seen.set(identity, rawName);
    }
    const names = [...seen.values()];
    if (names.length > 0) transactions.push(names);
  }
  const eligibleOrders = transactions.length;
  if (eligibleOrders === 0) return { rows: [], eligibleOrders: 0 };

  // ── 2) Apriori: find all frequent itemsets
  const frequentItemsets = aprioriMine(transactions, MBA_MIN_SUP, 4);

  // ── 3) Generate association rules filtered by min confidence
  const rules = generateRules(frequentItemsets, MBA_MIN_CONF);

  // ── 4) Deduplicate symmetric rules: A→B and B→A are the same product pair.
  //       Keep the version with the highest confidence (most actionable insight).
  const pairBest = new Map<string, RawRule>();
  for (const rule of rules) {
    const key = [...rule.antecedent, ...rule.consequent].sort().join('||');
    const existing = pairBest.get(key);
    if (!existing || rule.confidence > existing.confidence) pairBest.set(key, rule);
  }
  const deduped = [...pairBest.values()]
    .sort((a, b) => b.lift - a.lift || b.confidence - a.confidence || b.count - a.count)
    .slice(0, n);

  // ── 5) Format for display — use plain-English labels, no technical jargon
  const shorten = (items: string[]) =>
    items.length === 1 ? items[0] : `{${items.join(' + ')}}`;

  const rows: BasketPairRow[] = deduped.map(r => ({
    // Chart label: just "A + B" (no arrow, no technical notation)
    pair:            `${shorten(r.antecedent)} + ${shorten(r.consequent)}`,
    count:           r.count,
    support:         Number((r.support    * 100).toFixed(1)),
    confidence:      Number((r.confidence * 100).toFixed(1)),
    lift:            Number(r.lift.toFixed(2)),
    leverage:        Number(r.leverage.toFixed(3)),
    conviction:      Number(Math.min(r.conviction, 99).toFixed(2)),
    antecedentItems: r.antecedent,
    consequentItems: r.consequent,
    left:            shorten(r.antecedent),
    right:           shorten(r.consequent),
  }));

  return { rows, eligibleOrders };
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, href }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm group ${href ? 'hover:shadow-md hover:border-slate-200 transition-all cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {href && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />}
      </div>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ label = 'No data for this period' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-300">
      <Package className="w-7 h-7 mb-2" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    Processing:   'bg-blue-50 text-blue-600 border border-blue-100',
    'In Transit': 'bg-amber-50 text-amber-600 border border-amber-100',
    Delivered:    'bg-green-50 text-green-700 border border-green-100',
    Cancelled:    'bg-red-50 text-red-500 border border-red-100',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${m[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function SectionCard({ title, href, linkLabel = 'View all', children }: {
  title: string; href: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
        <Link href={href} className="text-xs font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors">
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [allOrders,  setAllOrders]  = useState<Order[]>([]);
  const [recent,     setRecent]     = useState<Order[]>([]);
  const [allReturns, setAllReturns] = useState<ReturnReq[]>([]);
  const [searches,    setSearches]    = useState<SearchRow[]>([]);
  const [views,       setViews]       = useState<ViewRow[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [authStats,  setAuthStats]  = useState<AuthStats | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [viewType,    setViewType]    = useState<ViewType>('month');
  const [year,        setYear]        = useState(CUR_YEAR);
  const [month,       setMonth]       = useState(CUR_MON);
  const [compareYear, setCompareYear] = useState(CUR_YEAR - 1);

  // Compute date range from filter
  const dateRange = useMemo((): { from: string; to: string } | null => {
    if (viewType === 'overall') return null;
    if (viewType === 'month') {
      const from = new Date(year, month, 1).toISOString();
      const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      return { from, to };
    }
    if (viewType === 'year') {
      return { from: new Date(year, 0, 1).toISOString(), to: new Date(year, 11, 31, 23, 59, 59).toISOString() };
    }
    // compare
    const minY = Math.min(year, compareYear);
    const maxY = Math.max(year, compareYear);
    return { from: new Date(minY, 0, 1).toISOString(), to: new Date(maxY, 11, 31, 23, 59, 59).toISOString() };
  }, [viewType, year, month, compareYear]);

  const safe = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}));

  // Initial load — orders, stats, returns
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    Promise.all([
      safe('/api/admin/stats', token),
      safe('/api/admin/auth-stats', token),
      safe('/api/admin/orders?limit=500', token),
      safe('/api/admin/orders?limit=8', token),
      safe('/api/admin/returns?limit=200', token),
    ]).then(([stats, aStats, allOrd, recOrd, ret]) => {
      if (stats?.totalOrders !== undefined) setOrderStats(stats);
      if (aStats?.totalCustomers !== undefined) setAuthStats(aStats);
      setAllOrders(allOrd?.data ?? []);
      setRecent(recOrd?.data ?? []);
      setAllReturns(ret?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // Re-fetch analytics when date filter changes
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const parts = ['limit=50'];
    if (dateRange?.from) parts.push(`from=${encodeURIComponent(dateRange.from)}`);
    if (dateRange?.to)   parts.push(`to=${encodeURIComponent(dateRange.to)}`);
    const qs = parts.join('&');
    Promise.all([
      safe(`/api/admin/analytics?type=searches&${qs}`, token),
      safe(`/api/admin/analytics?type=product-views&${qs}`, token),
    ]).then(([srch, vw]) => {
      setSearches(srch?.data ?? []);
      setViews(vw?.data ?? []);
    }).catch(() => {});
  }, [dateRange]);

  const filtered = useMemo(() => {
    if (viewType === 'overall') return allOrders;
    if (viewType === 'month')   return filterMonth(allOrders, year, month);
    if (viewType === 'year')    return filterYear(allOrders, year);
    return allOrders.filter(o => { const y = new Date(o.date).getFullYear(); return y === year || y === compareYear; });
  }, [allOrders, viewType, year, month, compareYear]);

  const timeSeries = useMemo(() => {
    if (viewType === 'overall') return buildOverall(allOrders);
    if (viewType === 'month')   return buildDaily(allOrders, year, month);
    if (viewType === 'year')    return buildMonthly(allOrders, year);
    return buildCompare(allOrders, year, compareYear);
  }, [allOrders, viewType, year, month, compareYear]);
  const paymentData  = useMemo(() => buildPayment(filtered),       [filtered]);
  const topProducts  = useMemo(() => buildTopProducts(filtered,7), [filtered]);
  const categoryData = useMemo(() => buildCategory(filtered,6),    [filtered]);
  const basketAnalysis = useMemo(() => buildMarketBasket(filtered, 8), [filtered]);

  const statusData = useMemo(() => {
    const c = { Processing: 0, 'In Transit': 0, Delivered: 0, Cancelled: 0 } as Record<string, number>;
    for (const o of filtered) c[o.status] = (c[o.status] ?? 0) + 1;
    return Object.entries(c).map(([name, value]) => ({
      name, value,
      fill: name==='Processing' ? C_BLUE : name==='In Transit' ? C_AMBER : name==='Delivered' ? C_GREEN : C_RED,
    }));
  }, [filtered]);

  // Build product name map from order items (product_id → name)
  const productNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const order of allOrders) {
      for (const item of order.items ?? []) {
        if (item.id && item.name && !map[String(item.id)]) {
          map[String(item.id)] = item.name;
        }
      }
    }
    return map;
  }, [allOrders]);

  // Pending returns for the top widget (always all pending, not date-filtered)
  const returns = useMemo(
    () => allReturns.filter(r => r.status === 'pending').slice(0, 5),
    [allReturns]
  );

  const returnStatusData = useMemo(() => {
    const filtered = dateRange
      ? allReturns.filter(r => {
          const d = new Date(r.created_at).getTime();
          return d >= new Date(dateRange.from).getTime() && d <= new Date(dateRange.to).getTime();
        })
      : allReturns;
    const m: Record<string, number> = {};
    for (const r of filtered) m[r.status] = (m[r.status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [allReturns, dateRange]);

  const periodOrders  = filtered.length;
  const periodRevenue = filtered.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
  const delivered     = filtered.filter(o => o.status === 'Delivered').length;
  const fulfillment   = Math.round((delivered / (periodOrders || 1)) * 100);
  const radialData    = [{ name: 'Fulfilled', value: fulfillment, fill: C_GREEN }, { name: 'Other', value: 100 - fulfillment, fill: '#f1f5f9' }];
  const needsAttention = (orderStats?.pendingOrders ?? 0) + (orderStats?.pendingReturns ?? 0);
  const periodLabel   = viewType==='overall' ? 'All Time' : viewType==='month' ? `${MONTHS_LONG[month]} ${year}` : viewType==='year' ? String(year) : `${year} vs ${compareYear}`;
  const topBasketPair = basketAnalysis.rows[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Attention banner ──────────────────────────────────────────────────── */}
      {needsAttention > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            <span className="font-bold">{orderStats?.pendingOrders ?? 0} pending orders</span>
            {(orderStats?.pendingReturns ?? 0) > 0 && <> and <span className="font-bold">{orderStats!.pendingReturns} return requests</span></>}
            {' '}need your attention.
          </p>
          <Link href="/admin/orders" className="ml-auto text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 shrink-0 transition-colors">
            Review <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── Today snapshot ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Revenue Today"   value={fmt2(orderStats?.todayRevenue ?? 0)} sub="Non-cancelled"     icon={TrendingUp}  iconBg="bg-blue-50"   iconColor="text-blue-600"   />
          <KpiCard label="Orders Today"    value={orderStats?.ordersToday ?? 0}          sub="All statuses"     icon={ShoppingBag} iconBg="bg-slate-100" iconColor="text-slate-600"  href="/admin/orders" />
          <KpiCard label="New Customers"   value={authStats?.newToday ?? 0}              sub="Registered today" icon={Users}       iconBg="bg-slate-100" iconColor="text-slate-600"  href="/admin/customers" />
          <KpiCard label="Pending Returns" value={orderStats?.pendingReturns ?? 0}       sub="Awaiting review"  icon={RotateCcw}   iconBg="bg-amber-50"  iconColor="text-amber-600" href="/admin/returns" />
        </div>
      </div>

      {/* ── Order pipeline ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Order Pipeline</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Processing', value: orderStats?.processingOrders ?? 0, icon: Clock,        iconBg: 'bg-blue-50',  iconColor: 'text-blue-500',  border: 'border-blue-100' },
            { label: 'In Transit', value: orderStats?.inTransitOrders ?? 0,  icon: Truck,        iconBg: 'bg-amber-50', iconColor: 'text-amber-500', border: 'border-amber-100' },
            { label: 'Delivered',  value: orderStats?.deliveredOrders ?? 0,  icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100' },
            { label: 'Cancelled',  value: orderStats?.cancelledOrders ?? 0,  icon: XCircle,      iconBg: 'bg-red-50',   iconColor: 'text-red-400',   border: 'border-red-100' },
          ].map(({ label, value, icon: Icon, iconBg, iconColor, border }) => (
            <Link key={label} href="/admin/orders"
              className={`bg-white border ${border} rounded-2xl p-4 flex items-center gap-3 hover:shadow-sm transition-all group`}
            >
              <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-slate-900">{value}</p>
                <p className="text-xs font-semibold text-slate-400 truncate">{label}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 ml-auto transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent orders + pending returns ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Recent Orders" href="/admin/orders">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <Package className="w-7 h-7 mb-2" /><p className="text-xs">No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recent.map(o => (
                <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{o.receiptNumber ?? o.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-400 truncate">{o.shippingAddress}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-slate-800">{fmt2(o.total)}</p>
                    <p className="text-[10px] text-slate-400">{timeAgo(o.date)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pending Returns" href="/admin/returns" linkLabel="Manage">
          {returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <CheckCircle2 className="w-7 h-7 mb-2" /><p className="text-xs">No pending returns</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {returns.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{r.receipt_number}</p>
                    <p className="text-xs text-slate-400 truncate">{r.reason}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 shrink-0">{timeAgo(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ════════ ANALYTICS ════════════════════════════════════════════════════ */}
      <div className="pt-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Analytics & Insights</p>

        {/* Date filter */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex flex-wrap items-center gap-5 mb-4">
          {/* View Type buttons */}
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">View Type</p>
            <div className="flex gap-1.5">
              {([
                { key: 'overall', label: 'Overall' },
                { key: 'month',   label: 'Month'   },
                { key: 'year',    label: 'Year'    },
                { key: 'compare', label: 'Compare' },
              ] as { key: ViewType; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setViewType(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border ${
                    viewType === key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Year selector — hidden in Overall */}
          {viewType !== 'overall' && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                {viewType === 'compare' ? 'Year A' : 'Year'}
              </p>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-400">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Month selector — only in month view */}
          {viewType === 'month' && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Month</p>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-400">
                {MONTHS_LONG.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Year B — only in compare */}
          {viewType === 'compare' && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Year B</p>
              <select value={compareYear} onChange={e => setCompareYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-400">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <div className="ml-auto text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Showing</p>
            <p className="text-sm font-bold text-blue-600">{periodLabel}</p>
          </div>
        </div>

        {/* Period KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Period Revenue"  value={fmt(periodRevenue)}            sub={periodLabel}           icon={TrendingUp}  iconBg="bg-blue-50"   iconColor="text-blue-600"  />
          <KpiCard label="Period Orders"   value={periodOrders}                   sub={`${delivered} delivered`} icon={ShoppingBag} iconBg="bg-slate-100" iconColor="text-slate-600" />
          <KpiCard label="Fulfillment"     value={`${fulfillment}%`}              sub="Orders delivered"      icon={CheckCircle2} iconBg="bg-green-50"  iconColor="text-green-600" />
          <KpiCard label="All Customers"   value={authStats?.totalCustomers ?? 0} sub="Total registered"      icon={Users}        iconBg="bg-slate-100" iconColor="text-slate-600" />
        </div>

        {/* Row 1 — Revenue + Orders */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <ChartCard title={`Revenue — ${periodLabel}`}>
            <ResponsiveContainer width="100%" height={220}>
              {viewType === 'compare' ? (
                <LineChart data={timeSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip {...TT} formatter={(v: number, n: string) => [fmt(v), n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={String(year)}        stroke={C_BLUE}  strokeWidth={2.5} dot={{ r: 3, fill: C_BLUE }}  activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey={String(compareYear)} stroke={C_SLATE} strokeWidth={2}   dot={{ r: 3, fill: C_SLATE }} activeDot={{ r: 5 }} strokeDasharray="5 4" />
                </LineChart>
              ) : (
                <AreaChart data={timeSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C_BLUE} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C_BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: viewType==='month' ? 10 : 11, fill: '#94a3b8' }} interval={viewType==='month' ? 4 : 0} />
                  <YAxis tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip {...TT} formatter={(v: number) => [fmt(v), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke={C_BLUE} strokeWidth={2} fill="url(#rg)" dot={false} activeDot={{ r: 4, fill: C_BLUE }} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={`Orders — ${periodLabel}`}>
            <ResponsiveContainer width="100%" height={220}>
              {viewType === 'compare' ? (
                <BarChart data={timeSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={String(year)}        fill={C_BLUE}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey={String(compareYear)} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={timeSeries} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: viewType==='month' ? 10 : 11, fill: '#94a3b8' }} interval={viewType==='month' ? 4 : 0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip {...TT} formatter={(v: number) => [v, 'Orders']} />
                  <Bar dataKey="orders" fill={C_INDIGO} radius={[4, 4, 0, 0]}>
                    {(timeSeries as { label: string; orders?: number }[]).map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? C_INDIGO : '#818cf8'} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Row 2 — Status + Payment + Fulfillment */}
        <div className="grid lg:grid-cols-3 gap-4 mb-4">
          <ChartCard title="Orders by Status">
            {periodOrders === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value">
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...TT} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Payment Methods">
            {paymentData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" outerRadius={76} paddingAngle={3} dataKey="value">
                    {paymentData.map((_, i) => <Cell key={i} fill={CHART_PAL[i % CHART_PAL.length]} />)}
                  </Pie>
                  <Tooltip {...TT} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Fulfillment Rate">
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius={50} outerRadius={76} startAngle={90} endAngle={-270} data={radialData}>
                  <RadialBar dataKey="value" cornerRadius={6} />
                  <Tooltip {...TT} formatter={(v: number) => [`${v}%`, '']} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-black text-slate-900">{fulfillment}%</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Delivered</p>
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Row 3 — Top products + Category */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <ChartCard title="Top Products by Units Sold">
            {topProducts.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={115} />
                  <Tooltip {...TT} formatter={(v: number) => [v, 'Units']} />
                  <Bar dataKey="qty" radius={[0, 5, 5, 0]}>
                    {topProducts.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? C_GREEN : i < 3 ? '#22c55e99' : '#86efac'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Revenue by Category">
            {categoryData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                  <Tooltip {...TT} formatter={(v: number) => [fmt(v), 'Revenue']} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_PAL[i % CHART_PAL.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="grid items-start lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] gap-4 mb-4">
          <ChartCard title={`Products Bought Together — ${periodLabel}`}>
            {basketAnalysis.rows.length === 0 ? <EmptyChart label="Not enough data yet. Need more orders with 2+ different products." /> : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    How many times each product pair was purchased in the same order — from {basketAnalysis.eligibleOrders.toLocaleString()} orders.
                  </p>
                  {topBasketPair && (
                    <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                      🏆 Top pair: {topBasketPair.count} {topBasketPair.count === 1 ? 'order' : 'orders'}
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={Math.max(120, basketAnalysis.rows.slice(0,6).length * 52)}>
                  <BarChart data={basketAnalysis.rows.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Times bought together', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="pair" tick={{ fontSize: 10, fill: '#64748b' }} width={190} />
                    <Tooltip
                      {...TT}
                      formatter={(value: number) => [value, 'Times bought together']}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as BasketPairRow | undefined;
                        if (!row) return '';
                        return `${row.confidence}% of buyers purchased both`;
                      }}
                    />
                    <Bar dataKey="count" barSize={28} radius={[0, 6, 6, 0]}>
                      {basketAnalysis.rows.slice(0,6).map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C_BLUE : i < 3 ? '#60a5fa' : '#bfdbfe'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </ChartCard>

          <ChartCard title="Product Pairing Insights">
            {basketAnalysis.rows.length === 0 ? <EmptyChart label="No strong product pairings found yet" /> : (
              <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1 pt-1">
                {basketAnalysis.rows.slice(0, 6).map((row, i) => {
                  const strength = row.lift >= 3 ? { label: 'Very Strong', color: 'bg-green-500' }
                                 : row.lift >= 2 ? { label: 'Strong',      color: 'bg-blue-500'  }
                                 :                 { label: 'Moderate',    color: 'bg-amber-400' };
                  return (
                    <div key={`${row.left}-${row.right}-${i}`} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      {/* Product names */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 bg-blue-50 px-2 py-0.5 rounded-lg">{row.left}</span>
                            <span className="text-slate-400 text-xs font-bold">+</span>
                            <span className="text-xs font-bold text-slate-800 bg-green-50 px-2 py-0.5 rounded-lg">{row.right}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-white text-[10px] font-bold ${strength.color}`}>
                          {strength.label}
                        </span>
                      </div>
                      {/* Plain-English stats */}
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>🛒 Bought together</span>
                          <span className="font-bold text-slate-900">{row.count} {row.count === 1 ? 'time' : 'times'} ({row.support}% of orders)</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>👥 Buyers who add both</span>
                          <span className="font-bold text-slate-900">{row.confidence}% of the time</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>📈 Connection strength</span>
                          <span className="font-bold text-slate-700">{row.lift}× more likely than by chance</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>

        {/* Row 4 — Return status + Searches + Views */}
        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Return Requests by Status">
            {returnStatusData.length === 0 ? <EmptyChart label="No return requests yet" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={returnStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value">
                    {returnStatusData.map((e, i) => (
                      <Cell key={i} fill={
                        e.name === 'pending'   ? C_AMBER :
                        e.name === 'reviewing' ? C_BLUE  :
                        e.name === 'approved'  ? C_GREEN :
                        e.name === 'rejected'  ? C_RED   : '#94a3b8'
                      } />
                    ))}
                  </Pie>
                  <Tooltip {...TT} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
                    formatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top Search Queries">
            {searches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Search className="w-6 h-6 mb-2" /><p className="text-xs">No search data yet</p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {searches.slice(0, 8).map((row, i) => (
                  <div key={row.query} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs text-slate-600 flex-1 truncate">{row.query}</span>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((row.count / searches[0].count) * 100)}%`, background: C_BLUE, opacity: 0.7 }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 shrink-0 w-5 text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Most Viewed Products">
            {views.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Eye className="w-6 h-6 mb-2" /><p className="text-xs">No view data yet</p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {views.slice(0, 6).map((row, i) => {
                  const name = productNames[String(row.product_id)] ?? `Product #${row.product_id}`;
                  return (
                  <div key={row.product_id} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
                      <p className="text-[9px] text-slate-400">{row.category}</p>
                    </div>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((row.total_views / views[0].total_views) * 100)}%`, background: C_INDIGO, opacity: 0.7 }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500 shrink-0 w-5 text-right">{row.total_views}</span>
                  </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
