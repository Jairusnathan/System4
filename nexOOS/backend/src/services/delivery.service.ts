import { Injectable } from '@nestjs/common';
import { normalizePhilippineLocationName } from '../utils/philippine-locations.util';
import { SupabaseService } from './supabase.service';

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

@Injectable()
export class DeliveryService {
  private readonly supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  async estimateDelivery(body: {
    address?: string;
    city?: string;
    province?: string;
    barangay?: string;
  }) {
    const address = body.address?.trim() ?? '';
    const city = body.city?.trim() ?? '';
    const province = body.province?.trim() ?? '';
    const barangay = body.barangay?.trim() ?? '';

    if (!address || !city || !province) {
      return null;
    }

    const rate =
      (await this.findExactRate(province, city, barangay)) ||
      (await this.findProvinceFallback(province)) ||
      (await this.findDefaultRate());

    if (!rate) {
      return undefined;
    }

    return {
      rateId: rate.id,
      fee: Number(Number(rate.fee ?? 0).toFixed(2)),
      etaMinMinutes: rate.eta_min_minutes,
      etaMaxMinutes: rate.eta_max_minutes,
      etaLabel: `${rate.eta_min_minutes}-${rate.eta_max_minutes} mins`,
      matchedLocation:
        [rate.city, rate.province].filter(Boolean).join(', ') || rate.province,
      isDefaultRate: rate.is_default,
    };
  }

  private async findExactRate(province: string, city: string, barangay: string) {
    const { data, error } = await this.supabaseService.supabase
      .from('delivery_rates')
      .select(
        'id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default',
      )
      .eq('is_active', true)
      .ilike('province', province);

    if (error) {
      throw error;
    }

    const normalizedCity = normalizePhilippineLocationName(city);
    const normalizedBarangay = normalizePhilippineLocationName(barangay);
    const provinceRates = (data ?? []) as DeliveryRate[];

    if (normalizedBarangay) {
      const barangayMatch = provinceRates.find(
        (rate) =>
          normalizePhilippineLocationName(rate.city ?? '') === normalizedCity &&
          normalizePhilippineLocationName(rate.barangay ?? '') ===
            normalizedBarangay,
      );

      if (barangayMatch) {
        return barangayMatch;
      }
    }

    return provinceRates.find(
      (rate) =>
        normalizePhilippineLocationName(rate.city ?? '') === normalizedCity &&
        !rate.barangay,
    );
  }

  private async findProvinceFallback(province: string) {
    const { data, error } = await this.supabaseService.supabase
      .from('delivery_rates')
      .select(
        'id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default',
      )
      .eq('is_active', true)
      .ilike('province', province)
      .is('city', null)
      .is('barangay', null)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0] as DeliveryRate | undefined;
  }

  private async findDefaultRate() {
    const { data, error } = await this.supabaseService.supabase
      .from('delivery_rates')
      .select(
        'id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default',
      )
      .eq('is_active', true)
      .eq('is_default', true)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0] as DeliveryRate | undefined;
  }
}
