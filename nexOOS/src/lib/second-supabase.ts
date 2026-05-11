import { createClient } from '@supabase/supabase-js';

const secondSupabaseUrl =
  process.env.SECOND_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SECOND_SUPABASE_URL ||
  '';
const secondSupabaseAnonKey =
  process.env.SECOND_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SECOND_SUPABASE_ANON_KEY ||
  '';
const secondSupabaseServiceRoleKey =
  process.env.SECOND_SUPABASE_SERVICE_ROLE_KEY || '';

if (!secondSupabaseUrl || !secondSupabaseAnonKey) {
  console.warn(
    'Second Supabase credentials missing. Set SECOND_SUPABASE_URL/NEXT_PUBLIC_SECOND_SUPABASE_URL and SECOND_SUPABASE_ANON_KEY/NEXT_PUBLIC_SECOND_SUPABASE_ANON_KEY.'
  );
}

export const secondSupabase = createClient(
  secondSupabaseUrl,
  secondSupabaseAnonKey
);

export const secondSupabaseAdmin = createClient(
  secondSupabaseUrl,
  secondSupabaseServiceRoleKey || secondSupabaseAnonKey
);
