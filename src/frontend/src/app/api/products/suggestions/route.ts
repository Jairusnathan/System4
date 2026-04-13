import { NextResponse } from 'next/server';
import { getProductSuggestions } from '@/lib/product-catalog';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limit = Number(searchParams.get('limit') ?? '8');

    if (!q) {
      return NextResponse.json({ data: [] });
    }

    const data = await getProductSuggestions(
      q,
      Number.isFinite(limit) && limit > 0 ? limit : 8
    );

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        q,
      },
    });
  } catch (error) {
    console.error('Product suggestions API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
