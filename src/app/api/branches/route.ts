import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json(branches);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
