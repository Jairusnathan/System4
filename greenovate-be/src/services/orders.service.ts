import { Injectable } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { PromosService } from './promos.service';
import { SupabaseService } from './supabase.service';

type CheckoutItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
};

type OnlineOrderItemRow = {
  product_id: string;
  product_name: string;
  category: string | null;
  unit_price: number | string;
  quantity: number;
  line_total: number | string;
};

type OnlineOrderRow = {
  id: string;
  receipt_number: string | null;
  order_number: string | null;
  tx_no: string | null;
  created_at: string;
  subtotal: number | string;
  delivery_fee: number | string;
  discount_amount: number | string;
  total: number | string;
  promo_code: string | null;
  fulfillment_status: 'Processing' | 'In Transit' | 'Delivered' | 'Cancelled';
  shipping_address: string;
  payment_method: string;
  online_order_items?: OnlineOrderItemRow[] | null;
};

@Injectable()
export class OrdersService {
  private readonly promosService: PromosService;
  private readonly supabaseService: SupabaseService;
  private readonly mailerService: MailerService;

  constructor(promosService: PromosService, supabaseService: SupabaseService, mailerService: MailerService) {
    this.promosService = promosService;
    this.supabaseService = supabaseService;
    this.mailerService = mailerService;
  }

  private get orderAdmin() {
    const client = this.supabaseService.getClientForService('ORDER');
    if (!client) throw new Error('Order Supabase client not configured. Set ORDER_SUPABASE_URL and ORDER_SUPABASE_SECRET_KEY in .env');
    return client;
  }

  private get cartAdmin() {
    return this.supabaseService.getClientForService('CART');
  }

  async search(orderNumber?: string, status?: string, limit = 20) {
    let query = this.orderAdmin
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
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('fulfillment_status', status);
    }

