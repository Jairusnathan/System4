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
    const branchId = parseNumber(searchParams.get('branchId'));
    const minPrice = parseNumber(searchParams.get('minPrice'));
    const maxPrice = parseNumber(searchParams.get('maxPrice'));
    const limit = parseNumber(searchParams.get('limit'));
    const inStockOnly = searchParams.get('inStockOnly') === 'true';
    const q = searchParams.get('q')?.trim() || undefined;
    const category = searchParams.get('category')?.trim() || undefined;
    const categories = searchParams.getAll('category').map((value) => value.trim()).filter(Boolean);
    const sortByParam = searchParams.get('sortBy')?.trim();
    const sortBy =
      sortByParam === 'price-asc' || sortByParam === 'price-desc'
        ? sortByParam
        : 'popularity';

    const data = await queryProducts({
      q,
      category,
      categories,
      minPrice,
      maxPrice,
      branchId,
      inStockOnly,
      limit,
      sortBy,
    });

    return NextResponse.json({
      data,
      meta: {
        total: data.length,
        q,
        category: categories.length > 0 ? categories : category,
        branchId,
        inStockOnly,
        sortBy,
      },
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
