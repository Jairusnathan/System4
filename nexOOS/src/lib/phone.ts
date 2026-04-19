export const PH_PHONE_MESSAGE =
  'Use a valid Philippine mobile number like 09123456789 or +639123456789.';

export function normalizePhilippinePhone(value: string) {
  const sanitized = value.replace(/[^\d+]/g, '');

  if (/^09\d{9}$/.test(sanitized)) {
    return `+63${sanitized.slice(1)}`;
  }

  if (/^639\d{9}$/.test(sanitized)) {
    return `+${sanitized}`;
  }

  if (/^\+639\d{9}$/.test(sanitized)) {
    return sanitized;
  }

  return null;
}

export function isValidPhilippinePhone(value: string) {
  return normalizePhilippinePhone(value) !== null;
}
