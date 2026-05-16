import { Injectable } from '@nestjs/common';
import { requestDownstream } from '../shared/http/request-downstream';
import { SERVICE_URLS } from '../shared/http/service-urls';
import { normalizePhilippineLocationName } from '../utils/philippine-locations.util';
import { SupabaseService } from './supabase.service';

type DeliveryRate = { id: number; province: string; city: string | null; barangay: string | null; fee: number | string; eta_min_minutes: number; eta_max_minutes: number; is_default: boolean; };
type DeliveryMethod = 'claim_at_branch' | 'same_day' | 'scheduled';
type DeliveryBranch = { id: number; name: string; is_active: boolean; latitude?: number; longitude?: number; };

const SAME_DAY_BASE_FEE = 59;
const SAME_DAY_MAX_DISTANCE_KM = 30;
const SAME_DAY_DISTANCE_THRESHOLD_KM = 2;
const SAME_DAY_FEE_PER_KM = 10;
const SAME_DAY_MIN_ETA_MINUTES = 45;
const SAME_DAY_MAX_ETA_MINUTES = 90;

const METRO_MANILA_ALIASES = new Set(['Metro Manila', 'National Capital Region'].map((v) => normalizePhilippineLocationName(v)));
const METRO_MANILA_CITY_CENTERS = new Map([
  [normalizePhilippineLocationName('Manila'), { city: 'Manila', province: 'Metro Manila', latitude: 14.5995, longitude: 120.9842 }],
  [normalizePhilippineLocationName('Quezon City'), { city: 'Quezon City', province: 'Metro Manila', latitude: 14.676, longitude: 121.0437 }],
  [normalizePhilippineLocationName('Makati City'), { city: 'Makati City', province: 'Metro Manila', latitude: 14.5547, longitude: 121.0244 }],
  [normalizePhilippineLocationName('Taguig City'), { city: 'Taguig City', province: 'Metro Manila', latitude: 14.5176, longitude: 121.0509 }],
  [normalizePhilippineLocationName('Pasig City'), { city: 'Pasig City', province: 'Metro Manila', latitude: 14.5764, longitude: 121.0851 }],
  [normalizePhilippineLocationName('Mandaluyong City'), { city: 'Mandaluyong City', province: 'Metro Manila', latitude: 14.5794, longitude: 121.0359 }],
  [normalizePhilippineLocationName('Marikina City'), { city: 'Marikina City', province: 'Metro Manila', latitude: 14.6507, longitude: 121.1029 }],
  [normalizePhilippineLocationName('Caloocan City'), { city: 'Caloocan City', province: 'Metro Manila', latitude: 14.6507, longitude: 120.9676 }],
  [normalizePhilippineLocationName('Las Pinas City'), { city: 'Las Pinas City', province: 'Metro Manila', latitude: 14.4445, longitude: 120.9939 }],
  [normalizePhilippineLocationName('Paranaque City'), { city: 'Paranaque City', province: 'Metro Manila', latitude: 14.4793, longitude: 121.0198 }],
]);
const NEARBY_LUZON = new Set(['Bulacan', 'Cavite', 'Laguna', 'Rizal'].map((v) => normalizePhilippineLocationName(v)));

