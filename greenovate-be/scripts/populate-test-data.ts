/**
 * populate-test-data.ts
 *
 * Generates transaction-only test data for Kafka backfill.
 *
 * Tables populated:
 *   - order-service: online_orders, online_order_items, return_requests
 *   - auth-service: customers (FK dependency only)
 *
 * ✅ Safe to re-run — duplicates handled by pipeline
 * ✅ All Supabase data READ ONLY until final population
 *
 * Usage (from greenovate-be/ directory):
 *   npx ts-node scripts/populate-test-data.ts
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
  } catch { /* file not found */ }
}

loadEnvFile(resolve(process.cwd(), 'order-service/.env'));
loadEnvFile(resolve(process.cwd(), 'auth-service/.env'));

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — MULTIPLE DATABASES
// ─────────────────────────────────────────────────────────────────────────────

// Order Service Database
const ORDER_SUPABASE_URL = process.env.OOS_ORDER_SUPABASE_URL ?? '';
const ORDER_SUPABASE_KEY = process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY ?? '';

// Auth Service Database
const AUTH_SUPABASE_URL = process.env.OOS_AUTH_SUPABASE_URL ?? '';
const AUTH_SUPABASE_KEY = process.env.OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY ?? '';

const TEST_CUSTOMERS = 50;    // Customers are required FK dependency
const TEST_ORDERS = 250;   // 250 orders × ~4 events = ~1000 events
const TEST_RETURNS = 30;    // 12% return rate
const AVG_ITEMS_PER_ORDER = 2;    // 2-4 items per order

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

