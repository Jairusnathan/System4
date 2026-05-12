import { Injectable } from '@nestjs/common';
import { normalizePhilippineLocationName } from '../utils/philippine-locations.util';
import { BranchesService } from './branches.service';
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

type DeliveryMethod = 'claim_at_branch' | 'same_day' | 'scheduled';

type DeliveryBranch = {
  id: number;
  name: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
};

type ScheduledDeliveryZone = {
  name: string;
  fee: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
};

type CityCenter = {
  city: string;
  province: string;
  latitude: number;
  longitude: number;
};

const SAME_DAY_BASE_FEE = 59;
const SAME_DAY_MAX_DISTANCE_KM = 30;
const SAME_DAY_DISTANCE_THRESHOLD_KM = 2;
const SAME_DAY_FEE_PER_KM = 10;
const SAME_DAY_MIN_ETA_MINUTES = 45;
const SAME_DAY_MAX_ETA_MINUTES = 90;

const METRO_MANILA_ALIASES = new Set(
  ['Metro Manila', 'National Capital Region'].map((value) =>
    normalizePhilippineLocationName(value),
  ),
);

const METRO_MANILA_CITY_CENTERS = new Map<string, CityCenter>([
  [
    normalizePhilippineLocationName('Caloocan City'),
    { city: 'Caloocan City', province: 'Metro Manila', latitude: 14.6507, longitude: 120.9676 },
  ],
  [
    normalizePhilippineLocationName('Las Pinas City'),
    { city: 'Las Pinas City', province: 'Metro Manila', latitude: 14.4445, longitude: 120.9939 },
  ],
  [
    normalizePhilippineLocationName('Makati City'),
    { city: 'Makati City', province: 'Metro Manila', latitude: 14.5547, longitude: 121.0244 },
  ],
  [
    normalizePhilippineLocationName('Malabon City'),
    { city: 'Malabon City', province: 'Metro Manila', latitude: 14.6577, longitude: 120.9560 },
  ],
  [
    normalizePhilippineLocationName('Mandaluyong City'),
    { city: 'Mandaluyong City', province: 'Metro Manila', latitude: 14.5794, longitude: 121.0359 },
  ],
  [
    normalizePhilippineLocationName('Manila'),
    { city: 'Manila', province: 'Metro Manila', latitude: 14.5995, longitude: 120.9842 },
  ],
  [
    normalizePhilippineLocationName('Marikina City'),
    { city: 'Marikina City', province: 'Metro Manila', latitude: 14.6507, longitude: 121.1029 },
  ],
  [
    normalizePhilippineLocationName('Muntinlupa City'),
    { city: 'Muntinlupa City', province: 'Metro Manila', latitude: 14.4081, longitude: 121.0415 },
  ],
  [
    normalizePhilippineLocationName('Navotas City'),
    { city: 'Navotas City', province: 'Metro Manila', latitude: 14.6667, longitude: 120.9417 },
  ],
  [
    normalizePhilippineLocationName('Paranaque City'),
    { city: 'Paranaque City', province: 'Metro Manila', latitude: 14.4793, longitude: 121.0198 },
  ],
  [
    normalizePhilippineLocationName('Pasay City'),
    { city: 'Pasay City', province: 'Metro Manila', latitude: 14.5378, longitude: 121.0014 },
  ],
  [
    normalizePhilippineLocationName('Pasig City'),
    { city: 'Pasig City', province: 'Metro Manila', latitude: 14.5764, longitude: 121.0851 },
  ],
  [
    normalizePhilippineLocationName('Pateros'),
    { city: 'Pateros', province: 'Metro Manila', latitude: 14.5446, longitude: 121.0689 },
  ],
  [
    normalizePhilippineLocationName('Quezon City'),
    { city: 'Quezon City', province: 'Metro Manila', latitude: 14.676, longitude: 121.0437 },
  ],
  [
    normalizePhilippineLocationName('San Juan City'),
    { city: 'San Juan City', province: 'Metro Manila', latitude: 14.6019, longitude: 121.0355 },
  ],
  [
    normalizePhilippineLocationName('Taguig City'),
    { city: 'Taguig City', province: 'Metro Manila', latitude: 14.5176, longitude: 121.0509 },
  ],
  [
    normalizePhilippineLocationName('Valenzuela City'),
    { city: 'Valenzuela City', province: 'Metro Manila', latitude: 14.7, longitude: 120.983 },
  ],
]);

