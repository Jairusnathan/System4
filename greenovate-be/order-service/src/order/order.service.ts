import { Injectable } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { SupabaseService } from './supabase.service';
import { requestDownstream } from '../shared/http/request-downstream';
import { SERVICE_URLS } from '../shared/http/service-urls';

type CheckoutItem = { id: string; quantity: number; };
type CustomerContact = { email?: string; fullName?: string; };
type PreparedOrderItem = { id: string; name?: string; category?: string; price?: number; quantity: number; availableStock?: number; status: 'ok' | 'missing' | 'insufficient-stock'; };
type PromoValidationResult = { valid: true; promo: { id: number; code: string; description: string | null; discount_type: 'fixed' | 'percent'; discount_value: number; min_subtotal: number; max_discount: number | null; times_used: number; }; normalizedCode: string; discountAmount: number; message: string; } | { valid: false; normalizedCode: string; message: string; };

@Injectable()
export class OrderService {
  private readonly fallbackProductImage = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

  constructor(private readonly supabaseService: SupabaseService, private readonly mailerService: MailerService) {}

  async listCustomerOrders(userId: string, limit = 50) {
    const { data, error } = await this.supabaseService.supabaseAdmin.from('online_orders').select('id, receipt_number, order_number, tx_no, created_at, subtotal, delivery_fee, discount_amount, total, promo_code, fulfillment_status, shipping_address, payment_method, online_order_items ( product_id, product_name, category, unit_price, quantity, line_total )').eq('customer_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({ id: row.id, receiptNumber: row.receipt_number ?? undefined, orderNumber: row.order_number ?? undefined, txNo: row.tx_no ?? undefined, date: row.created_at, items: ((row.online_order_items ?? []) as any[]).map((item) => ({ id: item.product_id, name: item.product_name, description: '', price: Number(item.unit_price ?? 0), category: item.category ?? 'Uncategorized', image: `${this.fallbackProductImage}&sig=${encodeURIComponent(item.product_id)}`, quantity: Number(item.quantity ?? 0) })), subtotal: Number(row.subtotal ?? 0), deliveryFee: Number(row.delivery_fee ?? 0), discountAmount: Number(row.discount_amount ?? 0), promoCode: row.promo_code ?? undefined, total: Number(row.total ?? 0), status: row.fulfillment_status, shippingAddress: row.shipping_address, paymentMethod: row.payment_method }));
  }

  async adminListAllOrders(status?: string, search?: string, limit = 50, offset = 0) {
    let query = this.supabaseService.supabaseAdmin
      .from('online_orders')
      .select(
        'id, receipt_number, order_number, tx_no, created_at, subtotal, delivery_fee, discount_amount, total, promo_code, fulfillment_status, shipping_address, payment_method, customer_id, online_order_items ( product_id, product_name, category, unit_price, quantity )',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });
    if (status) query = (query as any).eq('fulfillment_status', status);
    if (search) query = (query as any).or(`receipt_number.ilike.%${search}%,order_number.ilike.%${search}%`);
    query = (query as any).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return { data: [], total: 0 };
    const rows = (data ?? []).map((row: any) => ({
      id: row.id,
      receiptNumber: row.receipt_number ?? undefined,
      orderNumber: row.order_number ?? undefined,
      txNo: row.tx_no ?? undefined,
      date: row.created_at,
      customerId: row.customer_id,
      items: ((row.online_order_items ?? []) as any[]).map((item) => ({
        id: item.product_id,
        name: item.product_name,
        price: Number(item.unit_price ?? 0),
        category: item.category ?? 'Uncategorized',
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
    return { data: rows, total: count ?? 0 };
  }

  async adminUpdateOrderStatus(receiptNumber: string, newStatus: string) {
    const db = this.supabaseService.supabaseAdmin;
    const { data: order, error: fetchError } = await db
      .from('online_orders')
      .select('id, fulfillment_status')
      .eq('receipt_number', receiptNumber)
      .single();
    if (fetchError || !order) return { success: false, error: 'Order not found' };
    const updateData: Record<string, unknown> = { fulfillment_status: newStatus };
    if (newStatus === 'Cancelled') {
      updateData.cancellation_reason = 'Cancelled by admin';
      updateData.cancelled_at = new Date().toISOString();
    }
    const { error: updateError } = await db.from('online_orders').update(updateData).eq('id', order.id);
    if (updateError) return { success: false, error: 'Failed to update order status' };
    return { success: true };
  }

  async adminGetStats() {
    const db = this.supabaseService.supabaseAdmin;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalResult, todayResult, pendingResult, revenueResult] = await Promise.all([
      db.from('online_orders').select('id', { count: 'exact', head: true }),
      db.from('online_orders').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      db.from('online_orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'Processing'),
      db.from('online_orders').select('total').gte('created_at', today.toISOString()).neq('fulfillment_status', 'Cancelled'),
    ]);
    const todayRevenue = ((revenueResult.data ?? []) as { total: number }[]).reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    const [pendingReturns, processingOrders, inTransitOrders, deliveredOrders, cancelledOrders] = await Promise.all([
      db.from('return_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('online_orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'Processing'),
      db.from('online_orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'In Transit'),
      db.from('online_orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'Delivered'),
      db.from('online_orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'Cancelled'),
    ]);
    return {
      totalOrders: totalResult.count ?? 0,
      ordersToday: todayResult.count ?? 0,
      pendingOrders: pendingResult.count ?? 0,
      todayRevenue,
      pendingReturns: pendingReturns.count ?? 0,
      processingOrders: processingOrders.count ?? 0,
      inTransitOrders: inTransitOrders.count ?? 0,
      deliveredOrders: deliveredOrders.count ?? 0,
      cancelledOrders: cancelledOrders.count ?? 0,
    };
  }

  async search(orderNumber?: string, status?: string, limit = 20) {
    let query = this.supabaseService.supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) query = query.eq('status', status);
    if (orderNumber) query = query.or(`order_number.ilike.%${orderNumber}%,id.ilike.%${orderNumber}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async submitReturnRequest(
    userId: string,
    customerEmail: string,
    receiptNumber: string,
    reason: string,
    description: string | undefined,
    items: Array<{ productId: string; name: string; quantity: number }>,
  ): Promise<{ success: boolean; error?: string }> {
    const db = this.supabaseService.supabaseAdmin;

    // Verify order belongs to user and is Delivered
    const { data: order, error: fetchError } = await db
      .from('online_orders')
      .select('id, customer_id, fulfillment_status, receipt_number')
      .eq('receipt_number', receiptNumber)
      .single();

    if (fetchError || !order) return { success: false, error: 'Order not found' };
    if (order.customer_id !== userId) return { success: false, error: 'Order not found' };
    if (order.fulfillment_status !== 'Delivered') {
      return { success: false, error: 'Only delivered orders can be returned' };
    }

    // Check no existing pending request for this order
    const { data: existing } = await db
      .from('return_requests')
      .select('id')
      .eq('receipt_number', receiptNumber)
      .in('status', ['pending', 'reviewing'])
      .single();

    if (existing) return { success: false, error: 'A return request for this order is already pending' };

    // Create return request
    const { error: insertError } = await db.from('return_requests').insert({
      online_order_id: order.id,
      customer_id: userId,
      receipt_number: receiptNumber,
      reason,
      description: description?.trim() || null,
      items,
      status: 'pending',
    });

    if (insertError) return { success: false, error: 'Failed to submit return request' };

    // Send confirmation email — fire and forget
    if (this.mailerService.isConfigured() && customerEmail) {
      void (async () => {
        try {
          await this.mailerService.sendReturnRequestEmail(
            customerEmail,
            customerEmail.split('@')[0] || 'there',
            { receiptNumber, reason, description, items },
          );
        } catch {}
      })();
    }

    return { success: true };
  }

  async cancelOrder(userId: string, receiptNumber: string, reason?: string, customerEmail?: string): Promise<{ success: boolean; error?: string }> {
    const db = this.supabaseService.supabaseAdmin;

    // Find the order belonging to this user
    const { data: order, error: fetchError } = await db
      .from('online_orders')
      .select('id, customer_id, fulfillment_status, receipt_number, transaction_id, created_at, total, shipping_address, payment_method, online_order_items(product_id, product_name, quantity, unit_price)')
      .eq('receipt_number', receiptNumber)
      .single();

    if (fetchError || !order) return { success: false, error: 'Order not found' };
    if (order.customer_id !== userId) return { success: false, error: 'Order not found' };
    if (order.fulfillment_status !== 'Processing') return { success: false, error: `Order cannot be cancelled — current status is ${order.fulfillment_status}` };

    const cancelledAt = new Date().toISOString();
    const cancellationReason = reason?.trim() || 'No reason provided';

    // 1. Update online_orders
    const { error: updateError } = await db
      .from('online_orders')
      .update({
        fulfillment_status: 'Cancelled',
        cancellation_reason: cancellationReason,
        cancelled_at: cancelledAt,
      })
      .eq('id', order.id);

    if (updateError) return { success: false, error: 'Failed to cancel order' };

    const items = (order.online_order_items ?? []) as any[];

    // 2. Update transaction status to cancelled — fire and forget
    if (order.transaction_id) {
      void (async () => {
        try {
          await db.from('transactions').update({ status: 'cancelled' }).eq('id', order.transaction_id);
        } catch {}
      })();
    }

    // 3. Release stock back to catalog — fire and forget
    if (items.length > 0) {
      void (async () => {
        try {
          await this.releaseStock(items.map((item: any) => ({
            id: String(item.product_id),
            quantity: Number(item.quantity),
          })));
        } catch {}
      })();
    }

    // 4. Send cancellation email — fire and forget
    if (this.mailerService.isConfigured() && customerEmail) {
      void (async () => {
        try {
          await this.mailerService.sendOrderCancellationEmail(
            customerEmail,
            customerEmail.split('@')[0] || 'there',
            {
              receiptNumber: order.receipt_number,
              reason: cancellationReason,
              items: items.map((item: any) => ({
                name: item.product_name,
                quantity: Number(item.quantity),
                price: Number(item.unit_price),
              })),
              total: Number(order.total),
              shippingAddress: order.shipping_address,
              paymentMethod: order.payment_method,
            },
          );
        } catch {}
      })();
    }

    return { success: true };
  }

  async getOrderStatus(receiptNumber: string) {
    const result = await requestDownstream<{ status: string; rawStatus: string; updatedAt: string } | { error: string }>({
      baseUrl: SERVICE_URLS.catalog,
      path: `/internal/receipts/status/${encodeURIComponent(receiptNumber)}`,
      method: 'GET',
    });

    if (result.status === 404 || result.status === 500) return null;
    const data = result.data as any;
    if (!data?.status) return null;
    return { status: data.status, rawStatus: data.rawStatus, updatedAt: data.updatedAt };
  }

  async placeOrder(userId: string, body: unknown, customer?: CustomerContact) {
    const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const shippingAddress = typeof payload.shippingAddress === 'string' ? payload.shippingAddress.trim() : '';
    const paymentMethod = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.trim() : 'Cash on Delivery';
    const requestedDeliveryFee = Number(payload.deliveryFee);
    const deliveryFee = Number.isFinite(requestedDeliveryFee) ? Math.max(0, requestedDeliveryFee) : 50;
    const promoCode = typeof payload.promoCode === 'string' ? payload.promoCode.trim() : '';
    const branchId = Number.isFinite(Number(payload.branchId)) ? Number(payload.branchId) : null;
    const deliveryMethod = payload.deliveryMethod === 'claim_at_branch' || payload.deliveryMethod === 'same_day' || payload.deliveryMethod === 'scheduled' ? (payload.deliveryMethod as string) : null;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    if (!shippingAddress) return { error: 'Shipping address is required', status: 400 };
    if (rawItems.length === 0) return { error: 'Cart is empty', status: 400 };

    const requestedItems = rawItems.map((item: any) => ({ id: typeof item?.id === 'string' ? item.id : '', quantity: Math.max(1, Math.trunc(Number(item?.quantity ?? 1))) })).filter((item) => item.id);
    if (requestedItems.length === 0) return { error: 'No valid cart items found', status: 400 };

    const preparedItems = await this.prepareOrderItems(requestedItems);
    for (const item of preparedItems) {
      if (item.status === 'missing') return { error: `Product ${item.id} was not found`, status: 400 };
      if (item.status === 'insufficient-stock') return { error: `${item.name ?? 'Product'} only has ${Number(item.availableStock ?? 0)} item(s) left in stock.`, status: 409 };
    }

    const normalizedItems = preparedItems.map((item) => ({ id: item.id, name: item.name ?? `Product ${item.id}`, category: item.category ?? 'Uncategorized', price: Number(item.price ?? 0), quantity: item.quantity }));
    const subtotal = Number(normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    const vat = Number((subtotal * 0.12).toFixed(2));
    const promoResult = promoCode ? await this.validatePromoCode(promoCode, subtotal) : null;
    if (promoCode && (!promoResult || !promoResult.valid)) return { error: promoResult?.message || 'Invalid promo code.', status: 400 };

    await this.commitStock(normalizedItems);

    try {
      const db = this.supabaseService.supabaseAdmin;
      const { data: receiptRows, error: receiptError } = await db.rpc('issue_next_receipt_number', {});
      if (receiptError) throw receiptError;
      const raw = Array.isArray(receiptRows) ? receiptRows[0] : receiptRows;
      let receiptId: number, receiptNumber: string;
      if (raw && typeof raw === 'object') {
        receiptId = Number((raw as any).receipt_id ?? (raw as any).id ?? 0);
        receiptNumber = String((raw as any).receipt_number ?? (raw as any).number ?? '');
      } else {
        receiptNumber = String(raw ?? '');
        const { data: insertedReceipt, error: insertReceiptError } = await db.from('receipts').insert({ receipt_number: receiptNumber, issued_at: new Date().toISOString() }).select('receipt_id').single();
        receiptId = insertReceiptError ? Number((await db.from('receipts').select('receipt_id').eq('receipt_number', receiptNumber).single()).data?.receipt_id ?? 0) : Number(insertedReceipt?.receipt_id ?? 0);
      }
      if (!receiptId || !receiptNumber) return { error: 'Invalid receipt response from database', status: 500 };

      const discountAmount = promoResult?.valid ? promoResult.discountAmount : 0;
      const totalAmount = Number(Math.max(0, subtotal + deliveryFee - discountAmount).toFixed(2));
      const { data: insertedTransaction, error: transactionError } = await db.from('transactions').insert([{ status: 'paid', paid_at: new Date().toISOString(), subtotal, total_amount: totalAmount, payment_method: this.normalizePaymentMethod(paymentMethod), vat, items_count: normalizedItems.reduce((sum, item) => sum + item.quantity, 0), discount_type: promoResult?.valid ? promoResult.promo.discount_type : 'None', discount_amount: discountAmount, receipt_id: receiptId, cashier_name: 'Ecommerce' }]).select('*').single();
      if (transactionError || !insertedTransaction) throw transactionError;

      const txNo = String(insertedTransaction.tx_no ?? receiptId);
      const orderNumber = `TXN-${txNo}`;

      const { data: insertedOnlineOrder, error: onlineOrderError } = await db.from('online_orders').insert({ customer_id: userId, receipt_id: receiptId, receipt_number: receiptNumber, transaction_id: insertedTransaction.id, order_number: orderNumber, tx_no: txNo, branch_id: branchId, shipping_address: shippingAddress, payment_method: paymentMethod, payment_status: 'paid', fulfillment_status: 'Processing', delivery_method: deliveryMethod, subtotal, delivery_fee: Number(deliveryFee.toFixed(2)), discount_amount: Number(discountAmount.toFixed(2)), total: totalAmount, promo_code: promoResult?.valid ? promoResult.promo.code : null, metadata: { source: 'web-checkout' } }).select('id').single();
      if (onlineOrderError || !insertedOnlineOrder) throw onlineOrderError;

      await db.from('online_order_items').insert(normalizedItems.map((item) => ({ online_order_id: insertedOnlineOrder.id, product_id: item.id, product_name: item.name, category: item.category, unit_price: item.price, quantity: item.quantity, line_total: Number((item.price * item.quantity).toFixed(2)) })));

      if (promoResult?.valid) { try { await this.redeemPromoCode(promoResult.promo.id); } catch (error) { console.error('Promo redeem warning:', error); } }
      try { await this.clearCart(userId); } catch (error) { console.error('Cart clear warning:', error); }

      if (this.mailerService.isConfigured()) {
        void (async () => { try { const recipientEmail = customer?.email?.trim(); if (recipientEmail) { await this.mailerService.sendOrderConfirmationEmail(recipientEmail, customer?.fullName?.trim() || 'Customer', { receiptNumber, items: normalizedItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })), subtotal, deliveryFee: Number(deliveryFee.toFixed(2)), discountAmount: Number(discountAmount.toFixed(2)), total: totalAmount, paymentMethod, shippingAddress, deliveryMethod: deliveryMethod ?? undefined }); } } catch (error) { console.error('[order-service] Order confirmation email error:', error); } })();
      }

      return { order: { id: receiptNumber || insertedTransaction.id, orderNumber, txNo, date: insertedTransaction.created_at, items: normalizedItems, subtotal, total: totalAmount, deliveryFee: Number(deliveryFee.toFixed(2)), discountAmount: Number(discountAmount.toFixed(2)), promoCode: promoResult?.valid ? promoResult.promo.code : null, status: 'Processing', shippingAddress, paymentMethod, receiptNumber } };
    } catch (error) {
      await this.releaseStock(normalizedItems).catch((e) => console.error('Stock release warning:', e));
      throw error;
    }
  }

  private async prepareOrderItems(items: CheckoutItem[]) {
    const result = await requestDownstream<{ items?: PreparedOrderItem[] }>({ baseUrl: SERVICE_URLS.catalog, path: '/internal/products/prepare-order', method: 'POST', body: { items } });
    return Array.isArray(result.data?.items) ? result.data.items : [];
  }

  private async commitStock(items: CheckoutItem[]) {
    const result = await requestDownstream<{ success?: boolean; message?: string }>({ baseUrl: SERVICE_URLS.catalog, path: '/internal/products/commit-stock', method: 'POST', body: { items } });
    if (result.status >= 400 || !result.data?.success) throw new Error(result.data?.message || 'Failed to reserve stock.');
  }

  private async releaseStock(items: CheckoutItem[]) {
    await requestDownstream<{ success?: boolean }>({ baseUrl: SERVICE_URLS.catalog, path: '/internal/products/release-stock', method: 'POST', body: { items } });
  }

  private async validatePromoCode(code: string, subtotal: number) {
    const result = await requestDownstream<PromoValidationResult>({ baseUrl: SERVICE_URLS.promo, path: '/internal/promos/validate', method: 'POST', body: { code, subtotal } });
    return result.data;
  }

  private async redeemPromoCode(promoId: number) {
    const result = await requestDownstream<{ success?: boolean }>({ baseUrl: SERVICE_URLS.promo, path: '/internal/promos/redeem', method: 'POST', body: { promoId } });
    if (result.status >= 400 || !result.data?.success) throw new Error('Failed to mark promo usage.');
  }

  private async clearCart(userId: string) {
    await requestDownstream<{ success?: boolean }>({ baseUrl: SERVICE_URLS.cart, path: '/internal/cart/clear', method: 'POST', body: { userId } });
  }

  private normalizePaymentMethod(paymentMethod: string) {
    const normalized = paymentMethod.trim().toLowerCase();
    if (normalized === 'cash on delivery') return 'cash';
    if (normalized === 'credit / debit card' || normalized === 'credit/debit card' || normalized === 'card') return 'card';
    if (normalized === 'gcash' || normalized === 'maya' || normalized === 'mobile payment') return 'mobile';
    return normalized || 'cash';
  }
}
