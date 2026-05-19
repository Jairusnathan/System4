import { Body, Controller, Get, Headers, HttpException, InternalServerErrorException, Logger, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import { AppAuthService } from './auth.service';
import { OrderService } from './order.service';

const parseLimit = (value?: string) => { const parsed = Number(value ?? '20'); return Number.isFinite(parsed) && parsed > 0 ? parsed : 20; };
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly authService: AppAuthService,
    private readonly orderService: OrderService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
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

  @Get('my-return-requests')
  async getMyReturnRequests(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const { data, error } = await this.supabaseService.supabaseAdmin
        .from('return_requests')
        .select('id, receipt_number, reason, description, items, status, created_at')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });
      if (error) return { data: [] };
      return { data: data ?? [] };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { data: [] };
    }
  }

  @Post('return-request')
  async submitReturnRequest(
    @Headers('authorization') authorization?: string,
    @Body() body?: {
      receiptNumber?: string;
      reason?: string;
      description?: string;
      items?: Array<{ productId: string; name: string; quantity: number }>;
    },
  ) {
    try {
      const user = this.authService.requireUser(authorization);
      const receiptNumber = body?.receiptNumber?.trim();
      const reason = body?.reason?.trim();
      if (!receiptNumber) throw new HttpException({ error: 'receiptNumber is required' }, 400);
      if (!reason) throw new HttpException({ error: 'reason is required' }, 400);
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        throw new HttpException({ error: 'At least one item must be selected' }, 400);
      }
      const result = await this.orderService.submitReturnRequest(
        user.userId, user.email, receiptNumber, reason, body?.description, body.items,
      );
      if (!result.success) {
        throw new HttpException({ error: result.error ?? 'Failed to submit return request' }, 400);
      }
      return { success: true };
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

  private requireAdminToken(authorization?: string) {
    const token = this.authService.extractBearerToken(authorization);
    const decoded = token ? this.authService.verifyAccessToken(token) : null;
    if (!decoded?.userId || !(decoded as any).isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }
    return decoded;
  }

  // ─── Admin: All Orders ───────────────────────────────────────────────────────

  @Get('admin/all')
  async adminGetAllOrders(
    @Headers('authorization') authorization?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.requireAdminToken(authorization);
    try {
      const data = await this.orderService.adminListAllOrders(
        status?.trim(),
        search?.trim(),
        Math.min(Number(limit ?? 50), 100),
        Number(offset ?? 0),
      );
      return data;
    } catch {
      throw new InternalServerErrorException();
    }
  }

  @Patch('admin/status')
  async adminUpdateOrderStatus(
    @Headers('authorization') authorization?: string,
    @Body() body?: { receiptNumber?: string; status?: string; reason?: string },
  ) {
    this.requireAdminToken(authorization);
    const receiptNumber = body?.receiptNumber?.trim();
    const newStatus = body?.status?.trim();
    if (!receiptNumber) throw new HttpException({ error: 'receiptNumber is required' }, 400);
    if (!['Processing', 'In Transit', 'Delivered', 'Cancelled'].includes(newStatus ?? '')) {
      throw new HttpException({ error: 'Invalid status value' }, 400);
    }
    try {
      const result = await this.orderService.adminUpdateOrderStatus(receiptNumber, newStatus!, body?.reason);
      if (!result.success) throw new HttpException({ error: result.error ?? 'Failed to update order' }, 400);
      return {
        success: true,
        receiptNumber: result.receiptNumber,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        reason: body?.reason?.trim() || null,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Get('admin/stats')
  async adminGetOrderStats(@Headers('authorization') authorization?: string) {
    this.requireAdminToken(authorization);
    try {
      return await this.orderService.adminGetStats();
    } catch {
      throw new InternalServerErrorException();
    }
  }

  // ─── Admin: Return Requests ──────────────────────────────────────────────────

  @Get('admin/returns')
  async adminGetAllReturns(
    @Headers('authorization') authorization?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.requireAdminToken(authorization);
    try {
      const pageLimit = Math.min(Number(limit ?? 50), 100);
      const pageOffset = Number(offset ?? 0);
      let query = this.supabaseService.supabaseAdmin
        .from('return_requests')
        .select('id, receipt_number, customer_id, reason, description, items, status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (status?.trim()) query = (query as any).eq('status', status.trim());
      query = (query as any).range(pageOffset, pageOffset + pageLimit - 1);
      const { data: rows, error: err, count } = await query;
      if (err) return { data: [], total: 0 };
      return { data: rows ?? [], total: count ?? 0 };
    } catch {
      throw new InternalServerErrorException();
    }
  }

  @Patch('admin/returns/:id')
  async adminUpdateReturnStatus(
    @Headers('authorization') authorization?: string,
    @Param('id') id?: string,
    @Body() body?: { status?: string; adminNote?: string },
  ) {
    this.requireAdminToken(authorization);
    const newStatus = body?.status?.trim();
    if (!['approved', 'rejected', 'reviewing', 'resolved'].includes(newStatus ?? '')) {
      throw new HttpException({ error: 'Invalid status. Use: approved, rejected, reviewing, resolved' }, 400);
    }
    try {
      const { data: currentReturn, error: fetchError } = await this.supabaseService.supabaseAdmin
        .from('return_requests')
        .select('id, receipt_number, status')
        .eq('id', id ?? '')
        .single();
      if (fetchError || !currentReturn) throw new HttpException({ error: 'Return request not found' }, 404);
      const previousStatus = String(currentReturn.status ?? '');
      const updateData: Record<string, unknown> = { status: newStatus };
      if (body?.adminNote?.trim()) updateData.admin_note = body.adminNote.trim();
      const { error } = await this.supabaseService.supabaseAdmin
        .from('return_requests')
        .update(updateData)
        .eq('id', id ?? '');
      if (error) throw new HttpException({ error: 'Failed to update return request' }, 400);
      return {
        success: true,
        id: currentReturn.id,
        receiptNumber: currentReturn.receipt_number,
        previousStatus,
        newStatus,
        adminNote: body?.adminNote?.trim() || null,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('internal/co-purchases')
  async getCoPurchases(@Body() body?: { productId?: string; limit?: number }) {
    try {
      const productId = String(body?.productId ?? '').trim();
      if (!productId) return { data: [] };
      const limit = Number(body?.limit ?? 4);

      // Fetch all order items — needed to build the full transaction set for Apriori
      const { data: allItems } = await this.supabaseService.supabaseAdmin
        .from('online_order_items')
        .select('online_order_id, product_id');
      if (!allItems?.length) return { data: [] };

      // Build transactions: Map<orderId, Set<productId>>
      const orderMap = new Map<string, Set<string>>();
      for (const row of allItems as { online_order_id: string; product_id: string }[]) {
        const oid = String(row.online_order_id);
        if (!orderMap.has(oid)) orderMap.set(oid, new Set());
        orderMap.get(oid)!.add(String(row.product_id));
      }
      const transactions = [...orderMap.values()].map(s => [...s]);
      const N = transactions.length;
      if (N === 0) return { data: [] };

      // ── Apriori algorithm ────────────────────────────────────────────────────
      // min_support scales with dataset size: at least 5% or min 2 absolute occurrences
      const minSupport = Math.max(2 / N, 0.05);
      const minConfidence = 0.3;

      // Count itemset occurrences
      const txSets = transactions.map(t => new Set(t));
      const countItemset = (items: string[]) =>
        txSets.filter(tx => items.every(i => tx.has(i))).length;

      // Level 1: frequent single items
      const itemCounts = new Map<string, number>();
      for (const tx of transactions) for (const item of new Set(tx))
        itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);

      const minCount = Math.ceil(minSupport * N);
      type FI = { items: string[]; support: number; count: number };
      const frequentItemsets: FI[] = [];
      let currentLevel: string[][] = [];

      for (const [item, cnt] of itemCounts) {
        if (cnt >= minCount) {
          currentLevel.push([item]);
          frequentItemsets.push({ items: [item], support: cnt / N, count: cnt });
        }
      }
      currentLevel.sort((a, b) => a[0].localeCompare(b[0]));

      // Levels k = 2..3 (3-itemsets are enough for product recommendations)
      for (let k = 2; k <= 3 && currentLevel.length >= 2; k++) {
        const nextLevel: string[][] = [];
        for (let i = 0; i < currentLevel.length; i++) {
          for (let j = i + 1; j < currentLevel.length; j++) {
            const a = currentLevel[i], b = currentLevel[j];
            let match = true;
            for (let x = 0; x < k - 2; x++) { if (a[x] !== b[x]) { match = false; break; } }
            if (match && a[k - 2] < b[k - 2]) {
              const c = [...a, b[k - 2]];
              const cnt = countItemset(c);
              if (cnt >= minCount) {
                nextLevel.push(c);
                frequentItemsets.push({ items: c, support: cnt / N, count: cnt });
              }
            }
          }
        }
        currentLevel = nextLevel;
      }

      // ── Generate association rules and filter for productId in antecedent ────
      const supportMap = new Map<string, number>();
      for (const fi of frequentItemsets)
        supportMap.set([...fi.items].sort().join('||'), fi.support);
      const getSupport = (items: string[]) => supportMap.get([...items].sort().join('||')) ?? 0;

      const properSubsets = (arr: string[]): string[][] => {
        const subs: string[][] = [];
        for (let mask = 1; mask < (1 << arr.length) - 1; mask++) {
          const sub: string[] = [];
          for (let i = 0; i < arr.length; i++) if (mask & (1 << i)) sub.push(arr[i]);
          subs.push(sub);
        }
        return subs;
      };

      const recommendations: { id: string; lift: number; confidence: number }[] = [];
      const seen = new Set<string>();

      for (const { items, support: supAB } of frequentItemsets) {
        if (items.length < 2 || !items.includes(productId)) continue;
        for (const ant of properSubsets(items)) {
          if (!ant.includes(productId)) continue;
          const con = items.filter(x => !ant.includes(x));
          if (con.length !== 1) continue; // only single-product recommendations
          const [recId] = con;
          if (seen.has(recId)) continue;
          const supA = getSupport(ant), supB = getSupport(con);
          if (supA === 0 || supB === 0) continue;
          const confidence = supAB / supA;
          if (confidence < minConfidence) continue;
          const lift = confidence / supB;
          if (lift <= 1) continue;
          seen.add(recId);
          recommendations.push({ id: recId, lift, confidence });
        }
      }

      recommendations.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);
      return { data: recommendations.slice(0, limit).map(r => r.id) };
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

  // ─── Payment ─────────────────────────────────────────────────────────────────

  @Post('payment/initiate')
  async initiatePayment(
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Body() body?: unknown,
  ) {
    try {
      const user = this.authService.requireUser(authorization);

      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) return cached.result;
        for (const [k, v] of idempotencyCache) { if (v.expiresAt <= Date.now()) idempotencyCache.delete(k); }
      }

      const appBaseUrl = this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3000';
      const result = await this.orderService.initiateOnlinePayment(user.userId, body, { email: user.email }, appBaseUrl);

      if ('error' in result) throw new HttpException({ error: result.error }, result.status ?? 500);

      if (idempotencyKey) idempotencyCache.set(idempotencyKey, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      const message = (() => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'object' && error !== null) {
          const e = error as Record<string, unknown>;
          return String(e.message ?? e.error ?? e.code ?? JSON.stringify(error));
        }
        return String(error);
      })();
      this.logger.error(`[payment/initiate] ${message}`, JSON.stringify(error));
      throw new HttpException({ error: message }, 500);
    }
  }

  @Get('payment/status')
  async getPaymentStatus(@Query('receipt') receipt?: string) {
    const receiptNumber = receipt?.trim();
    if (!receiptNumber) throw new HttpException({ error: 'receipt query param is required' }, 400);
    try {
      return await this.orderService.getPaymentStatus(receiptNumber);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }

  @Post('payment/cancel')
  async cancelPendingPayment(
    @Headers('authorization') authorization?: string,
    @Body() body?: { receiptNumber?: string },
  ) {
    try {
      const user = this.authService.requireUser(authorization);
      const receiptNumber = body?.receiptNumber?.trim();
      if (!receiptNumber) throw new HttpException({ error: 'receiptNumber is required' }, 400);
      const result = await this.orderService.cancelPendingPayment(user.userId, receiptNumber);
      if (!result.success) throw new HttpException({ error: result.error ?? 'Failed to cancel order' }, 400);
      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      throw new InternalServerErrorException();
    }
  }
}
