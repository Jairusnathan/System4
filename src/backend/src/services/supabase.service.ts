import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '',
  );

  readonly secondSupabase = createClient(
    process.env.SECOND_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SECOND_SUPABASE_URL ||
      '',
    process.env.SECOND_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SECOND_SUPABASE_ANON_KEY ||
      '',
  );

  readonly secondSupabaseAdmin = createClient(
    process.env.SECOND_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SECOND_SUPABASE_URL ||
      '',
    process.env.SECOND_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SECOND_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SECOND_SUPABASE_ANON_KEY ||
      '',
  );
}
