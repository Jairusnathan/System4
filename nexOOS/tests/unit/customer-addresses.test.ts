import {
  ADDRESS_STORAGE_PREFIX,
  normalizeSavedAddresses,
  parseSerializedAddresses,
  stringifyAddresses,
} from '../../src/lib/customer-addresses';

describe('customer address helpers', () => {
  it('parses serialized addresses with legacy location fields', () => {
    const parsed = parseSerializedAddresses(
      `${ADDRESS_STORAGE_PREFIX}${JSON.stringify([
        {
          fullName: 'Alex',
          phoneNumber: '09123456789',
          location: 'Metro Manila, Quezon City',
          streetAddress: '123 Main',
          label: 'Work',
        },
      ])}`,
      { full_name: 'Fallback User', phone: '+639111111111' }
    );

    expect(parsed).toEqual([
      expect.objectContaining({
        fullName: 'Alex',
        phoneNumber: '09123456789',
        province: 'Metro Manila',
        city: 'Quezon City',
        streetAddress: '123 Main',
        label: 'Work',
      }),
    ]);
  });

  it('falls back to a single plain-text address when needed', () => {
    expect(
      parseSerializedAddresses('221B Baker Street', {
        full_name: 'Sherlock Holmes',
        phone: '+639123456789',
      })
    ).toEqual([
      expect.objectContaining({
        fullName: 'Sherlock Holmes',
        phoneNumber: '+639123456789',
        streetAddress: '221B Baker Street',
        label: 'Home',
      }),
    ]);
  });

  it('stringifies and normalizes saved addresses', () => {
    const addresses = [
      {
        fullName: '',
        phoneNumber: '09123456789',
        province: 'Metro Manila',
        city: 'Pasig',
        postalCode: '1600',
        streetAddress: 'Ortigas Ave',
        label: 'Home' as const,
      },
    ];

    expect(stringifyAddresses(addresses)).toContain(ADDRESS_STORAGE_PREFIX);
    expect(
      normalizeSavedAddresses(addresses, {
        full_name: 'Pat Doe',
        phone: '+639111111111',
      })
    ).toEqual([
      expect.objectContaining({
        fullName: 'Pat Doe',
        phoneNumber: '+639123456789',
      }),
    ]);
  });
});
