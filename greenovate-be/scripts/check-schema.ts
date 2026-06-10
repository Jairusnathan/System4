/**
 * check-schema.ts
 *
 * Diagnostic script to check actual Supabase schema
 * Lists all tables and their columns
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load env
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
  console.log('║         SUPABASE SCHEMA DIAGNOSTIC — Order Service      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in order-service/.env\n');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Get all tables
    console.log('📋 FETCHING ALL TABLES...\n');

    const { data: tables, error: tablesError } = await db
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      // Fallback: try common tables
      console.log('⚠  Could not query information_schema, checking common tables...\n');

      const commonTables = [
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

      for (const tableName of commonTables) {
        const { data, count, error } = await db
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          console.log(`✅ TABLE: ${tableName}`);
          console.log(`   Rows: ${count ?? 0}`);

          // Get column info
          if (data && data.length > 0) {
            const cols = Object.keys(data[0]);
            console.log(`   Columns: ${cols.join(', ')}`);
          }
          console.log('');
        } else {
          console.log(`❌ TABLE: ${tableName} (not found or no access)`);
          console.log(`   Error: ${error.message}\n`);
        }
      }
    } else {
      // Found tables via information_schema
      const tableNames = (tables ?? []).map((t: any) => t.table_name);

      console.log(`Found ${tableNames.length} tables:\n`);

      for (const tableName of tableNames) {
        const { data, count, error } = await db
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error && data) {
          console.log(`✅ TABLE: ${tableName}`);
          console.log(`   Rows: ${count ?? 0}`);
          const cols = Object.keys(data[0]);
          console.log(`   Columns (${cols.length}): ${cols.join(', ')}`);
          console.log('');
        } else {
          console.log(`⚠  TABLE: ${tableName} (empty or no data)`);
          console.log('');
        }
      }
    }

    console.log('\n═════════════════════════════════════════════════════════');
    console.log('✅ Schema check complete!\n');

  } catch (err) {
    console.error('❌ Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
