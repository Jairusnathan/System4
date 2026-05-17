import { Body, Controller, Get, Headers, HttpException, InternalServerErrorException, Post, Query, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { AppAuthService } from './auth.service';
import { OrderService } from './order.service';

const parseLimit = (value?: string) => { const parsed = Number(value ?? '20'); return Number.isFinite(parsed) && parsed > 0 ? parsed : 20; };
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

@Controller('orders')
export class OrderController {
  constructor(
    private readonly authService: AppAuthService,
    private readonly orderService: OrderService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('my')
  async getMyOrders(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      return { data: await this.orderService.listCustomerOrders(userId) };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Get('search')
  async search(@Query('orderNumber') orderNumber?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    try {
      const data = await this.orderService.search(orderNumber?.trim(), status?.trim(), parseLimit(limit));
      return { data, meta: { total: data.length } };
    } catch {
      throw new InternalServerErrorException();
    }
  }

  @Get('track')
  async trackOrder(@Query('receiptNumber') receiptNumber?: string) {
    if (!receiptNumber?.trim()) throw new HttpException({ error: 'receiptNumber is required' }, 400);
    try {
      const result = await this.orderService.getOrderStatus(receiptNumber.trim());
      if (!result) throw new HttpException({ error: 'Order not found' }, 404);
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('place')
  async placeOrder(@Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string, @Body() body?: unknown) {
    try {
      const user = this.authService.requireUser(authorization);
      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) return cached.result;
        for (const [k, v] of idempotencyCache) { if (v.expiresAt <= Date.now()) idempotencyCache.delete(k); }
      }
      const result = await this.orderService.placeOrder(user.userId, body, { email: user.email });
      if ('error' in result) throw new HttpException({ error: result.error }, result.status ?? 500);
      if (idempotencyKey) idempotencyCache.set(idempotencyKey, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('cancel')
  async cancelOrder(
    @Headers('authorization') authorization?: string,
    @Body() body?: { receiptNumber?: string; reason?: string },
  ) {
    try {
      const user = this.authService.requireUser(authorization);
      const receiptNumber = body?.receiptNumber?.trim();
      if (!receiptNumber) throw new HttpException({ error: 'receiptNumber is required' }, 400);
      const result = await this.orderService.cancelOrder(user.userId, receiptNumber, body?.reason, user.email);
      if (!result.success) throw new HttpException({ error: result.error ?? 'Failed to cancel order' }, result.error === 'Order not found' ? 404 : 400);
      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('internal/co-purchases')
  async getCoPurchases(@Body() body?: { productId?: string; limit?: number }) {
    try {
      const productId = String(body?.productId ?? '').trim();
      if (!productId) return { data: [] };

      const limit = Number(body?.limit ?? 4);

      // Step 1: find all orders that contain this product
      const { data: orderRows } = await this.supabaseService.supabaseAdmin
        .from('online_order_items')
        .select('online_order_id')
        .eq('product_id', productId);

      if (!orderRows?.length) return { data: [] };

      const orderIds = [...new Set((orderRows as { online_order_id: string }[]).map((r) => r.online_order_id))];

      // Step 2: find all OTHER products in those same orders
      const { data: coItems } = await this.supabaseService.supabaseAdmin
        .from('online_order_items')
        .select('product_id')
        .in('online_order_id', orderIds)
        .neq('product_id', productId);

      if (!coItems?.length) return { data: [] };

      // Step 3: count frequency and return top N
      const freq = new Map<string, number>();
      for (const row of coItems as { product_id: string }[]) {
        const id = String(row.product_id);
        freq.set(id, (freq.get(id) ?? 0) + 1);
      }

      const topIds = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      return { data: topIds };
    } catch {
      return { data: [] };
    }
  }

  @Post('internal/sold-counts')
  async getSoldCounts(@Body() body?: { productIds?: string[] }) {
    try {
      const productIds = Array.isArray(body?.productIds)
        ? body.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];

      if (productIds.length === 0) return { data: [] };

      const { data, error } = await this.supabaseService.supabaseAdmin
        .from('online_order_items')
        .select('product_id, quantity')
        .in('product_id', productIds);

      if (error) return { data: [] };

      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { product_id: string; quantity: number }[]) {
        const id = String(row.product_id ?? '').trim();
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + Number(row.quantity ?? 0));
      }

      return {
        data: [...counts.entries()].map(([product_id, sold]) => ({ product_id, sold })),
      };
    } catch {
      return { data: [] };
    }
  }
}
