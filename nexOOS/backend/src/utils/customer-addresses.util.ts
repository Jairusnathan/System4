import { SavedAddress } from '../types';
import { normalizePhilippinePhone } from './phone.util';

export const ADDRESS_STORAGE_PREFIX = '__addresses_json__:';
export const MAX_SAVED_ADDRESSES = 4;

export function parseSerializedAddresses(
  address?: string,
  user?: { full_name?: string; phone?: string } | null,
): SavedAddress[] {
  if (!address) {
    return [];
  }

  if (address.startsWith(ADDRESS_STORAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(address.slice(ADDRESS_STORAGE_PREFIX.length));
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => {
          const legacyLocation =
            typeof entry?.location === 'string' ? entry.location : '';
          const [legacyProvince = '', legacyCity = ''] = legacyLocation
            .split(',')
            .map((item: string) => item.trim());

          return {
            fullName: entry?.fullName || user?.full_name || '',
            phoneNumber: entry?.phoneNumber || user?.phone || '',
            province: entry?.province || entry?.region || legacyProvince,
            city: entry?.city || legacyCity,
            postalCode: entry?.postalCode || '',
            streetAddress: entry?.streetAddress || '',
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
      fullName: user?.full_name || '',
      phoneNumber: user?.phone || '',
      province: '',
      city: '',
      postalCode: '',
      streetAddress: address,
      label: 'Home',
    },
  ];
}

export function stringifyAddresses(addresses: SavedAddress[]) {
  return `${ADDRESS_STORAGE_PREFIX}${JSON.stringify(addresses)}`;
}

export function normalizeSavedAddresses(
  addresses: SavedAddress[],
  fallback?: { full_name?: string; phone?: string | null } | null,
): SavedAddress[] {
  return addresses.map((entry) => {
    const normalizedPhone = normalizePhilippinePhone(
      entry.phoneNumber || fallback?.phone || '',
    );
    const label: SavedAddress['label'] =
      entry.label === 'Work' ? 'Work' : 'Home';

    return {
      ...entry,
      fullName: entry.fullName || fallback?.full_name || '',
      phoneNumber: normalizedPhone || '',
      label,
    };
  });
}
