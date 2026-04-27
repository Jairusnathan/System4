import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase.service';
import { requestDownstream } from '../../shared/http/request-downstream';
import { SERVICE_URLS } from '../../shared/http/service-urls';

type CheckoutItem = {
  id: string;
  quantity: number;
};

type PreparedOrderItem = {
  id: string;
  name?: string;
  category?: string;
  price?: number;
  quantity: number;
  availableStock?: number;
  status: 'ok' | 'missing' | 'insufficient-stock';
};

type PromoValidationResult =
  | {
      valid: true;
      promo: {
        id: number;
        code: string;
        description: string | null;
        discount_type: 'fixed' | 'percent';
        discount_value: number;
        min_subtotal: number;
        max_discount: number | null;
        times_used: number;
      };
      normalizedCode: string;
      discountAmount: number;
      message: string;
    }
  | {
      valid: false;
      normalizedCode: string;
      message: string;
    };

@Injectable()
export class OrderServiceService {
  constructor(private readonly supabaseService: SupabaseService) {}

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

  async placeOrder(userId: string, body: unknown) {
    const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const shippingAddress = typeof payload.shippingAddress === 'string' ? payload.shippingAddress.trim() : '';
    const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.trim() : 'Cash on Delivery';
    const requestedDeliveryFee = Number(payload.deliveryFee);
    const deliveryFee = Number.isFinite(requestedDeliveryFee) ? Math.max(0, requestedDeliveryFee) : 50;
    const promoCode = typeof payload.promoCode === 'string' ? payload.promoCode.trim() : '';
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    if (!shippingAddress) return { error: 'Shipping address is required', status: 400 };
    if (rawItems.length === 0) return { error: 'Cart is empty', status: 400 };

    const requestedItems = rawItems
      .map((item) => ({
        id: typeof item === 'object' && item && typeof (item as { id?: unknown }).id === 'string'
          ? (item as { id: string }).id
          : '',
        quantity: Math.max(1, Math.trunc(Number(typeof item === 'object' && item ? (item as { quantity?: unknown }).quantity ?? 1 : 1))),
      }))
      .filter((item) => item.id);

    if (requestedItems.length === 0) {
      return { error: 'No valid cart items found', status: 400 };
    }

    const preparedItems = await this.prepareOrderItems(requestedItems);
    for (const item of preparedItems) {
      if (item.status === 'missing') {
        return { error: `Product ${item.id} was not found`, status: 400 };
      }

      if (item.status === 'insufficient-stock') {
        return {
          error: `${item.name ?? 'Product'} only has ${Number(item.availableStock ?? 0)} item(s) left in stock.`,
          status: 409,
        };
      }
    }

    const normalizedItems = preparedItems.map((item) => ({
      id: item.id,
      name: item.name ?? `Product ${item.id}`,
      category: item.category ?? 'Uncategorized',
      price: Number(item.price ?? 0),
      quantity: item.quantity,
    }));

    const subtotal = Number(
      normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
    );
    const vat = Number((subtotal * 0.12).toFixed(2));
    const promoResult = promoCode ? await this.validatePromoCode(promoCode, subtotal) : null;

    if (promoCode && (!promoResult || !promoResult.valid)) {
      return {
        error: promoResult?.message || 'Invalid promo code.',
        status: 400,
      };
    }

    await this.commitStock(normalizedItems);

    try {
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

      const discountAmount = promoResult?.valid ? promoResult.discountAmount : 0;
      const totalAmount = Number(Math.max(0, subtotal + deliveryFee - discountAmount).toFixed(2));

      const { data: insertedTransaction, error: transactionError } =
        await this.supabaseService.secondSupabaseAdmin
          .from('transactions')
          .insert([
            {
              status: 'paid',
              paid_at: new Date().toISOString(),
              subtotal,
              total_amount: totalAmount,
              payment_method: this.normalizePaymentMethodForPos(paymentMethod),
              vat,
              items_count: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
              discount_type: promoResult?.valid ? promoResult.promo.discount_type : 'None',
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

      if (promoResult?.valid) {
        try {
          await this.redeemPromoCode(promoResult.promo.id);
        } catch (error) {
          console.error('Promo redeem warning:', error);
        }
      }

      try {
        await this.clearCart(userId);
      } catch (error) {
        console.error('Cart clear warning:', error);
      }

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
    } catch (error) {
      await this.releaseStock(normalizedItems).catch((releaseError) => {
        console.error('Stock release warning:', releaseError);
      });
      throw error;
    }
  }

  private async prepareOrderItems(items: CheckoutItem[]) {
    const result = await requestDownstream<{ items?: PreparedOrderItem[] }>({
      baseUrl: SERVICE_URLS.catalog,
      path: '/internal/products/prepare-order',
      method: 'POST',
      body: { items },
    });

    return Array.isArray(result.data?.items) ? result.data.items : [];
  }

  private async commitStock(items: CheckoutItem[]) {
    const result = await requestDownstream<{ success?: boolean; message?: string }>({
      baseUrl: SERVICE_URLS.catalog,
      path: '/internal/products/commit-stock',
      method: 'POST',
      body: { items },
    });

    if (result.status >= 400 || !result.data?.success) {
      throw new Error(result.data?.message || 'Failed to reserve stock.');
    }
  }

  private async releaseStock(items: CheckoutItem[]) {
    await requestDownstream<{ success?: boolean }>({
      baseUrl: SERVICE_URLS.catalog,
      path: '/internal/products/release-stock',
      method: 'POST',
      body: { items },
    });
  }

  private async validatePromoCode(code: string, subtotal: number) {
    const result = await requestDownstream<PromoValidationResult>({
      baseUrl: SERVICE_URLS.promo,
      path: '/internal/promos/validate',
      method: 'POST',
      body: { code, subtotal },
    });

    return result.data;
  }

  private async redeemPromoCode(promoId: number) {
    const result = await requestDownstream<{ success?: boolean }>({
      baseUrl: SERVICE_URLS.promo,
      path: '/internal/promos/redeem',
      method: 'POST',
      body: { promoId },
    });

    if (result.status >= 400 || !result.data?.success) {
      throw new Error('Failed to mark promo usage.');
    }
  }

  private async clearCart(userId: string) {
    const result = await requestDownstream<{ success?: boolean }>({
      baseUrl: SERVICE_URLS.cart,
      path: '/internal/cart/clear',
      method: 'POST',
      body: { userId },
    });

    if (result.status >= 400 || !result.data?.success) {
      throw new Error('Failed to clear cart.');
    }
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
