import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  InternalServerErrorException,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AppAuthService } from '../services/auth.service';
import { OrdersService } from '../services/orders.service';

const parseLimit = (value?: string) => {
  const parsed = Number(value ?? '20');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
};

const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

@Controller('orders')
export class OrdersController {
  private readonly authService: AppAuthService;
  private readonly ordersService: OrdersService;

  constructor(authService: AppAuthService, ordersService: OrdersService) {
    this.authService = authService;
    this.ordersService = ordersService;
  }

  @Get('search')
  async search(
    @Query('orderNumber') orderNumber?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.ordersService.search(
        orderNumber?.trim(),
        status?.trim(),
        parseLimit(limit),
      );

      return {
        data,
        meta: {
          total: data.length,
          orderNumber: orderNumber?.trim(),
          status: status?.trim(),
        },
      };
    } catch (error) {
      console.error('Order search API error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('place')
  async placeOrder(
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Body() body?: any,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);

      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) return cached.result;
        for (const [k, v] of idempotencyCache) {
          if (v.expiresAt <= Date.now()) idempotencyCache.delete(k);
        }
      }

      const result = await this.ordersService.placeOrder(userId, body);

      if ('error' in result) {
        throw new HttpException({ error: result.error }, result.status ?? 500);
      }

      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
      }

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      console.error('Place order error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('cancel')
  async cancelOrder(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
  ) {
    try {
      this.authService.requireUserId(authorization);
      const receiptNumber = typeof body?.receiptNumber === 'string' ? body.receiptNumber.trim() : '';
      if (!receiptNumber) throw new HttpException({ error: 'receiptNumber is required' }, 400);

      const result = await this.ordersService.cancelOrder(receiptNumber);
      if ('error' in result) throw new HttpException({ error: result.error }, Number(result.status ?? 400));
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) throw error;
      console.error('Cancel order error:', error);
      throw new InternalServerErrorException();
    }
  }
}
