import { secondSupabaseAdmin } from './second-supabase';

export type PromoCodeRecord = {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_subtotal: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
};

export type PromoValidationResult =
  | {
      valid: true;
      promo: PromoCodeRecord;
      normalizedCode: string;
      discountAmount: number;
      message: string;
    }
  | {
      valid: false;
      normalizedCode: string;
      message: string;
    };

const toMoney = (value: number) => Number(value.toFixed(2));

export const normalizePromoCode = (value: string) => value.trim().toUpperCase();

const getPromoDiscountAmount = (promo: PromoCodeRecord, subtotal: number) => {
  if (promo.discount_type === 'percent') {
    const rawDiscount = subtotal * (promo.discount_value / 100);
    const cappedDiscount = promo.max_discount !== null ? Math.min(rawDiscount, promo.max_discount) : rawDiscount;
    return toMoney(Math.min(cappedDiscount, subtotal));
  }

  return toMoney(Math.min(promo.discount_value, subtotal));
};

const getPromoSuccessMessage = (promo: PromoCodeRecord) => {
  if (promo.discount_type === 'percent') {
    return `${promo.code} applied: ${promo.discount_value}% off.`;
  }

  return `${promo.code} applied: P${promo.discount_value.toFixed(2)} off.`;
};

export async function validatePromoCode(rawCode: string, subtotal: number): Promise<PromoValidationResult> {
  const normalizedCode = normalizePromoCode(rawCode);
  const normalizedSubtotal = Math.max(0, toMoney(Number.isFinite(subtotal) ? subtotal : 0));

  if (!normalizedCode) {
    return {
      valid: false,
      normalizedCode,
      message: 'Enter a promo code.',
    };
  }

  const { data, error } = await secondSupabaseAdmin
    .from('promo_codes')
    .select(
      'id, code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, times_used, is_active'
    )
    .eq('code', normalizedCode)
    .maybeSingle<PromoCodeRecord>();

  if (error) {
    throw new Error('Failed to validate promo code.');
  }

  if (!data) {
    return {
      valid: false,
      normalizedCode,
      message: 'Promo code not found.',
    };
  }

  if (!data.is_active) {
    return {
      valid: false,
      normalizedCode,
      message: 'This promo code is inactive.',
    };
  }

  const now = new Date();
  if (data.starts_at && new Date(data.starts_at) > now) {
    return {
      valid: false,
      normalizedCode,
      message: 'This promo code is not active yet.',
    };
  }

  if (data.ends_at && new Date(data.ends_at) < now) {
    return {
      valid: false,
      normalizedCode,
      message: 'This promo code has expired.',
    };
  }

  if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
    return {
      valid: false,
      normalizedCode,
      message: 'This promo code has reached its usage limit.',
    };
  }

  if (normalizedSubtotal < data.min_subtotal) {
    return {
      valid: false,
      normalizedCode,
      message: `Minimum subtotal for this promo is P${data.min_subtotal.toFixed(2)}.`,
    };
  }

  const discountAmount = getPromoDiscountAmount(data, normalizedSubtotal);

  if (discountAmount <= 0) {
    return {
      valid: false,
      normalizedCode,
      message: 'This promo code does not apply to the current cart.',
    };
  }

  return {
    valid: true,
    promo: data,
    normalizedCode,
    discountAmount,
    message: getPromoSuccessMessage(data),
  };
}
