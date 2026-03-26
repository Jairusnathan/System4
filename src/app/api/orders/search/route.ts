import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const parseLimit = (value: string | null) => {
  const parsed = Number(value ?? '20');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber')?.trim();
    const status = searchParams.get('status')?.trim();
    const limit = parseLimit(searchParams.get('limit'));

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (orderNumber) {
      query = query.or(`order_number.ilike.%${orderNumber}%,id.ilike.%${orderNumber}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data ?? [],
      meta: {
        total: data?.length ?? 0,
        orderNumber,
        status,
      },
    });
  } catch (error) {
    console.error('Order search API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