@Injectable()
export class DeliveryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async autocompleteAddress(_: { input?: string; city?: string; province?: string }) { return []; }
  async getPlaceDetails(_: { placeId?: string }) { return null; }

  async verifyAddress(body: { city?: string; province?: string }) {
    const city = body.city?.trim() ?? '';
    const province = body.province?.trim() ?? '';
    if (!city || !province) return null;
    const cityCenter = this.findMetroManilaCityCenter(city, province);
    if (!cityCenter) return null;
    return { formattedAddress: `${cityCenter.city}, ${cityCenter.province}, Philippines`, city: cityCenter.city, province: cityCenter.province, barangay: '', postalCode: '', latitude: cityCenter.latitude, longitude: cityCenter.longitude, isMetroManila: true };
  }

  async estimateDelivery(body: { address?: string; city?: string; province?: string; barangay?: string; branchId?: number | string; deliveryMethod?: string }) {
    const deliveryMethod = this.normalizeDeliveryMethod(body.deliveryMethod);
    const address = body.address?.trim() ?? '';
    const city = body.city?.trim() ?? '';
    const province = body.province?.trim() ?? '';
    const barangay = body.barangay?.trim() ?? '';
    const branchId = Number(body.branchId);

    if (deliveryMethod === 'claim_at_branch') return { fee: 0, etaMinMinutes: 0, etaMaxMinutes: 0, etaLabel: 'Ready for branch pickup', matchedLocation: 'Pickup at selected branch', deliveryMethod, branchId: Number.isFinite(branchId) ? branchId : null };
    if (!address || !city || !province) return null;

    if (deliveryMethod === 'same_day') {
      if (!Number.isFinite(branchId) || branchId <= 0) return { error: 'Please select a branch before requesting same day delivery.', status: 400 } as const;
      const cityCenter = this.findMetroManilaCityCenter(city, province);
      if (!cityCenter) return { error: 'Same day delivery is only available for Metro Manila cities.', status: 400 } as const;
      const branch = await this.findActiveBranch(branchId);
      if (!branch) return { error: 'The selected branch is unavailable for delivery right now.', status: 404 } as const;
      const branchLatitude = Number(branch.latitude);
      const branchLongitude = Number(branch.longitude);
      if (!Number.isFinite(branchLatitude) || !Number.isFinite(branchLongitude)) return { error: 'The selected branch is missing map coordinates.', status: 500 } as const;
      const distanceKm = this.calculateDistanceKm(branchLatitude, branchLongitude, cityCenter.latitude, cityCenter.longitude);
      if (distanceKm > SAME_DAY_MAX_DISTANCE_KM) return { error: 'This city is outside the same day delivery radius.', status: 400 } as const;
      const distanceChargeableKm = Math.max(0, Math.ceil(distanceKm - SAME_DAY_DISTANCE_THRESHOLD_KM));
      const fee = Number((SAME_DAY_BASE_FEE + distanceChargeableKm * SAME_DAY_FEE_PER_KM).toFixed(2));
      return { fee, etaMinMinutes: SAME_DAY_MIN_ETA_MINUTES + Math.round(distanceKm * 4), etaMaxMinutes: SAME_DAY_MAX_ETA_MINUTES + Math.round(distanceKm * 6), etaLabel: `${SAME_DAY_MIN_ETA_MINUTES + Math.round(distanceKm * 4)}-${SAME_DAY_MAX_ETA_MINUTES + Math.round(distanceKm * 6)} mins`, matchedLocation: `${cityCenter.city}, ${cityCenter.province}`, deliveryMethod, branchId: branch.id, isMetroManila: true };
    }

    const rate = (await this.findExactRate(province, city, barangay)) || (await this.findProvinceFallback(province));
    if (rate) return { rateId: rate.id, fee: Number(Number(rate.fee ?? 0).toFixed(2)), etaMinMinutes: rate.eta_min_minutes, etaMaxMinutes: rate.eta_max_minutes, etaLabel: `${rate.eta_min_minutes}-${rate.eta_max_minutes} mins`, matchedLocation: [rate.city, rate.province].filter(Boolean).join(', ') || rate.province, deliveryMethod };

    const zone = this.getScheduledDeliveryZone(province);
    if (zone) return { fee: zone.fee, etaMinMinutes: zone.etaMinMinutes, etaMaxMinutes: zone.etaMaxMinutes, etaLabel: this.formatEtaLabel(zone.etaMinMinutes, zone.etaMaxMinutes), matchedLocation: zone.name, deliveryMethod };

    const defaultRate = await this.findDefaultRate();
    if (!defaultRate) return undefined;
    return { rateId: defaultRate.id, fee: Number(Number(defaultRate.fee ?? 0).toFixed(2)), etaMinMinutes: defaultRate.eta_min_minutes, etaMaxMinutes: defaultRate.eta_max_minutes, etaLabel: `${defaultRate.eta_min_minutes}-${defaultRate.eta_max_minutes} mins`, matchedLocation: [defaultRate.city, defaultRate.province].filter(Boolean).join(', ') || defaultRate.province, deliveryMethod };
  }

  private normalizeDeliveryMethod(value?: string): DeliveryMethod {
    if (value === 'claim_at_branch' || value === 'same_day') return value;
    return 'scheduled';
  }

  private async findActiveBranch(branchId: number) {
    const result = await requestDownstream<DeliveryBranch[]>({ baseUrl: SERVICE_URLS.catalog, path: '/branches' });
    const branches = Array.isArray(result.data) ? result.data : [];
    return branches.find((branch) => branch.id === branchId && branch.is_active);
  }

  private findMetroManilaCityCenter(city: string, province: string) {
    const normalizedProvince = normalizePhilippineLocationName(province);
    if (!METRO_MANILA_ALIASES.has(normalizedProvince) && normalizedProvince !== normalizePhilippineLocationName('NCR')) return null;
    return METRO_MANILA_CITY_CENTERS.get(normalizePhilippineLocationName(city)) ?? null;
  }

  private calculateDistanceKm(startLat: number, startLng: number, endLat: number, endLng: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(endLat - startLat);
    const dLng = toRad(endLng - startLng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private getScheduledDeliveryZone(province: string) {
    const normalized = normalizePhilippineLocationName(province);
    if (METRO_MANILA_ALIASES.has(normalized)) return { name: 'Metro Manila scheduled delivery', fee: 99, etaMinMinutes: 180, etaMaxMinutes: 360 };
    if (NEARBY_LUZON.has(normalized)) return { name: `${province} scheduled delivery`, fee: 120, etaMinMinutes: 1_440, etaMaxMinutes: 2_880 };
    return { name: 'Luzon scheduled delivery', fee: 140, etaMinMinutes: 2_880, etaMaxMinutes: 5_760 };
  }

  private formatEtaLabel(minMinutes: number, maxMinutes: number) {
    if (minMinutes >= 1_440) { const minDays = Math.ceil(minMinutes / 1_440); const maxDays = Math.ceil(maxMinutes / 1_440); return `${minDays}-${maxDays} days`; }
    return `${minMinutes}-${maxMinutes} mins`;
  }

  private async findExactRate(province: string, city: string, barangay: string) {
    const { data, error } = await this.supabaseService.supabase.from('delivery_rates').select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default').eq('is_active', true).ilike('province', province);
    if (error) return undefined;
    const normalizedCity = normalizePhilippineLocationName(city);
    const provinceRates = (data ?? []) as DeliveryRate[];
    return provinceRates.find((rate) => normalizePhilippineLocationName(rate.city ?? '') === normalizedCity && !rate.barangay);
  }

  private async findProvinceFallback(province: string) {
    const { data, error } = await this.supabaseService.supabase.from('delivery_rates').select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default').eq('is_active', true).ilike('province', province).is('city', null).is('barangay', null).limit(1);
    if (error) return undefined;
    return data?.[0] as DeliveryRate | undefined;
  }

  private async findDefaultRate() {
    const { data, error } = await this.supabaseService.supabase.from('delivery_rates').select('id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default').eq('is_active', true).eq('is_default', true).limit(1);
    if (error) return undefined;
    return data?.[0] as DeliveryRate | undefined;
  }
}
