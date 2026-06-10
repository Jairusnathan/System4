/**
 * kafka-backfill.ts
 *
 * Publishes transaction events from Supabase to Kafka via APICenter.
 * These events are aggregated in S3 Bronze and become available via Athena.
 *
 * Transaction events included:
 *   - order_placed (online_orders)
 *   - fulfillment_status_changed (online_orders)
 *   - order_cancelled (online_orders with Cancelled status)
 *   - payment_status_changed (online_orders with payment_status != pending)
 *   - return_request_created (return_requests)
 *   - transaction_created (transactions linked to orders)
 *   - transaction_item_added (transaction_items linked to transactions)
 *
 * ✅ Supabase data is READ ONLY — nothing is modified or deleted.
 * ✅ Safe to re-run — duplicate events handled by pipeline.
 *
 * Usage (from greenovate-be/ directory):
 *   npx ts-node scripts/kafka-backfill.ts
 *
 * Env vars are loaded automatically from:
 *   ./order-service/.env
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// ENV LOADER
// ─────────────────────────────────────────────────────────────────────────────

function loadEnvFile(filepath: string): void {
  try {
    for (const line of readFileSync(filepath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch { /* file not found — fall through to process.env */ }
}

loadEnvFile(resolve(process.cwd(), 'order-service/.env'));
loadEnvFile(resolve(process.cwd(), 'auth-service/.env'));

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const APICENTER_URL = (
  process.env.APICENTER_URL ??
  process.env.OOS_ORDER_APICENTER_URL ??
  ''
).replace(/\/$/, '');

const APICENTER_TRIBE_ID =
  process.env.APICENTER_TRIBE_ID ??
  process.env.OOS_ORDER_APICENTER_TRIBE_ID ?? '';

const APICENTER_TRIBE_SECRET =
  process.env.APICENTER_TRIBE_SECRET ??
  process.env.OOS_ORDER_APICENTER_TRIBE_SECRET ?? '';

const ORDER_SUPABASE_URL   = process.env.OOS_ORDER_SUPABASE_URL ?? '';
const ORDER_SUPABASE_KEY   = process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY ?? '';
const AUTH_SUPABASE_URL    = process.env.OOS_AUTH_SUPABASE_URL ?? '';
const AUTH_SUPABASE_KEY    = process.env.OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY ?? '';

const BATCH_SIZE    = 50;   // events published in parallel per chunk
const BATCH_DELAY   = 150;  // ms delay between chunks to avoid rate limiting
const PAGE_SIZE     = 1000; // rows fetched per Supabase page

// ─────────────────────────────────────────────────────────────────────────────
// APICENTER CLIENT (raw fetch — no SDK import needed)
// ─────────────────────────────────────────────────────────────────────────────

let _accessToken: string | null = null;
let _tokenExpiry  = 0;

async function getToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry - 30_000) return _accessToken;

  const res = await fetch(`${APICENTER_URL}/api/v1/auth/token`, {
    method : 'POST',
    headers: {
      'Content-Type'  : 'application/json',
      'X-SDK-Version' : '1.1.2',
      'X-SDK-Tribe-Id': APICENTER_TRIBE_ID,
    },
    body: JSON.stringify({ tribeId: APICENTER_TRIBE_ID, secret: APICENTER_TRIBE_SECRET }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`APICenter auth failed (${res.status}): ${text}`);
  }

  const body = await res.json() as any;
  const data = body?.data ?? body;
  _accessToken = data.accessToken as string;
  _tokenExpiry  = Date.now() + ((data.expiresIn as number) ?? 3600) * 1000;
  return _accessToken;
}

