import { NextResponse } from 'next/server';
import { listCityNamesByProvince, listProvinceNames } from '@/lib/philippine-locations';

const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');

  if (scope === 'provinces') {
    return NextResponse.json(
      { provinces: listProvinceNames() },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  }

  if (scope === 'cities') {
    const province = searchParams.get('province')?.trim();

    if (!province) {
      return NextResponse.json({ error: 'Province is required.' }, { status: 400 });
    }

    return NextResponse.json(
      { cities: listCityNamesByProvince(province) },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  }

  return NextResponse.json(
    { error: 'Unsupported location scope.' },
    { status: 400 }
  );
}
