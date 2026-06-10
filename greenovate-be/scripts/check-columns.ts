/**
 * check-columns.ts
 *
 * Get detailed column info (names, types, constraints)
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
  } catch { /* file not found */ }
}

loadEnvFile(resolve(process.cwd(), 'order-service/.env'));

const SUPABASE_URL = process.env.OOS_ORDER_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY ?? '';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         DETAILED COLUMN INFO — Order Service           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tablesToCheck = [
    'customers',
    'online_orders',
    'online_order_items',
    'return_requests',
    'transactions',
    'browsing_history',
    'search_analytics',
    'audit_logs',
    'products',
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await db
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${tableName}: ${error.message}\n`);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`⚠️  ${tableName}: No sample data (table empty)`);
        console.log('   Cannot determine columns from empty table\n');
        continue;
      }

      const columns = Object.keys(data[0]);
      console.log(`✅ TABLE: ${tableName}`);
      console.log(`   Columns (${columns.length}):`);

      for (const col of columns) {
        const value = data[0][col];
        const type = value === null ? 'NULL' : typeof value;
        console.log(`     - ${col}: ${type}`);
      }
      console.log('');

    } catch (err) {
      console.log(`❌ ${tableName}: ${err instanceof Error ? err.message : err}\n`);
    }
  }

  console.log('═════════════════════════════════════════════════════════');
  console.log('✅ Column check complete!\n');
}

main();
