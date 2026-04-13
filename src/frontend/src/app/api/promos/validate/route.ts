import { NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/promo';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code : '';
    const subtotal = Number(body?.subtotal);

    const result = await validatePromoCode(code, subtotal);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          code: result.normalizedCode,
          reason: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      promo: {
        id: result.promo.id,
        code: result.promo.code,
        description: result.promo.description,
        discountType: result.promo.discount_type,
        discountValue: result.promo.discount_value,
        discountAmount: result.discountAmount,
        minSubtotal: result.promo.min_subtotal,
        maxDiscount: result.promo.max_discount,
      },
      message: result.message,
    });
  } catch (error) {
    console.error('Promo validation API error:', error);
    return NextResponse.json({ error: 'Unable to validate promo code.' }, { status: 500 });
  }
}