const NEARBY_LUZON_PROVINCES = new Set(
  ['Bulacan', 'Cavite', 'Laguna', 'Rizal'].map((value) =>
    normalizePhilippineLocationName(value),
  ),
);

const VISAYAS_PROVINCES = new Set(
  [
    'Aklan',
    'Antique',
    'Biliran',
    'Bohol',
    'Capiz',
    'Cebu',
    'Eastern Samar',
    'Guimaras',
    'Iloilo',
    'Leyte',
    'Negros Occidental',
    'Negros Oriental',
    'Northern Samar',
    'Samar',
    'Siquijor',
    'Southern Leyte',
  ].map((value) => normalizePhilippineLocationName(value)),
);

const MINDANAO_PROVINCES = new Set(
  [
    'Agusan del Norte',
    'Agusan del Sur',
    'Basilan',
    'Bukidnon',
    'Camiguin',
    'Compostela Valley',
    'Davao de Oro',
    'Davao del Norte',
    'Davao del Sur',
    'Davao Occidental',
    'Davao Oriental',
    'Dinagat Islands',
    'Lanao del Norte',
    'Lanao del Sur',
    'Maguindanao',
    'Maguindanao del Norte',
    'Maguindanao del Sur',
    'Misamis Occidental',
    'Misamis Oriental',
    'North Cotabato',
    'Cotabato',
    'Sarangani',
    'South Cotabato',
    'Sultan Kudarat',
    'Sulu',
    'Surigao del Norte',
    'Surigao del Sur',
    'Tawi-Tawi',
    'Zamboanga del Norte',
    'Zamboanga del Sur',
    'Zamboanga Sibugay',
  ].map((value) => normalizePhilippineLocationName(value)),
);

