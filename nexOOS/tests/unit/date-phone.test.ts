import {
  normalizeDateForInput,
  normalizeDateForStorage,
} from '../../src/lib/date';
import {
  isValidPhilippinePhone,
  normalizePhilippinePhone,
  PH_PHONE_MESSAGE,
} from '../../src/lib/phone';

describe('date helpers', () => {
  it('normalizes ISO, slash, and invalid values for inputs', () => {
    expect(normalizeDateForInput('2026-04-18')).toBe('2026-04-18');
    expect(normalizeDateForInput('4/8/2026')).toBe('2026-04-08');
    expect(normalizeDateForInput('April 18, 2026')).toBe('2026-04-18');
    expect(normalizeDateForInput('not-a-date')).toBe('');
    expect(normalizeDateForInput(null)).toBe('');
  });

  it('normalizes values for storage', () => {
    expect(normalizeDateForStorage('4/18/2026')).toBe('2026-04-18');
    expect(normalizeDateForStorage('')).toBeNull();
  });
});

describe('phone helpers', () => {
  it('normalizes common Philippine mobile formats', () => {
    expect(normalizePhilippinePhone('09123456789')).toBe('+639123456789');
    expect(normalizePhilippinePhone('639123456789')).toBe('+639123456789');
    expect(normalizePhilippinePhone('+639123456789')).toBe('+639123456789');
  });

  it('rejects invalid values and exposes the validation message', () => {
    expect(normalizePhilippinePhone('12345')).toBeNull();
    expect(isValidPhilippinePhone('09123456789')).toBe(true);
    expect(isValidPhilippinePhone('12345')).toBe(false);
    expect(PH_PHONE_MESSAGE).toContain('Philippine mobile number');
  });
});
