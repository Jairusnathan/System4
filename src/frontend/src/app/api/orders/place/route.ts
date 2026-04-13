import { NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../lib/auth';
import { validatePromoCode } from '@/lib/promo';
import { secondSupabaseAdmin } from '@/lib/second-supabase';

type CheckoutItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
};

const DEFAULT_SHIPPING_FEE = 50;
const ECOMMERCE_CASHIER_NAME = 'Ecommerce';

const toMoney = (value: number) => Number(value.toFixed(2));

const normalizePaymentMethodForPos = (paymentMethod: string) => {
  const normalized = paymentMethod.trim().toLowerCase();

  if (normalized === 'cash on delivery') {
    return 'cash';
  }

  if (normalized === 'credit / debit card' || normalized === 'credit/debit card' || normalized === 'card') {
    return 'card';
  }

  if (normalized === 'gcash' || normalized === 'maya' || normalized === 'mobile payment') {
    return 'mobile';
  }

  return normalized || 'cash';
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? (body.items as CheckoutItem[]) : [];
    const shippingAddress = typeof body?.shippingAddress === 'string' ? body.shippingAddress.trim() : '';
    const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod.trim() : 'Cash on Delivery';
    const requestedDeliveryFee = Number(body?.deliveryFee);
    const deliveryFee = Number.isFinite(requestedDeliveryFee)
      ? Math.max(0, requestedDeliveryFee)
      : DEFAULT_SHIPPING_FEE;
    const promoCode = typeof body?.promoCode === 'string' ? body.promoCode.trim() : '';

    if (!shippingAddress) {
      return NextResponse.json({ error: 'Shipping address is required' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const normalizedItems = items
      .map((item) => ({
        id: String(item.id),
        name: String(item.name || '').trim(),
        category: String(item.category || '').trim() || 'Uncategorized',
        price: Number(item.price),
        quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1))),
      }))
      .filter((item) => item.id && item.name && Number.isFinite(item.price) && item.price >= 0);

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'No valid cart items found' }, { status: 400 });
    }

    const productIds = normalizedItems.map((item) => Number(item.id)).filter((value) => Number.isFinite(value));

    const { data: products, error: productsError } = await secondSupabaseAdmin
      .from('products')
      .select('id, name, category, price, stock')
      .in('id', productIds);

    if (productsError) {
      console.error('Load products for order failed:', productsError);
      return NextResponse.json({ error: 'Failed to validate products' }, { status: 500 });
    }

    const productsById = new Map((products ?? []).map((product) => [String(product.id), product]));

    for (const item of normalizedItems) {
      const product = productsById.get(item.id);

      if (!product) {
        return NextResponse.json({ error: `Product ${item.name} was not found` }, { status: 400 });
      }

      const availableStock = Number(product.stock ?? 0);
      if (availableStock < item.quantity) {
        return NextResponse.json(
          { error: `${product.name} only has ${availableStock} item(s) left in stock.` },
          { status: 409 }
        );
      }
    }

    const { data: receiptRows, error: receiptError } = await secondSupabaseAdmin
      .rpc('create_receipt', {});

    if (receiptError) {
      console.error('Create receipt failed:', receiptError);
      return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 });
    }

    const receipt = Array.isArray(receiptRows) ? receiptRows[0] : receiptRows;
    const receiptId = Number(receipt?.receipt_id);
    const receiptNumber = String(receipt?.receipt_number ?? '');

    if (!receiptId || !receiptNumber) {
      return NextResponse.json({ error: 'Invalid receipt response from database' }, { status: 500 });
    }

    const subtotal = toMoney(
      normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
    const vat = toMoney(subtotal * 0.12);
    const normalizedPaymentMethod = normalizePaymentMethodForPos(paymentMethod);
    const promoResult = promoCode ? await validatePromoCode(promoCode, subtotal) : null;

    if (promoCode && (!promoResult || !promoResult.valid)) {
      return NextResponse.json(
        { error: promoResult?.message || 'Invalid promo code.' },
        { status: 400 }
      );
    }

    const discountAmount = promoResult?.valid ? promoResult.discountAmount : 0;
    const totalAmount = toMoney(Math.max(0, subtotal + deliveryFee - discountAmount));

    const { data: insertedTransactions, error: transactionError } = await secondSupabaseAdmin
      .from('transactions')
      .insert([
        {
          status: 'paid',
          paid_at: new Date().toISOString(),
          subtotal,
          total_amount: totalAmount,
          payment_method: normalizedPaymentMethod,
          vat,
          items_count: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
          discount_type: promoResult?.valid ? promoResult.promo.discount_type : 'None',
          discount_amount: discountAmount,
          receipt_id: receiptId,
          cashier_name: ECOMMERCE_CASHIER_NAME,
        },
      ])
      .select('*')
      .single();

    if (transactionError || !insertedTransactions) {
      console.error('Create transaction failed:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    const sharedTransactionId = String(insertedTransactions.id);
    const txNo = String(insertedTransactions.tx_no ?? receiptId);
    const orderNumber = `TXN-${txNo}`;

    const transactionItems = normalizedItems.map((item) => ({
      transaction_id: insertedTransactions.id,
      name: item.name,
      category: item.category,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: toMoney(item.price * item.quantity),
    }));

    const { error: transactionItemsError } = await secondSupabaseAdmin
      .from('transaction_items')
      .insert(transactionItems);

    if (transactionItemsError) {
      console.error('Create transaction items failed:', transactionItemsError);
      return NextResponse.json({ error: 'Failed to create transaction items' }, { status: 500 });
    }

    for (const item of normalizedItems) {
      const product = productsById.get(item.id);
      const nextStock = Number(product?.stock ?? 0) - item.quantity;

      const { error: stockError } = await secondSupabaseAdmin
        .from('products')
        .update({ stock: nextStock })
        .eq('id', Number(item.id));

      if (stockError) {
        console.error(`Update stock failed for product ${item.id}:`, stockError);
        return NextResponse.json({ error: `Failed to update stock for ${item.name}` }, { status: 500 });
      }
    }

    if (promoResult?.valid) {
      const { error: promoUsageError } = await secondSupabaseAdmin
        .from('promo_codes')
        .update({ times_used: promoResult.promo.times_used + 1 })
        .eq('id', promoResult.promo.id);

      if (promoUsageError) {
        console.error('Update promo usage failed:', promoUsageError);
      }
    }

    return NextResponse.json({
      order: {
        id: insertedTransactions.id,
        orderNumber,
        txNo,
        date: insertedTransactions.created_at,
        items: normalizedItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal,
        total: totalAmount,
        deliveryFee: toMoney(deliveryFee),
        discountAmount: toMoney(discountAmount),
        promoCode: promoResult?.valid ? promoResult.promo.code : null,
        status: 'Processing',
        shippingAddress,
        paymentMethod,
        receiptNumber,
      },
    });
  } catch (error) {
    console.error('Place order error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