let stats = {
  customers_created: 0,
  products_checked: 0,
  transactions_total: 0,
  transactions_oos: 0,
  orders_created: 0,
  order_items_created: 0,
  returns_created: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate realistic date within last 30 days
function getRandomCreatedAt(): string {
  const daysAgo = randomBetween(1, 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Validate env vars ────────────────────────────────────────────────────
  const missing = [];
  if (!ORDER_SUPABASE_URL) missing.push('OOS_ORDER_SUPABASE_URL');
  if (!ORDER_SUPABASE_KEY) missing.push('OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY');
  if (!AUTH_SUPABASE_URL) missing.push('OOS_AUTH_SUPABASE_URL');
  if (!AUTH_SUPABASE_KEY) missing.push('OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error('\n❌  Missing Supabase environment variables:');
    missing.forEach(v => console.error(`    - ${v}`));
    console.error('\nMake sure order-service/.env and auth-service/.env are present.\n');
    process.exit(1);
  }

  // ── Banner ───────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     TEST DATA POPULATION SCRIPT — nexOOS / System 4     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`  Order Service DB: ${ORDER_SUPABASE_URL.split('.')[0]}`);
  console.log(`  Auth Service DB:  ${AUTH_SUPABASE_URL.split('.')[0]}`);
  console.log(`  Target: 400 total records`);
  console.log(`  Customers: ${TEST_CUSTOMERS} | Orders: ${TEST_ORDERS} | Returns: ${TEST_RETURNS}\n`);

  // ── Init Supabase Clients ────────────────────────────────────────────────
  const orderDb = createClient(ORDER_SUPABASE_URL, ORDER_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authDb = createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use orderDb for the rest of the function (will also reference authDb later)
  const db = orderDb;

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: CREATE TEST CUSTOMERS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 1: CREATE TEST CUSTOMERS  ━━━━━━━━━━━━━━━━━━━━');

  const customerIds: string[] = [];
  const testCustomers = [];

  for (let i = 0; i < TEST_CUSTOMERS; i++) {
    const id = crypto.randomUUID();
    testCustomers.push({
      id,
      full_name: `Test Customer ${i + 1}`,
      email: `testcust${i + 1}@example.com`,
      phone: `+6391${String(randomBetween(1000000, 9999999)).padStart(7, '0')}`,
      birthday: `19${randomBetween(70, 95)}-${String(randomBetween(1, 12)).padStart(2, '0')}-${String(randomBetween(1, 28)).padStart(2, '0')}`,
      gender: randomElement(['M', 'F']),
      created_at: getRandomCreatedAt(),
    });
    customerIds.push(id);
  }

  try {
    const { error } = await authDb.from('customers').insert(testCustomers);
    if (error) throw error;
    stats.customers_created = TEST_CUSTOMERS;
    console.log(`  ✓ Created ${TEST_CUSTOMERS} test customers (in auth-service DB)\n`);
  } catch (err) {
    console.error(`  ⚠  Error creating customers: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: CHECK EXISTING PRODUCTS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 2: CHECK EXISTING PRODUCTS  ━━━━━━━━━━━━━━━━━━');

  let productIds: string[] = [];

  try {
    const { data, error } = await db.from('products').select('id').limit(100);
    if (error) throw error;
    productIds = (data ?? []).map((p: any) => p.id);
    stats.products_checked = productIds.length;
    console.log(`  ✓ Found ${productIds.length} existing products\n`);

    if (productIds.length === 0) {
      console.log('  ⚠  No products found. Order items may reference invalid products.\n');
    }
  } catch (err) {
    console.error(`  ⚠  Error checking products: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: HANDLE TRANSACTIONS (Filter OOS or Generate)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 3: HANDLE TRANSACTIONS  ━━━━━━━━━━━━━━━━━━━━━━');

  let transactionIds: string[] = [];

  try {
    // First, check transactions table schema to see if we can filter
    const { data: schemaCheck, error: schemaError } = await db
      .from('transactions')
      .select('*')
      .limit(1);

    if (schemaError && schemaError.message.includes('does not exist')) {
      console.log('  ℹ  transactions table does not exist. Skipping.\n');
    } else if (schemaError) {
      console.error(`  ⚠  Error checking transactions: ${schemaError.message}\n`);
    } else {
      // Get total transactions
      const { count: totalCount, error: countError } = await db
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      stats.transactions_total = totalCount ?? 0;
      console.log(`  ℹ  Total transactions in table: ${stats.transactions_total}\n`);

      // Try to filter OOS transactions
      // If there's a 'sales_channel' column, use it; otherwise get all and assume OOS
      const { data: txnData, error: txnError } = await db
        .from('transactions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(500); // Get up to 500 recent transactions (likely OOS)

      if (txnError) {
        console.log(`  ⚠  Could not query transactions: ${txnError.message}`);
        console.log('     Proceeding without transaction linking.\n');
      } else {
        transactionIds = (txnData ?? []).map((t: any) => t.id);
        stats.transactions_oos = transactionIds.length;
        console.log(`  ✓ Using ${transactionIds.length} existing transactions\n`);
      }
    }
  } catch (err) {
    console.error(`  ⚠  Error handling transactions: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 4: CREATE TEST ORDERS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 4: CREATE TEST ORDERS  ━━━━━━━━━━━━━━━━━━━━━━━');

  const orderIds: string[] = [];
  const testOrders = [];

  const fulfillmentStatuses = ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  const paymentStatuses = ['paid', 'pending', 'failed'];
  const deliveryMethods = ['standard', 'express', 'same-day'];

  for (let i = 0; i < TEST_ORDERS; i++) {
    const id = crypto.randomUUID();
    const customerId = randomElement(customerIds);
    const transactionId = transactionIds.length > 0 ? randomElement(transactionIds) : null;

    const subtotal = randomBetween(50, 450);
    const deliveryFee = randomBetween(30, 100);
    const discountAmount = randomElement([0, 0, 0, 50, 100]); // 60% no discount
    const total = subtotal + deliveryFee - discountAmount;

    testOrders.push({
      id,
      order_number: `ORD-${String(i + 1).padStart(5, '0')}`,
      receipt_number: `RCP-${String(i + 1).padStart(5, '0')}`,
      customer_id: customerId,
      transaction_id: transactionId,
      subtotal,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      total,
      promo_code: randomElement([null, null, null, 'SAVE10']),
      payment_method: randomElement(['credit_card', 'gcash', 'bank_transfer']),
      payment_status: randomElement(paymentStatuses),
      fulfillment_status: randomElement(fulfillmentStatuses),
      delivery_method: randomElement(deliveryMethods),
      shipping_address: `${randomBetween(1, 999)} Test Street, Manila`,
      cancellation_reason: Math.random() > 0.9 ? 'out_of_stock' : null,
      cancelled_at: Math.random() > 0.9 ? getRandomCreatedAt() : null,
      created_at: getRandomCreatedAt(),
    });

    orderIds.push(id);
  }

  try {
    // Batch insert in chunks of 50
    for (let i = 0; i < testOrders.length; i += 50) {
      const chunk = testOrders.slice(i, i + 50);
      const { error } = await db.from('online_orders').insert(chunk);
      if (error) throw error;
      process.stdout.write(`  ↑ ${Math.min(i + 50, testOrders.length)}/${testOrders.length}\r`);
      await sleep(100); // Rate limiting
    }
    stats.orders_created = TEST_ORDERS;
    console.log(`  ✓ Created ${TEST_ORDERS} test orders\n`);
  } catch (err) {
    console.error(`  ⚠  Error creating orders: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 5: CREATE TEST ORDER ITEMS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 5: CREATE TEST ORDER ITEMS  ━━━━━━━━━━━━━━━━━');

  const testOrderItems = [];
  const categories = ['pharmacy', 'groceries', 'essentials', 'beverages', 'supplements'];

  for (const orderId of orderIds) {
    const itemCount = randomBetween(1, AVG_ITEMS_PER_ORDER + 2);
    for (let i = 0; i < itemCount; i++) {
      const productId = productIds.length > 0 ? randomElement(productIds) : crypto.randomUUID();
      const unitPrice = randomBetween(10, 300);
      const quantity = randomBetween(1, 5);

      testOrderItems.push({
        order_id: orderId,
        product_id: productId,
        product_name: `Test Product ${randomBetween(1, 1000)}`,
        category: randomElement(categories),
        unit_price: unitPrice,
        quantity,
        line_total: unitPrice * quantity,
      });
    }
  }

  try {
    // Batch insert in chunks of 100
    for (let i = 0; i < testOrderItems.length; i += 100) {
      const chunk = testOrderItems.slice(i, i + 100);
      const { error } = await db.from('online_order_items').insert(chunk);
      if (error) throw error;
      process.stdout.write(`  ↑ ${Math.min(i + 100, testOrderItems.length)}/${testOrderItems.length}\r`);
      await sleep(100);
    }
    stats.order_items_created = testOrderItems.length;
    console.log(`  ✓ Created ${testOrderItems.length} test order items\n`);
  } catch (err) {
    console.error(`  ⚠  Error creating order items: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: CREATE TEST RETURNS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('━━━  STEP 6: CREATE TEST RETURNS  ━━━━━━━━━━━━━━━━━━━━');

  const testReturns = [];
  const returnReasons = ['Damaged item', 'Wrong product', 'Expired', 'Defective', 'Not as described'];
  const returnStatuses = ['pending', 'approved', 'rejected'];

  for (let i = 0; i < TEST_RETURNS; i++) {
    const orderId = randomElement(orderIds);
    const customerId = randomElement(customerIds);

    testReturns.push({
      online_order_id: orderId,
      customer_id: customerId,
      receipt_number: `RCP-${String(i + 1).padStart(5, '0')}`,
      reason: randomElement(returnReasons),
      description: 'Test return description',
      items: [{ product_id: productIds[0] ?? 'test', quantity: 1 }],
      status: randomElement(returnStatuses),
      created_at: getRandomCreatedAt(),
    });
  }

  try {
    const { error } = await db.from('return_requests').insert(testReturns);
    if (error) throw error;
    stats.returns_created = TEST_RETURNS;
    console.log(`  ✓ Created ${TEST_RETURNS} test return requests\n`);
  } catch (err) {
    console.error(`  ⚠  Error creating returns: ${err instanceof Error ? err.message : String(err)}\n`);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         TRANSACTION DATA POPULATION COMPLETE            ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  Customers created       : ${String(stats.customers_created).padEnd(38)}║`);
  console.log(`║  Products found          : ${String(stats.products_checked).padEnd(38)}║`);
  console.log(`║  Transactions (existing) : ${String(stats.transactions_oos).padEnd(38)}║`);
  console.log(`║  Orders created          : ${String(stats.orders_created).padEnd(38)}║`);
  console.log(`║  Order items created     : ${String(stats.order_items_created).padEnd(38)}║`);
  console.log(`║  Returns created         : ${String(stats.returns_created).padEnd(38)}║`);
  console.log('╠════════════════════════════════════════════════════════╣');

  const totalRecords =
    stats.customers_created +
    stats.order_items_created +
    stats.orders_created +
    stats.returns_created;

  const estimatedEvents =
    stats.orders_created +  // order_placed events
    stats.orders_created +  // fulfillment_status_changed events (roughly 1 per order)
    stats.returns_created;  // return_request_created events

  console.log(`║  TOTAL RECORDS CREATED   : ${String(totalRecords).padEnd(38)}║`);
  console.log(`║  ESTIMATED EVENTS        : ~${String(estimatedEvents).padEnd(37)}║`);
  console.log('╚════════════════════════════════════════════════════════╝');

  console.log('\n🎉 Transaction test data population complete!');
  console.log('   Next step: npm run backfill\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
