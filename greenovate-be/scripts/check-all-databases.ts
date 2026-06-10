/**
 * check-all-databases.ts
 *
 * Check all service databases and their tables
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

// Load all .env files
loadEnvFile(resolve(process.cwd(), 'order-service/.env'));
loadEnvFile(resolve(process.cwd(), 'auth-service/.env'));
loadEnvFile(resolve(process.cwd(), 'catalog-service/.env'));
loadEnvFile(resolve(process.cwd(), 'delivery-service/.env'));

const services = [
  {
    name: 'order-service',
    url: process.env.OOS_ORDER_SUPABASE_URL,
    key: process.env.OOS_ORDER_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    name: 'auth-service',
    url: process.env.OOS_AUTH_SUPABASE_URL,
    key: process.env.OOS_AUTH_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    name: 'catalog-service',
    url: process.env.OOS_CATALOG_SECOND_SUPABASE_URL,
    key: process.env.OOS_CATALOG_SECOND_SUPABASE_SERVICE_ROLE_KEY,
  },
  {
    name: 'delivery-service',
    url: process.env.OOS_DELIVERY_SUPABASE_URL,
    key: process.env.OOS_DELIVERY_SUPABASE_SERVICE_ROLE_KEY,
  },
];

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║      ALL DATABASES SCHEMA — Multi-Service Check        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  for (const service of services) {
    if (!service.url || !service.key) {
      console.log(`⚠️  ${service.name}: No credentials in .env\n`);
      continue;
    }

    console.log(`\n━━━  ${service.name.toUpperCase()}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`URL: ${service.url.replace('https://', '').split('.')[0]}`);

    const db = createClient(service.url, service.key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    const foundTables: string[] = [];
    const missingTables: string[] = [];

    for (const tableName of commonTables) {
      const { count, error } = await db
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        foundTables.push(`${tableName} (${count} rows)`);
      } else {
        missingTables.push(tableName);
      }
    }

    if (foundTables.length > 0) {
      console.log(`✅ Tables found:`);
      foundTables.forEach(t => console.log(`   - ${t}`));
    }

    if (missingTables.length > 0) {
      console.log(`❌ Tables not found:`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    }

    console.log('');
  }

  console.log('═════════════════════════════════════════════════════════');
  console.log('✅ Multi-database check complete!\n');
}

main();
