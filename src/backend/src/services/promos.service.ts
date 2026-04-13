import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

type PromoCodeRecord = {
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

@Injectable()
export class PromosService {
  private readonly supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  normalizePromoCode(value: string) {
    return value.trim().toUpperCase();
  }

  async validatePromoCode(rawCode: string, subtotal: number) {
    const normalizedCode = this.normalizePromoCode(rawCode);
    const normalizedSubtotal = Math.max(
      0,
      Number((Number.isFinite(subtotal) ? subtotal : 0).toFixed(2)),
    );

    if (!normalizedCode) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'Enter a promo code.',
      };
    }

    const { data, error } = await this.supabaseService.secondSupabaseAdmin
      .from('promo_codes')
      .select(
        'id, code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, times_used, is_active',
      )
      .eq('code', normalizedCode)
      .maybeSingle<PromoCodeRecord>();

    if (error) {
      throw new Error('Failed to validate promo code.');
    }

    if (!data) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'Promo code not found.',
      };
    }

    if (!data.is_active) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'This promo code is inactive.',
      };
    }

    const now = new Date();
    if (data.starts_at && new Date(data.starts_at) > now) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'This promo code is not active yet.',
      };
    }

    if (data.ends_at && new Date(data.ends_at) < now) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'This promo code has expired.',
      };
    }

    if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'This promo code has reached its usage limit.',
      };
    }

    if (normalizedSubtotal < data.min_subtotal) {
      return {
        valid: false as const,
        normalizedCode,
        message: `Minimum subtotal for this promo is P${data.min_subtotal.toFixed(2)}.`,
      };
    }

    const discountAmount = this.getPromoDiscountAmount(data, normalizedSubtotal);
    if (discountAmount <= 0) {
      return {
        valid: false as const,
        normalizedCode,
        message: 'This promo code does not apply to the current cart.',
      };
    }

    const message =
      data.discount_type === 'percent'
        ? `${data.code} applied: ${data.discount_value}% off.`
        : `${data.code} applied: P${data.discount_value.toFixed(2)} off.`;

    return {
      valid: true as const,
      promo: data,
      normalizedCode,
      discountAmount,
      message,
    };
  }

  private getPromoDiscountAmount(promo: PromoCodeRecord, subtotal: number) {
    if (promo.discount_type === 'percent') {
      const rawDiscount = subtotal * (promo.discount_value / 100);
      const cappedDiscount =
        promo.max_discount !== null
          ? Math.min(rawDiscount, promo.max_discount)
          : rawDiscount;
      return Number(Math.min(cappedDiscount, subtotal).toFixed(2));
    }

    return Number(Math.min(promo.discount_value, subtotal).toFixed(2));
  }
}
