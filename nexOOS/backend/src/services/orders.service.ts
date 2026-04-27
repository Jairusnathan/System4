import { Injectable } from '@nestjs/common';
import { PromosService } from './promos.service';
import { SupabaseService } from './supabase.service';

type CheckoutItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
};

@Injectable()
export class OrdersService {
  private readonly promosService: PromosService;
  private readonly supabaseService: SupabaseService;

  constructor(
    promosService: PromosService,
    supabaseService: SupabaseService,
  ) {
    this.promosService = promosService;
    this.supabaseService = supabaseService;
  }

  async search(orderNumber?: string, status?: string, limit = 20) {
    let query = this.supabaseService.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (orderNumber) {
      query = query.or(`order_number.ilike.%${orderNumber}%,id.ilike.%${orderNumber}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async placeOrder(userId: string, body: any) {
    const items = Array.isArray(body?.items) ? (body.items as CheckoutItem[]) : [];
    const shippingAddress =
      typeof body?.shippingAddress === 'string' ? body.shippingAddress.trim() : '';
    const paymentMethod =
      typeof body?.paymentMethod === 'string'
        ? body.paymentMethod.trim()
        : 'Cash on Delivery';
    const requestedDeliveryFee = Number(body?.deliveryFee);
    const deliveryFee = Number.isFinite(requestedDeliveryFee)
      ? Math.max(0, requestedDeliveryFee)
      : 50;
    const promoCode =
      typeof body?.promoCode === 'string' ? body.promoCode.trim() : '';

    if (!shippingAddress) return { error: 'Shipping address is required', status: 400 };
    if (items.length === 0) return { error: 'Cart is empty', status: 400 };

    const normalizedItems = items
      .map((item) => ({
        id: String(item.id),
        name: String(item.name || '').trim(),
        category: String(item.category || '').trim() || 'Uncategorized',
        price: Number(item.price),
        quantity: Math.max(1, Math.trunc(Number(item.quantity ?? 1))),
      }))
      .filter(
        (item) =>
          item.id && item.name && Number.isFinite(item.price) && item.price >= 0,
      );

    if (normalizedItems.length === 0) {
      return { error: 'No valid cart items found', status: 400 };
    }

    const productIds = normalizedItems
      .map((item) => Number(item.id))
      .filter((value) => Number.isFinite(value));

    const { data: products, error: productsError } =
      await this.supabaseService.secondSupabaseAdmin
        .from('products')
        .select('id, name, category, price, stock')
        .in('id', productIds);

    if (productsError) {
      throw productsError;
    }

    const productsById = new Map(
      (products ?? []).map((product) => [String(product.id), product]),
    );

    for (const item of normalizedItems) {
      const product = productsById.get(item.id);
      if (!product) return { error: `Product ${item.name} was not found`, status: 400 };

      const availableStock = Number(product.stock ?? 0);
      if (availableStock < item.quantity) {
        return {
          error: `${product.name} only has ${availableStock} item(s) left in stock.`,
          status: 409,
        };
      }
    }

    const { data: receiptRows, error: receiptError } =
      await this.supabaseService.secondSupabaseAdmin.rpc('create_receipt', {});

    if (receiptError) {
      throw receiptError;
    }

    const receipt = Array.isArray(receiptRows) ? receiptRows[0] : receiptRows;
    const receiptId = Number(receipt?.receipt_id);
    const receiptNumber = String(receipt?.receipt_number ?? '');

    if (!receiptId || !receiptNumber) {
      return { error: 'Invalid receipt response from database', status: 500 };
    }

    const subtotal = Number(
      normalizedItems
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2),
    );
    const vat = Number((subtotal * 0.12).toFixed(2));
    const normalizedPaymentMethod = this.normalizePaymentMethodForPos(paymentMethod);
    const promoResult = promoCode
      ? await this.promosService.validatePromoCode(promoCode, subtotal)
      : null;

    if (promoCode && (!promoResult || !promoResult.valid)) {
      return {
        error: promoResult?.message || 'Invalid promo code.',
        status: 400,
      };
    }

    const discountAmount = promoResult?.valid ? promoResult.discountAmount : 0;
    const totalAmount = Number(
      Math.max(0, subtotal + deliveryFee - discountAmount).toFixed(2),
    );

    const { data: insertedTransaction, error: transactionError } =
      await this.supabaseService.secondSupabaseAdmin
        .from('transactions')
        .insert([
          {
            status: 'paid',
            paid_at: new Date().toISOString(),
            subtotal,
            total_amount: totalAmount,
            payment_method: normalizedPaymentMethod,
            vat,
            items_count: normalizedItems.reduce(
              (sum, item) => sum + item.quantity,
              0,
            ),
            discount_type: promoResult?.valid
              ? promoResult.promo.discount_type
              : 'None',
            discount_amount: discountAmount,
            receipt_id: receiptId,
            cashier_name: 'Ecommerce',
          },
        ])
        .select('*')
        .single();

    if (transactionError || !insertedTransaction) {
      throw transactionError;
    }

    const { error: transactionItemsError } =
      await this.supabaseService.secondSupabaseAdmin
        .from('transaction_items')
        .insert(
          normalizedItems.map((item) => ({
            transaction_id: insertedTransaction.id,
            name: item.name,
            category: item.category,
            unit_price: item.price,
            quantity: item.quantity,
            line_total: Number((item.price * item.quantity).toFixed(2)),
          })),
        );

    if (transactionItemsError) {
      throw transactionItemsError;
    }

    for (const item of normalizedItems) {
      const product = productsById.get(item.id);
      const nextStock = Number(product?.stock ?? 0) - item.quantity;

      const { error: stockError } =
        await this.supabaseService.secondSupabaseAdmin
          .from('products')
          .update({ stock: nextStock })
          .eq('id', Number(item.id));

      if (stockError) {
        throw stockError;
      }
    }

    if (promoResult?.valid) {
      await this.supabaseService.secondSupabaseAdmin
        .from('promo_codes')
        .update({ times_used: promoResult.promo.times_used + 1 })
        .eq('id', promoResult.promo.id);
    }

    await this.supabaseService.supabase
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    const txNo = String(insertedTransaction.tx_no ?? receiptId);

    return {
      order: {
        id: insertedTransaction.id,
        orderNumber: `TXN-${txNo}`,
        txNo,
        date: insertedTransaction.created_at,
        items: normalizedItems,
        subtotal,
        total: totalAmount,
        deliveryFee: Number(deliveryFee.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        promoCode: promoResult?.valid ? promoResult.promo.code : null,
        status: 'Processing',
        shippingAddress,
        paymentMethod,
        receiptNumber,
      },
    };
  }

  private normalizePaymentMethodForPos(paymentMethod: string) {
    const normalized = paymentMethod.trim().toLowerCase();

    if (normalized === 'cash on delivery') return 'cash';
    if (
      normalized === 'credit / debit card' ||
      normalized === 'credit/debit card' ||
      normalized === 'card'
    ) {
      return 'card';
    }

    if (normalized === 'gcash' || normalized === 'maya' || normalized === 'mobile payment') {
      return 'mobile';
    }

    return normalized || 'cash';
  }
}
