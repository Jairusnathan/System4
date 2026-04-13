import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const { data: inventory, error } = await supabase
      .from('branch_inventory')
      .select('*')
      .eq('branch_id', branchId);

    if (error) throw error;

    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