async function kafkaPublish(
  topic    : string,
  eventType: string,
  payload  : Record<string, unknown>,
  key?     : string,
): Promise<void> {
  const token = await getToken();

  const res = await fetch(`${APICENTER_URL}/api/v1/kafka/publish`, {
    method : 'POST',
    headers: {
      'Content-Type'  : 'application/json',
      'Authorization' : `Bearer ${token}`,
      'X-Tribe-Id'    : APICENTER_TRIBE_ID,
      'X-SDK-Tribe-Id': APICENTER_TRIBE_ID,
      'X-SDK-Version' : '1.1.2',
    },
    body: JSON.stringify({ topic, eventType, payload, ...(key ? { key } : {}) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Publish failed (${res.status}): ${text}`);
  }
}

function buildTopic(suffix: string): string {
  const id = APICENTER_TRIBE_ID.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const topicMap: Record<string, string> = {
    orders  : 'events',
    users   : 'events',
    products: 'events',
    returns : 'events',
    admin   : 'audit',
  };
  const s = suffix.trim().toLowerCase();
  return `tribe.${id}.${topicMap[s] ?? s}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

let totalPublished = 0;
let totalFailed    = 0;

async function tryPublish(
  topic    : string,
  eventType: string,
  payload  : Record<string, unknown>,
  key?     : string,
): Promise<void> {
  try {
    await kafkaPublish(topic, eventType, payload, key);
    totalPublished++;
  } catch (err) {
    totalFailed++;
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`\n    ⚠  ${eventType} failed: ${msg}\n`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE PAGINATION (handles tables with > 1000 rows)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAll<T>(
  db     : SupabaseClient,
  table  : string,
  select : string,
  filter?: (query: any) => any,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    let q = db.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PUBLISHER
// ─────────────────────────────────────────────────────────────────────────────

async function processBatch<T>(
  label  : string,
  items  : T[],
  handler: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    console.log(`  ○  ${label}: 0 records — skipping`);
    return;
  }

  console.log(`  •  ${label}: ${items.length} records`);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(handler));
    const done = Math.min(i + BATCH_SIZE, items.length);
    process.stdout.write(`     ↑ ${done}/${items.length}\r`);
    if (done < items.length) await sleep(BATCH_DELAY);
  }

  process.stdout.write(`     ✓ ${items.length}/${items.length}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {

  // ── Validate env vars ────────────────────────────────────────────────────
  const missing = [
    ['APICENTER_URL',                        APICENTER_URL],
    ['APICENTER_TRIBE_ID',                   APICENTER_TRIBE_ID],
    ['APICENTER_TRIBE_SECRET',               APICENTER_TRIBE_SECRET],
    ['OOS_ORDER_SUPABASE_URL',               ORDER_SUPABASE_URL],
    ['OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY',  ORDER_SUPABASE_KEY],
    ['OOS_AUTH_SUPABASE_URL',                AUTH_SUPABASE_URL],
    ['OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY',   AUTH_SUPABASE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);

  if (missing.length > 0) {
    console.error('\n❌  Missing environment variables:');
    missing.forEach(k => console.error(`    - ${k}`));
    console.error('\nMake sure order-service/.env and auth-service/.env are present.\n');
    process.exit(1);
  }

  // ── Banner ───────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        KAFKA BACKFILL SCRIPT — nexOOS / System 4       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`  APICenter : ${APICENTER_URL}`);
  console.log(`  Tribe ID  : ${APICENTER_TRIBE_ID}`);
  console.log(`  Batch size: ${BATCH_SIZE}  |  Page size: ${PAGE_SIZE}`);
  console.log('  ⚠  Supabase is READ ONLY — no data will be modified.\n');

  // ── Auth ─────────────────────────────────────────────────────────────────
  process.stdout.write('🔐 Authenticating with APICenter... ');
  await getToken();
  console.log('✓\n');

  // ── Init Supabase ────────────────────────────────────────────────────────
  const orderDb = createClient(ORDER_SUPABASE_URL, ORDER_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Topic names ──────────────────────────────────────────────────────────
  const T = {
    orders  : buildTopic('orders'),
    returns : buildTopic('returns'),
    users   : buildTopic('users'),
    products: buildTopic('products'),
    admin   : buildTopic('admin'),
  };

  // ═════════════════════════════════════════════════════════════════════════
  // ORDER SUPABASE
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  ORDER SUPABASE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── online_orders ────────────────────────────────────────────────────────
  const orders = await fetchAll<any>(
    orderDb,
    'online_orders',
    'id, order_number, receipt_number, customer_id, branch_id, subtotal, delivery_fee, discount_amount, total, promo_code, payment_method, payment_status, fulfillment_status, delivery_method, shipping_address, cancellation_reason, cancelled_at, created_at, online_order_items(product_id, product_name, category, unit_price, quantity, line_total)',
  );

  await processBatch('online_orders → order_placed', orders, async (order: any) => {
    await tryPublish(T.orders, 'order_placed', {
      order_id        : order.id,
      order_number    : order.order_number,
      receipt_number  : order.receipt_number,
      customer_id     : order.customer_id,
      branch_id       : order.branch_id,
      items           : (order.online_order_items ?? []).map((i: any) => ({
        product_id : i.product_id,
        name       : i.product_name,
        category   : i.category,
        unit_price : Number(i.unit_price),
        quantity   : Number(i.quantity),
        line_total : Number(i.line_total),
      })),
      subtotal        : Number(order.subtotal),
      delivery_fee    : Number(order.delivery_fee),
      discount_amount : Number(order.discount_amount),
      total           : Number(order.total),
      promo_code      : order.promo_code ?? null,
      payment_method  : order.payment_method,
      delivery_method : order.delivery_method ?? null,
      shipping_address: order.shipping_address,
      created_at      : order.created_at,
    }, order.id);
  });

  // fulfillment_status_changed — for orders that moved past Processing
  const nonProcessing = orders.filter((o: any) => o.fulfillment_status !== 'Processing');
  await processBatch('online_orders → fulfillment_status_changed', nonProcessing, async (order: any) => {
    await tryPublish(T.orders, 'fulfillment_status_changed', {
      order_id           : order.id,
      receipt_number     : order.receipt_number,
      previous_status    : 'Processing',
      new_status         : order.fulfillment_status,
      cancellation_reason: order.cancellation_reason ?? null,
      cancelled_at       : order.cancelled_at ?? null,
    }, order.id);
  });

  // order_cancelled — for cancelled orders
  const cancelled = orders.filter((o: any) => o.fulfillment_status === 'Cancelled' && o.cancelled_at);
  await processBatch('online_orders → order_cancelled', cancelled, async (order: any) => {
    await tryPublish(T.orders, 'order_cancelled', {
      order_id           : order.id,
      receipt_number     : order.receipt_number,
      cancellation_reason: order.cancellation_reason ?? null,
      cancelled_at       : order.cancelled_at,
    }, order.id);
  });

  // payment_status_changed — for orders with payment status != pending
  const paidOrFailed = orders.filter((o: any) => o.payment_status !== 'pending');
  await processBatch('online_orders → payment_status_changed', paidOrFailed, async (order: any) => {
    await tryPublish(T.orders, 'payment_status_changed', {
      order_id       : order.id,
      receipt_number : order.receipt_number,
      payment_status : order.payment_status,
      payment_method : order.payment_method,
      total          : Number(order.total),
    }, order.id);
  });

  // ── return_requests ──────────────────────────────────────────────────────
  const returns = await fetchAll<any>(orderDb, 'return_requests', '*');
  await processBatch('return_requests → return_request_created', returns, async (r: any) => {
    await tryPublish(T.returns, 'return_request_created', {
      order_id      : r.online_order_id,
      customer_id   : r.customer_id,
      receipt_number: r.receipt_number,
      reason        : r.reason,
      description   : r.description ?? null,
      items         : r.items ?? [],
      status        : r.status,
      created_at    : r.created_at,
    }, r.online_order_id);
  });

  // ── transactions ───────────────────────────────────────────────────────────
  // Get OOS transaction IDs (linked to online_orders)
  const orderTransactionIds = new Set(
    (orders ?? []).map((o: any) => o.transaction_id).filter(Boolean)
  );

  if (orderTransactionIds.size > 0) {
    const transactions = await fetchAll<any>(
      orderDb,
      'transactions',
      'id, tx_no, status, total_amount, payment_method, created_at',
      (q) => q.in('id', Array.from(orderTransactionIds) as string[])
    );

    await processBatch('transactions → transaction_created', transactions, async (tx: any) => {
      await tryPublish(T.orders, 'transaction_created', {
        transaction_id : tx.id,
        tx_no          : tx.tx_no,
        status         : tx.status,
        total_amount   : Number(tx.total_amount),
        payment_method : tx.payment_method,
        created_at     : tx.created_at,
      }, tx.id);
    });
  }

  // ── transaction_items ──────────────────────────────────────────────────────
  if (orderTransactionIds.size > 0) {
    const transactionItems = await fetchAll<any>(
      orderDb,
      'transaction_items',
      'id, transaction_id, name, category, unit_price, quantity, line_total, created_at',
      (q) => q.in('transaction_id', Array.from(orderTransactionIds) as string[])
    );

    await processBatch('transaction_items → transaction_item_added', transactionItems, async (item: any) => {
      await tryPublish(T.orders, 'transaction_item_added', {
        transaction_id: item.transaction_id,
        item_id       : item.id,
        name          : item.name,
        category      : item.category,
        unit_price    : Number(item.unit_price),
        quantity      : Number(item.quantity),
        line_total    : Number(item.line_total),
        created_at    : item.created_at,
      }, item.transaction_id);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TRANSACTION-ONLY BACKFILL — COMPLETE
  // ═════════════════════════════════════════════════════════════════════════
  // Note: Auth Supabase tables (customers, browsing_history, search_analytics,
  // audit_logs) are excluded — this backfill focuses on transaction events only.

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                   BACKFILL COMPLETE                    ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Published : ${String(totalPublished).padEnd(39)}║`);
  console.log(`║  ${totalFailed > 0 ? '⚠ ' : '✅'} Failed    : ${String(totalFailed).padEnd(39)}║`);
  console.log('╚════════════════════════════════════════════════════════╝');

  if (totalFailed > 0) {
    console.log('\n⚠  Some events failed. Re-run the script — it is safe to run multiple times.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All historical data is now flowing to S3 via Kafka.\n');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
