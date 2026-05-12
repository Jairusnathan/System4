import { normalizePhilippinePhone } from '@/lib/phone';

export const ADDRESS_STORAGE_PREFIX = '__addresses_json__:';
export const MAX_SAVED_ADDRESSES = 4;

export type SavedAddress = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  barangay?: string;
  postalCode: string;
  streetAddress: string;
  formattedAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  isVerified?: boolean;
  label: 'Home' | 'Work';
};

export function createEmptySavedAddress(
  user?: { full_name?: string; phone?: string } | null
): SavedAddress {
  return {
    fullName: user?.full_name || '',
    phoneNumber: user?.phone || '',
    province: '',
    city: '',
    barangay: '',
    postalCode: '',
    streetAddress: '',
    formattedAddress: '',
    placeId: '',
    latitude: undefined,
    longitude: undefined,
    isVerified: false,
    label: 'Home',
  };
}

export function parseSerializedAddresses(
  address?: string,
  user?: { full_name?: string; phone?: string } | null
): SavedAddress[] {
  if (!address) {
    return [];
  }

  if (address.startsWith(ADDRESS_STORAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(address.slice(ADDRESS_STORAGE_PREFIX.length));
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => {
          const legacyLocation = typeof entry?.location === 'string' ? entry.location : '';
          const [legacyProvince = '', legacyCity = ''] = legacyLocation.split(',').map((item: string) => item.trim());

          return {
            fullName: entry?.fullName || user?.full_name || '',
            phoneNumber: entry?.phoneNumber || user?.phone || '',
            province: entry?.province || entry?.region || legacyProvince,
            city: entry?.city || legacyCity,
            barangay: entry?.barangay || '',
            postalCode: entry?.postalCode || '',
            streetAddress: entry?.streetAddress || '',
            formattedAddress: entry?.formattedAddress || '',
            placeId: entry?.placeId || '',
            latitude:
              typeof entry?.latitude === 'number' ? entry.latitude : undefined,
            longitude:
              typeof entry?.longitude === 'number'
                ? entry.longitude
                : undefined,
            isVerified: entry?.isVerified === true,
            label: entry?.label === 'Work' ? 'Work' : 'Home',
          };
        });
      }
    } catch (error) {
      console.error('Failed to parse saved addresses:', error);
    }
  }

  return [
    {
      ...createEmptySavedAddress(user),
      streetAddress: address,
    },
  ];
}

export function stringifyAddresses(addresses: SavedAddress[]) {
  return `${ADDRESS_STORAGE_PREFIX}${JSON.stringify(addresses)}`;
}

export function formatSavedAddress(address: SavedAddress) {
  if (address.formattedAddress) {
    return address.formattedAddress;
  }

  return [
    address.streetAddress,
    address.barangay,
    address.city,
    address.province,
  ]
    .filter(Boolean)
    .join(', ');
}

export function getSavedAddressKey(address: SavedAddress) {
  return [
    address.label,
    address.fullName,
    address.phoneNumber,
    address.province,
    address.city,
    address.barangay || '',
    address.postalCode,
    address.streetAddress,
    address.formattedAddress || '',
    address.placeId || '',
    String(address.latitude ?? ''),
    String(address.longitude ?? ''),
    String(address.isVerified ?? false),
  ].join('|');
}

export function normalizeSavedAddresses(
  addresses: SavedAddress[],
  fallback?: { full_name?: string; phone?: string | null } | null
): SavedAddress[] {
  return addresses.map((entry) => {
    const normalizedPhone = normalizePhilippinePhone(entry.phoneNumber || fallback?.phone || '');
    const label: SavedAddress['label'] = entry.label === 'Work' ? 'Work' : 'Home';

    return {
      ...entry,
      fullName: entry.fullName || fallback?.full_name || '',
      phoneNumber: normalizedPhone || '',
      label,
    };
  });
}
