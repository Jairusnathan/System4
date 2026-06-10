/**
 * check-table-structure.ts
 *
 * Get detailed column info for debugging populate script
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
loadEnvFile(resolve(process.cwd(), 'auth-service/.env'));

const ORDER_SUPABASE_URL = process.env.OOS_ORDER_SUPABASE_URL ?? '';
const ORDER_SUPABASE_KEY = process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY ?? '';
const AUTH_SUPABASE_URL = process.env.OOS_AUTH_SUPABASE_URL ?? '';
const AUTH_SUPABASE_KEY = process.env.OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY ?? '';

async function main() {
  const orderDb = createClient(ORDER_SUPABASE_URL, ORDER_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authDb = createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       TABLE STRUCTURE (For Populate Debugging)         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Check one row from each table to see structure
  const tablesToCheck = [
    { db: authDb, name: 'customers', label: 'AUTH' },
    { db: orderDb, name: 'online_orders', label: 'ORDER' },
    { db: orderDb, name: 'online_order_items', label: 'ORDER' },
    { db: orderDb, name: 'return_requests', label: 'ORDER' },
    { db: authDb, name: 'audit_logs', label: 'AUTH' },
  ];

  for (const table of tablesToCheck) {
    const { data, error } = await table.db
      .from(table.name)
      .select('*')
      .limit(1);

    console.log(`━━━  ${table.name.toUpperCase()} (${table.label} DB)  ━━━━━━━━━━━━━━━`);

    if (error) {
      console.log(`❌ Error: ${error.message}\n`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`⚠️  Table is empty (cannot determine structure)\n`);
      continue;
    }

    const row = data[0];
    console.log(`Columns:`);
    for (const [key, value] of Object.entries(row)) {
      const type = value === null ? 'NULL' : typeof value;
      const sample = value === null ? 'null' : typeof value === 'string' ? `"${value.substring(0, 30)}..."` : value;
      console.log(`  - ${key}: ${type.padEnd(10)} ${sample}`);
    }
    console.log('');
  }
}

main();
