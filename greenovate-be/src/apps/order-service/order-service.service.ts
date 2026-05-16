import { Injectable } from '@nestjs/common';
import { MailerService } from '../../services/mailer.service';
import { SupabaseService } from '../../services/supabase.service';
import { requestDownstream } from '../../shared/http/request-downstream';
import { SERVICE_URLS } from '../../shared/http/service-urls';

type CheckoutItem = {
  id: string;
  quantity: number;
};

type CustomerContact = {
  email?: string;
  fullName?: string;
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
  private readonly fallbackProductImage =
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailerService: MailerService,
  ) {}

  async listCustomerOrders(userId: string, limit = 50) {
    const { data, error } = await this.supabaseService.supabaseAdmin
      .from('online_orders')
      .select(
        `
        id,
        receipt_number,
        order_number,
        tx_no,
        created_at,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        promo_code,
        fulfillment_status,
        shipping_address,
        payment_method,
        online_order_items (
          product_id,
          product_name,
          category,
          unit_price,
          quantity,
          line_total
        )
      `,
      )
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number ?? undefined,
      orderNumber: row.order_number ?? undefined,
      txNo: row.tx_no ?? undefined,
      date: row.created_at,
      items: (
        (row.online_order_items ?? []) as Array<{
          product_id: string;
          product_name: string;
          category: string | null;
          unit_price: number | string;
          quantity: number;
        }>
      ).map((item) => ({
        id: item.product_id,
        name: item.product_name,
        description: '',
        price: Number(item.unit_price ?? 0),
        category: item.category ?? 'Uncategorized',
        image: this.buildOrderItemImage(item.product_id),
        quantity: Number(item.quantity ?? 0),
      })),
      subtotal: Number(row.subtotal ?? 0),
      deliveryFee: Number(row.delivery_fee ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      promoCode: row.promo_code ?? undefined,
      total: Number(row.total ?? 0),
      status: row.fulfillment_status,
      shippingAddress: row.shipping_address,
      paymentMethod: row.payment_method,
    }));
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
      query = query.or(
        `order_number.ilike.%${orderNumber}%,id.ilike.%${orderNumber}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getOrderStatus(receiptNumber: string) {
    const { data: receipt } = await this.supabaseService.secondSupabaseAdmin
      .from('receipts')
      .select('receipt_id')
      .eq('receipt_number', receiptNumber)
      .single();

    if (!receipt?.receipt_id) return null;

    const { data: transaction } = await this.supabaseService.secondSupabaseAdmin
      .from('transactions')
      .select('status, updated_at')
      .eq('receipt_id', receipt.receipt_id)
      .single();

    if (!transaction) return null;

    const statusMap: Record<string, string> = {
      paid: 'Processing',
      preparing: 'Processing',
      ready: 'In Transit',
      picked_up: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };

    return {
      status: statusMap[transaction.status] ?? 'Processing',
      rawStatus: transaction.status,
      updatedAt: transaction.updated_at,
    };
  }

  async placeOrder(userId: string, body: unknown, customer?: CustomerContact) {
    const payload =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const shippingAddress =
      typeof payload.shippingAddress === 'string'
        ? payload.shippingAddress.trim()
        : '';
    const paymentMethod =
      typeof payload.paymentMethod === 'string'
        ? payload.paymentMethod.trim()
        : 'Cash on Delivery';
    const requestedDeliveryFee = Number(payload.deliveryFee);
    const deliveryFee = Number.isFinite(requestedDeliveryFee)
      ? Math.max(0, requestedDeliveryFee)
      : 50;
    const promoCode =
      typeof payload.promoCode === 'string' ? payload.promoCode.trim() : '';
    const branchId = Number.isFinite(Number(payload.branchId))
      ? Number(payload.branchId)
      : null;
    const deliveryMethod =
      payload.deliveryMethod === 'claim_at_branch' ||
      payload.deliveryMethod === 'same_day' ||
      payload.deliveryMethod === 'scheduled'
        ? (payload.deliveryMethod as string)
        : null;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    if (!shippingAddress)
      return { error: 'Shipping address is required', status: 400 };
    if (rawItems.length === 0) return { error: 'Cart is empty', status: 400 };

    const requestedItems = rawItems
      .map((item) => ({
        id:
          typeof item === 'object' &&
          item &&
          typeof (item as { id?: unknown }).id === 'string'
            ? (item as { id: string }).id
            : '',
        quantity: Math.max(
          1,
          Math.trunc(
            Number(
              typeof item === 'object' && item
                ? ((item as { quantity?: unknown }).quantity ?? 1)
                : 1,
            ),
          ),
        ),
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
      normalizedItems
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2),
    );
    const vat = Number((subtotal * 0.12).toFixed(2));
    const promoResult = promoCode
      ? await this.validatePromoCode(promoCode, subtotal)
      : null;

    if (promoCode && (!promoResult || !promoResult.valid)) {
      return {
        error: promoResult?.message || 'Invalid promo code.',
        status: 400,
      };
    }

    await this.commitStock(normalizedItems);

    try {
      const db = this.supabaseService.supabaseAdmin;

      // Create receipt using issue_next_receipt_number RPC
      const { data: receiptRows, error: receiptError } = await db.rpc(
        'issue_next_receipt_number',
        {},
      );

      if (receiptError) {
        throw receiptError;
      }

      const raw = Array.isArray(receiptRows) ? receiptRows[0] : receiptRows;
      let receiptId: number;
      let receiptNumber: string;

      if (raw && typeof raw === 'object') {
        const receiptNumberValue =
          (raw as Record<string, unknown>).receipt_number ??
          (raw as Record<string, unknown>).number ??
          (raw as Record<string, unknown>).receiptNumber;
        receiptId = Number(
          (raw as Record<string, unknown>).receipt_id ??
            (raw as Record<string, unknown>).id ??
            0,
        );
        receiptNumber =
          typeof receiptNumberValue === 'string' ? receiptNumberValue : '';
      } else {
        receiptNumber = String(raw ?? '');
        const { data: insertedReceipt, error: insertReceiptError } = await db
          .from('receipts')
          .insert({
            receipt_number: receiptNumber,
            issued_at: new Date().toISOString(),
          })
          .select('receipt_id')
          .single();

        if (insertReceiptError) {
          const { data: lookupRow } = await db
            .from('receipts')
            .select('receipt_id')
            .eq('receipt_number', receiptNumber)
            .single();
          receiptId = Number(lookupRow?.receipt_id ?? 0);
        } else {
          receiptId = Number(insertedReceipt?.receipt_id ?? 0);
        }
      }

      if (!receiptId || !receiptNumber) {
        return { error: 'Invalid receipt response from database', status: 500 };
      }

      const discountAmount = promoResult?.valid
        ? promoResult.discountAmount
        : 0;
      const totalAmount = Number(
        Math.max(0, subtotal + deliveryFee - discountAmount).toFixed(2),
      );

      const { data: insertedTransaction, error: transactionError } = await db
        .from('transactions')
        .insert([
          {
            status: 'paid',
            paid_at: new Date().toISOString(),
            subtotal,
            total_amount: totalAmount,
            payment_method: this.normalizePaymentMethodForPos(paymentMethod),
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

      const { error: transactionItemsError } = await db
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

      const txNo = String(insertedTransaction.tx_no ?? receiptId);
      const orderNumber = `TXN-${txNo}`;

      // Insert into online_orders
      const { data: insertedOnlineOrder, error: onlineOrderError } = await db
        .from('online_orders')
        .insert({
          customer_id: userId,
          receipt_id: receiptId,
          receipt_number: receiptNumber,
          transaction_id: insertedTransaction.id,
          order_number: orderNumber,
          tx_no: txNo,
          branch_id: branchId,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          payment_status: 'paid',
          fulfillment_status: 'Processing',
          delivery_method: deliveryMethod,
          subtotal,
          delivery_fee: Number(deliveryFee.toFixed(2)),
          discount_amount: Number(discountAmount.toFixed(2)),
          total: totalAmount,
          promo_code: promoResult?.valid ? promoResult.promo.code : null,
          metadata: { source: 'web-checkout' },
        })
        .select('id')
        .single();

      if (onlineOrderError || !insertedOnlineOrder) {
        throw onlineOrderError;
      }

      // Insert into online_order_items
      const { error: onlineOrderItemsError } = await db
        .from('online_order_items')
        .insert(
          normalizedItems.map((item) => ({
            online_order_id: insertedOnlineOrder.id,
            product_id: item.id,
            product_name: item.name,
            category: item.category,
            unit_price: item.price,
            quantity: item.quantity,
            line_total: Number((item.price * item.quantity).toFixed(2)),
          })),
        );

      if (onlineOrderItemsError) {
        throw onlineOrderItemsError;
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

      // Publish order.placed event (fire-and-forget — never block the checkout response)
      if (this.mailerService.isConfigured()) {
        void (async () => {
          try {
            const recipientEmail = customer?.email?.trim();
            if (recipientEmail) {
              await this.mailerService.sendOrderConfirmationEmail(
                recipientEmail,
                customer?.fullName?.trim() || 'Customer',
                {
                  receiptNumber,
                  items: normalizedItems.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                  })),
                  subtotal,
                  deliveryFee: Number(deliveryFee.toFixed(2)),
                  discountAmount: Number(discountAmount.toFixed(2)),
                  total: totalAmount,
                  paymentMethod,
                  shippingAddress,
                },
              );
            }
          } catch (error) {
            console.error(
              '[order-service] Order confirmation email error:',
              error,
            );
          }
        })();
      }

      this.supabaseService.supabase
        .from('order_events')
        .insert({
          event_type: 'order.placed',
          order_id: insertedTransaction.id,
          receipt_number: receiptNumber,
          user_id: userId,
          payload: {
            receiptNumber,
            orderNumber,
            total: totalAmount,
            items: normalizedItems.length,
            paymentMethod,
          },
        })
        .then(({ error }) => {
          if (error)
            console.error(
              '[order-service] Failed to publish order.placed event:',
              error,
            );
        });

      return {
        order: {
          id: receiptNumber || insertedTransaction.id,
          orderNumber,
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
    const result = await requestDownstream<{
      success?: boolean;
      message?: string;
    }>({
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

    if (
      normalized === 'gcash' ||
      normalized === 'maya' ||
      normalized === 'mobile payment'
    ) {
      return 'mobile';
    }

    return normalized || 'cash';
  }

  private buildOrderItemImage(productId: string) {
    return `${this.fallbackProductImage}&sig=${encodeURIComponent(productId)}`;
  }
}
