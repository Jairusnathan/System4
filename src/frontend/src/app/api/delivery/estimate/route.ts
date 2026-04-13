import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizePhilippineLocationName } from '@/lib/philippine-locations';

type DeliveryEstimateRequest = {
  address?: string;
  city?: string;
  province?: string;
  barangay?: string;
};

type DeliveryRate = {
  id: number;
  province: string;
  city: string | null;
  barangay: string | null;
  fee: number | string;
  eta_min_minutes: number;
  eta_max_minutes: number;
  is_default: boolean;
};

const normalizeText = (value?: string) => value?.trim() ?? '';
const toMoney = (value: number) => Number(value.toFixed(2));

const buildEstimatePayload = (rate: DeliveryRate) => ({
  rateId: rate.id,
  fee: toMoney(Number(rate.fee ?? 0)),
  etaMinMinutes: rate.eta_min_minutes,
  etaMaxMinutes: rate.eta_max_minutes,
  etaLabel: `${rate.eta_min_minutes}-${rate.eta_max_minutes} mins`,
  matchedLocation: [rate.city, rate.province].filter(Boolean).join(', ') || rate.province,
  isDefaultRate: rate.is_default,
});

async function findExactRate(province: string, city: string, barangay: string) {
  const { data, error } = await supabase
    .from('delivery_rates')
    .select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default')
    .eq('is_active', true)
    .ilike('province', province);

  if (error) throw error;

  const normalizedCity = normalizePhilippineLocationName(city);
  const normalizedBarangay = normalizePhilippineLocationName(barangay);
  const provinceRates = (data ?? []) as DeliveryRate[];

  if (normalizedBarangay) {
    const barangayMatch = provinceRates.find((rate) =>
      normalizePhilippineLocationName(rate.city ?? '') === normalizedCity &&
      normalizePhilippineLocationName(rate.barangay ?? '') === normalizedBarangay
    );

    if (barangayMatch) {
      return barangayMatch;
    }
  }

  return provinceRates.find((rate) =>
    normalizePhilippineLocationName(rate.city ?? '') === normalizedCity &&
    !rate.barangay
  );
}

async function findProvinceFallback(province: string) {
  const { data, error } = await supabase
    .from('delivery_rates')
    .select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default')
    .eq('is_active', true)
    .ilike('province', province)
    .is('city', null)
    .is('barangay', null)
    .limit(1);

  if (error) throw error;

  return data?.[0] as DeliveryRate | undefined;
}

async function findDefaultRate() {
  const { data, error } = await supabase
    .from('delivery_rates')
    .select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default')
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1);

  if (error) throw error;

  return data?.[0] as DeliveryRate | undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeliveryEstimateRequest;
    const address = normalizeText(body?.address);
    const city = normalizeText(body?.city);
    const province = normalizeText(body?.province);
    const barangay = normalizeText(body?.barangay);

    if (!address || !city || !province) {
      return NextResponse.json(
        { error: 'Address, city, and province are required to estimate delivery.' },
        { status: 400 }
      );
    }

    const rate =
      (await findExactRate(province, city, barangay)) ||
      (await findProvinceFallback(province)) ||
      (await findDefaultRate());

    if (!rate) {
      return NextResponse.json(
        { error: 'No delivery rate is available for this address yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ estimate: buildEstimatePayload(rate) });
  } catch (error) {
    console.error('Delivery estimate API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