@Injectable()
export class DeliveryService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly branchesService: BranchesService,
  ) {}

  async autocompleteAddress(_: {
    input?: string;
    city?: string;
    province?: string;
  }) {
    return [];
  }

  async getPlaceDetails(_: { placeId?: string }) {
    return null;
  }

  async verifyAddress(body: {
    city?: string;
    province?: string;
  }) {
    const city = body.city?.trim() ?? '';
    const province = body.province?.trim() ?? '';

    if (!city || !province) {
      return null;
    }

    const cityCenter = this.findMetroManilaCityCenter(city, province);
    if (!cityCenter) {
      return null;
    }

    return {
      formattedAddress: `${cityCenter.city}, ${cityCenter.province}, Philippines`,
      city: cityCenter.city,
      province: cityCenter.province,
      barangay: '',
      postalCode: '',
      latitude: cityCenter.latitude,
      longitude: cityCenter.longitude,
      isMetroManila: true,
    };
  }

  async estimateDelivery(body: {
    address?: string;
    city?: string;
    province?: string;
    barangay?: string;
    postalCode?: string;
    branchId?: number | string;
    deliveryMethod?: string;
  }) {
    const deliveryMethod = this.normalizeDeliveryMethod(body.deliveryMethod);
    const address = body.address?.trim() ?? '';
    const city = body.city?.trim() ?? '';
    const province = body.province?.trim() ?? '';
    const barangay = body.barangay?.trim() ?? '';
    const branchId = Number(body.branchId);

    if (deliveryMethod === 'claim_at_branch') {
      return {
        fee: 0,
        etaMinMinutes: 0,
        etaMaxMinutes: 0,
        etaLabel: 'Ready for branch pickup',
        matchedLocation: 'Pickup at selected branch',
        deliveryMethod,
        branchId: Number.isFinite(branchId) ? branchId : null,
      };
    }

    if (!address || !city || !province) {
      return null;
    }

    if (deliveryMethod === 'same_day') {
      if (!Number.isFinite(branchId) || branchId <= 0) {
        return {
          error: 'Please select a branch before requesting same day delivery.',
          status: 400,
        } as const;
      }

      const cityCenter = this.findMetroManilaCityCenter(city, province);
      if (!cityCenter) {
        return {
          error:
            'Same day delivery is only available for Metro Manila cities in our service map.',
          status: 400,
        } as const;
      }

      const branch = await this.findActiveBranch(branchId);
      if (!branch) {
        return {
          error: 'The selected branch is unavailable for delivery right now.',
          status: 404,
        } as const;
      }

      const branchLatitude = Number(branch.latitude);
      const branchLongitude = Number(branch.longitude);
      if (!Number.isFinite(branchLatitude) || !Number.isFinite(branchLongitude)) {
        return {
          error:
            'The selected branch is missing map coordinates. Update branch coordinates first.',
          status: 500,
        } as const;
      }

      const distanceKm = this.calculateDistanceKm(
        branchLatitude,
        branchLongitude,
        cityCenter.latitude,
        cityCenter.longitude,
      );

      if (distanceKm > SAME_DAY_MAX_DISTANCE_KM) {
        return {
          error:
            'This city is outside the same day delivery radius of the selected branch.',
          status: 400,
        } as const;
      }

      const distanceChargeableKm = Math.max(
        0,
        Math.ceil(distanceKm - SAME_DAY_DISTANCE_THRESHOLD_KM),
      );
      const fee = Number(
        (SAME_DAY_BASE_FEE + distanceChargeableKm * SAME_DAY_FEE_PER_KM).toFixed(
          2,
        ),
      );
      const etaMinMinutes = SAME_DAY_MIN_ETA_MINUTES + Math.round(distanceKm * 4);
      const etaMaxMinutes = SAME_DAY_MAX_ETA_MINUTES + Math.round(distanceKm * 6);

      return {
        fee,
        etaMinMinutes,
        etaMaxMinutes,
        etaLabel: `${etaMinMinutes}-${etaMaxMinutes} mins`,
        matchedLocation: `${cityCenter.city}, ${cityCenter.province}`,
        deliveryMethod,
        branchId: branch.id,
        branchName: branch.name,
        distanceKm: Number(distanceKm.toFixed(2)),
        isMetroManila: true,
        pricingBasis: 'city_center_distance',
      };
    }

    const exactOrProvinceRate =
      (await this.findExactRate(province, city, barangay)) ||
      (await this.findProvinceFallback(province));

    if (exactOrProvinceRate) {
      return {
        rateId: exactOrProvinceRate.id,
        fee: Number(Number(exactOrProvinceRate.fee ?? 0).toFixed(2)),
        etaMinMinutes: exactOrProvinceRate.eta_min_minutes,
        etaMaxMinutes: exactOrProvinceRate.eta_max_minutes,
        etaLabel: `${exactOrProvinceRate.eta_min_minutes}-${exactOrProvinceRate.eta_max_minutes} mins`,
        matchedLocation:
          [exactOrProvinceRate.city, exactOrProvinceRate.province].filter(Boolean).join(', ') ||
          exactOrProvinceRate.province,
        isDefaultRate: exactOrProvinceRate.is_default,
        deliveryMethod,
      };
    }

    const zone = this.getScheduledDeliveryZone(province);
    if (zone) {
      return {
        fee: zone.fee,
        etaMinMinutes: zone.etaMinMinutes,
        etaMaxMinutes: zone.etaMaxMinutes,
        etaLabel: this.formatEtaLabel(zone.etaMinMinutes, zone.etaMaxMinutes),
        matchedLocation: zone.name,
        deliveryMethod,
      };
    }

    const defaultRate = await this.findDefaultRate();
    if (!defaultRate) {
      return undefined;
    }

    return {
      rateId: defaultRate.id,
      fee: Number(Number(defaultRate.fee ?? 0).toFixed(2)),
      etaMinMinutes: defaultRate.eta_min_minutes,
      etaMaxMinutes: defaultRate.eta_max_minutes,
      etaLabel: `${defaultRate.eta_min_minutes}-${defaultRate.eta_max_minutes} mins`,
      matchedLocation:
        [defaultRate.city, defaultRate.province].filter(Boolean).join(', ') ||
        defaultRate.province,
      isDefaultRate: defaultRate.is_default,
      deliveryMethod,
    };
  }

  private normalizeDeliveryMethod(value?: string): DeliveryMethod {
    if (value === 'claim_at_branch' || value === 'same_day') {
      return value;
    }

    return 'scheduled';
  }

  private async findActiveBranch(branchId: number) {
    const branches = (await this.branchesService.getBranches()) as DeliveryBranch[];
    return branches.find((branch) => branch.id === branchId && branch.is_active);
  }

  private findMetroManilaCityCenter(city: string, province: string) {
    const normalizedCity = normalizePhilippineLocationName(city);
    const normalizedProvince = normalizePhilippineLocationName(province);

    if (
      !METRO_MANILA_ALIASES.has(normalizedProvince) &&
      normalizedProvince !== normalizePhilippineLocationName('NCR')
    ) {
      return null;
    }

    return METRO_MANILA_CITY_CENTERS.get(normalizedCity) ?? null;
  }

  private calculateDistanceKm(
    startLatitude: number,
    startLongitude: number,
    endLatitude: number,
    endLongitude: number,
  ) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(endLatitude - startLatitude);
    const deltaLng = toRadians(endLongitude - startLongitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(startLatitude)) *
        Math.cos(toRadians(endLatitude)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private getScheduledDeliveryZone(province: string): ScheduledDeliveryZone | null {
    const normalizedProvince = normalizePhilippineLocationName(province);

    if (METRO_MANILA_ALIASES.has(normalizedProvince)) {
      return {
        name: 'Metro Manila scheduled delivery',
        fee: 99,
        etaMinMinutes: 180,
        etaMaxMinutes: 360,
      };
    }

    if (NEARBY_LUZON_PROVINCES.has(normalizedProvince)) {
      return {
        name: `${province} scheduled delivery`,
        fee: 120,
        etaMinMinutes: 1_440,
        etaMaxMinutes: 2_880,
      };
    }

    if (VISAYAS_PROVINCES.has(normalizedProvince)) {
      return {
        name: 'Visayas scheduled delivery',
        fee: 180,
        etaMinMinutes: 4_320,
        etaMaxMinutes: 7_200,
      };
    }

    if (MINDANAO_PROVINCES.has(normalizedProvince)) {
      return {
        name: 'Mindanao scheduled delivery',
        fee: 220,
        etaMinMinutes: 5_760,
        etaMaxMinutes: 10_080,
      };
    }

    return {
      name: 'Luzon scheduled delivery',
      fee: 140,
      etaMinMinutes: 2_880,
      etaMaxMinutes: 5_760,
    };
  }

  private formatEtaLabel(minMinutes: number, maxMinutes: number) {
    if (minMinutes >= 1_440) {
      const minDays = Math.ceil(minMinutes / 1_440);
      const maxDays = Math.ceil(maxMinutes / 1_440);
      return `${minDays}-${maxDays} days`;
    }

    return `${minMinutes}-${maxMinutes} mins`;
  }

  private async findExactRate(
    province: string,
    city: string,
    barangay: string,
  ) {
    const { data, error } = await this.supabaseService.supabase
      .from('delivery_rates')
      .select(
        'id, province, city, barangay, fee, eta_min_minutes, eta_max_minutes, is_default',
      )
      .eq('is_active', true)
      .ilike('province', province);

    if (error) {
      if (this.isMissingTableError(error, 'delivery_rates')) {
        return undefined;
      }

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
      if (this.isMissingTableError(error, 'delivery_rates')) {
        return undefined;
      }

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
      if (this.isMissingTableError(error, 'delivery_rates')) {
        return undefined;
      }

      throw error;
    }

    return data?.[0] as DeliveryRate | undefined;
  }

  private isMissingTableError(error: unknown, tableName: string) {
    const details = this.describeError(error).toLowerCase();
    return (
      details.includes('pgrst205') &&
      details.includes(`public.${tableName}`.toLowerCase())
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.stack || error.message;
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    return String(error);
  }
}
