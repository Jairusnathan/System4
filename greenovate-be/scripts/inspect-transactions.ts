/**
 * inspect-transactions.ts
 *
 * Inspect transactions and transaction_items tables
 * Check for OOS-specific data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  } catch { }
}

loadEnvFile(resolve(process.cwd(), 'order-service/.env'));

const ORDER_SUPABASE_URL = process.env.OOS_ORDER_SUPABASE_URL ?? '';
const ORDER_SUPABASE_KEY = process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY ?? '';

async function main() {
  const db = createClient(ORDER_SUPABASE_URL, ORDER_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     TRANSACTIONS & TRANSACTION_ITEMS INSPECTION         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Check transactions table
  console.log('━━━  TRANSACTIONS TABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: txnSample, error: txnError, count: txnCount } = await db
    .from('transactions')
    .select('*', { count: 'exact' })
    .limit(3);

  if (txnError) {
    console.log(`❌ Error: ${txnError.message}\n`);
  } else {
    console.log(`Total rows: ${txnCount}`);
    console.log(`Sample data (first 3 rows):\n`);

    if (txnSample && txnSample.length > 0) {
      const tx = txnSample[0];
      console.log('Columns:');
      for (const [key, value] of Object.entries(tx)) {
        console.log(`  - ${key}: ${typeof value} ${value !== null ? `(${JSON.stringify(value).substring(0, 50)})` : '(null)'}`);
      }
      console.log('');
    }
  }

  // Check transaction_items table
  console.log('━━━  TRANSACTION_ITEMS TABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: txnItems, error: txnItemsError, count: txnItemsCount } = await db
    .from('transaction_items')
    .select('*', { count: 'exact' })
    .limit(3);

  if (txnItemsError) {
    console.log(`⚠️  Table not found or error: ${txnItemsError.message}`);
    console.log(`   (transaction_items may not exist as separate table)\n`);
  } else {
    console.log(`Total rows: ${txnItemsCount}`);
    console.log(`Sample data:\n`);

    if (txnItems && txnItems.length > 0) {
      const item = txnItems[0];
      console.log('Columns:');
      for (const [key, value] of Object.entries(item)) {
        console.log(`  - ${key}: ${typeof value}`);
      }
      console.log('');
    }
  }

  // Check how transactions relate to online_orders
  console.log('━━━  RELATIONSHIP: transactions ↔ online_orders  ━━━━━━━━━━━━━');

  const { data: linkedOrders, error: linkedError } = await db
    .from('online_orders')
    .select('id, transaction_id, order_number, payment_status')
    .limit(5);

  if (linkedError) {
    console.log(`❌ Error: ${linkedError.message}\n`);
  } else {
    console.log(`Online orders reference transactions via transaction_id:\n`);
    if (linkedOrders) {
      linkedOrders.forEach((o: any) => {
        console.log(`  Order: ${o.order_number} → Transaction: ${o.transaction_id}`);
      });
    }
    console.log('');
  }

  console.log('═════════════════════════════════════════════════════════');
  console.log('✅ Inspection complete!\n');
}

main();
