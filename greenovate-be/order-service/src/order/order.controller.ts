import { Body, Controller, Get, Headers, HttpException, InternalServerErrorException, Post, Query, UnauthorizedException } from '@nestjs/common';
import { AppAuthService } from './auth.service';
import { OrderService } from './order.service';

const parseLimit = (value?: string) => { const parsed = Number(value ?? '20'); return Number.isFinite(parsed) && parsed > 0 ? parsed : 20; };
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

@Controller('orders')
export class OrderController {
  constructor(private readonly authService: AppAuthService, private readonly orderService: OrderService) {}

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
    } catch (error) { throw new InternalServerErrorException(); }
  }

  @Get('track')
  async trackOrder(@Query('receiptNumber') receiptNumber?: string) {
    if (!receiptNumber?.trim()) throw new HttpException({ error: 'receiptNumber is required' }, 400);
    try {
      const result = await this.orderService.getOrderStatus(receiptNumber.trim());
      if (!result) throw new HttpException({ error: 'Order not found' }, 404);
      return result;
    } catch (error) { if (error instanceof HttpException) throw error; throw new InternalServerErrorException(); }
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
}
