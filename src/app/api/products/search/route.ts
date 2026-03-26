import { NextResponse } from 'next/server';
import { queryProducts } from '@/lib/product-catalog';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const branchId = parseNumber(searchParams.get('branchId'));
    const limit = parseNumber(searchParams.get('limit'));
    const data = await queryProducts({
      q,
      category: searchParams.get('category')?.trim() || undefined,
      minPrice: parseNumber(searchParams.get('minPrice')),
      maxPrice: parseNumber(searchParams.get('maxPrice')),
      branchId,
      inStockOnly: searchParams.get('inStockOnly') === 'true',
      limit,
    });

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        q,
      },
    });
  } catch (error) {
    console.error('Product search API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