    if (orderNumber) {
      query = query.or(
        `receipt_number.ilike.%${orderNumber}%,order_number.ilike.%${orderNumber}%,tx_no.ilike.%${orderNumber}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return this.mapOnlineOrders((data ?? []) as OnlineOrderRow[]);
  }

  async listCustomerOrders(userId: string, limit = 50) {
    const { data, error } = await this.orderAdmin
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

    if (error) {
      throw error;
    }

    return this.mapOnlineOrders((data ?? []) as OnlineOrderRow[]);
  }

  async placeOrder(userId: string, body: any) {
    const items = Array.isArray(body?.items)
      ? (body.items as CheckoutItem[])
      : [];
    const shippingAddress =
      typeof body?.shippingAddress === 'string'
        ? body.shippingAddress.trim()
        : '';
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

    if (!shippingAddress)
      return { error: 'Shipping address is required', status: 400 };
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
          item.id &&
          item.name &&
          Number.isFinite(item.price) &&
          item.price >= 0,
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
      if (!product)
        return { error: `Product ${item.name} was not found`, status: 400 };

      const availableStock = Number(product.stock ?? 0);
      if (availableStock < item.quantity) {
        return {
          error: `${product.name} only has ${availableStock} item(s) left in stock.`,
          status: 409,
        };
      }
    }

    const { data: receiptRows, error: receiptError } =
      await this.orderAdmin.rpc('issue_next_receipt_number', {});

    if (receiptError) {
      throw receiptError;
    }

    const raw = Array.isArray(receiptRows) ? receiptRows[0] : receiptRows;

    let receiptId: number;
    let receiptNumber: string;

    if (raw && typeof raw === 'object') {
      receiptId = Number(raw.receipt_id ?? raw.id ?? 0);
      receiptNumber = String(raw.receipt_number ?? raw.number ?? raw.receiptNumber ?? '');
    } else {
      // Function returned just the receipt_number string — insert the row ourselves
      receiptNumber = String(raw ?? '');
      const { data: insertedReceipt, error: insertReceiptError } =
        await this.orderAdmin
          .from('receipts')
          .insert({ receipt_number: receiptNumber, issued_at: new Date().toISOString() })
          .select('receipt_id')
          .single();

      if (insertReceiptError) {
        // Function may have already inserted — fall back to lookup
        const { data: lookupRow } = await this.orderAdmin
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

    const subtotal = Number(
      normalizedItems
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2),
    );
    const vat = Number((subtotal * 0.12).toFixed(2));
    const normalizedPaymentMethod =
      this.normalizePaymentMethodForPos(paymentMethod);
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
      await this.orderAdmin
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
      await this.orderAdmin
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

    await this.cartAdmin
      ?.from('cart_items')
      .delete()
      .eq('customer_id', userId);

    // Send order confirmation email (fire-and-forget — never block checkout response)
    if (this.mailerService.isConfigured()) {
      void (async () => {
        try {
          const { data: customerRow } = await this.supabaseService.supabase
            .from('customers')
            .select('email, full_name')
            .eq('id', userId)
            .single();
          if (!customerRow?.email) return;
          await this.mailerService.sendOrderConfirmationEmail(
            customerRow.email,
            (customerRow.full_name as string) || 'Customer',
            {
              receiptNumber,
              items: normalizedItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
              subtotal,
              deliveryFee,
              discountAmount,
              total: totalAmount,
              paymentMethod,
              shippingAddress,
            },
          );
        } catch (err) {
          console.error('Order confirmation email error:', err);
        }
      })();
    }

    // Fetch the receipt_number directly from the receipts table using the FK on the transaction
    const { data: linkedReceipt } = await this.orderAdmin
      .from('receipts')
      .select('receipt_number')
      .eq('receipt_id', insertedTransaction.receipt_id)
      .single();

    const finalReceiptNumber =
      linkedReceipt?.receipt_number ?? receiptNumber;
    const orderNumberValue = `TXN-${String(insertedTransaction.tx_no ?? receiptId)}`;

    const { data: insertedOnlineOrder, error: onlineOrderError } =
      await this.orderAdmin
        .from('online_orders')
        .insert({
          customer_id: userId,
          receipt_id: receiptId,
          receipt_number: finalReceiptNumber,
          transaction_id: insertedTransaction.id,
          order_number: orderNumberValue,
          tx_no: String(insertedTransaction.tx_no ?? receiptId),
          branch_id: Number.isFinite(Number(body?.branchId))
            ? Number(body.branchId)
            : null,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          payment_status: 'paid',
          fulfillment_status: 'Processing',
          delivery_method:
            body?.deliveryMethod === 'claim_at_branch' ||
            body?.deliveryMethod === 'same_day' ||
            body?.deliveryMethod === 'scheduled'
              ? body.deliveryMethod
              : null,
          subtotal,
          delivery_fee: Number(deliveryFee.toFixed(2)),
          discount_amount: Number(discountAmount.toFixed(2)),
          total: totalAmount,
          promo_code: promoResult?.valid ? promoResult.promo.code : null,
          metadata: {
            source: 'web-checkout',
          },
        })
        .select('id')
        .single();

    if (onlineOrderError || !insertedOnlineOrder) {
      throw onlineOrderError;
    }

    const { error: onlineOrderItemsError } = await this.orderAdmin
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

    return {
      order: {
        id: finalReceiptNumber || insertedTransaction.id,
        orderNumber: orderNumberValue,
        txNo: String(insertedTransaction.tx_no ?? receiptId),
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
        receiptNumber: finalReceiptNumber,
      },
    };
  }

  async cancelOrder(receiptNumber: string) {
    const { data: receipt } = await this.orderAdmin
      .from('receipts')
      .select('receipt_id')
      .eq('receipt_number', receiptNumber)
      .single();

    if (!receipt?.receipt_id) {
      return { error: 'Order not found', status: 404 };
    }

    const { data: transaction, error: txError } = await this.orderAdmin
      .from('transactions')
      .select('id, status')
      .eq('receipt_id', receipt.receipt_id)
      .single();

    if (txError || !transaction) {
      return { error: 'Order not found', status: 404 };
    }

    if (!['paid', 'preparing'].includes(transaction.status)) {
      return { error: 'This order can no longer be cancelled', status: 400 };
    }

    const { error: updateError } = await this.orderAdmin
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('id', transaction.id);

    if (updateError) throw updateError;

    const { error: onlineOrderUpdateError } = await this.orderAdmin
      .from('online_orders')
      .update({ fulfillment_status: 'Cancelled' })
      .eq('receipt_number', receiptNumber);

    if (onlineOrderUpdateError) throw onlineOrderUpdateError;

    return { success: true, status: 'Cancelled' };
  }

  private mapOnlineOrders(rows: OnlineOrderRow[]) {
    return rows.map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number ?? undefined,
      orderNumber: row.order_number ?? undefined,
      txNo: row.tx_no ?? undefined,
      date: row.created_at,
      items: (row.online_order_items ?? []).map((item) => ({
        id: item.product_id,
        name: item.product_name,
        description: '',
        price: Number(item.unit_price ?? 0),
        category: item.category ?? 'Uncategorized',
        image: '',
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
}
