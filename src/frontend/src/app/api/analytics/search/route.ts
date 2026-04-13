import { NextResponse } from 'next/server';
import { trackSearchQuery } from '@/lib/search-analytics';

export async function POST(request: Request) {
  try {
    const { query, source } = await request.json();

    if (!query?.trim() || !source?.trim()) {
      return NextResponse.json(
        { error: 'Query and source are required' },
        { status: 400 }
      );
    }

    await trackSearchQuery(query, source);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Search analytics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
