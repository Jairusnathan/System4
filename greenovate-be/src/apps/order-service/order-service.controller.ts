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
import { AppAuthService } from '../../services/auth.service';
import { OrderServiceService } from './order-service.service';

const parseLimit = (value?: string) => {
  const parsed = Number(value ?? '20');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
};

// In-memory idempotency cache: key → cached result, expires after 10 minutes
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

@Controller('orders')
export class OrderServiceController {
  constructor(
    private readonly authService: AppAuthService,
    private readonly orderService: OrderServiceService,
  ) {}

  @Get('my')
  async getMyOrders(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const data = await this.orderService.listCustomerOrders(userId);
      return { data };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) {
        throw error;
      }
      console.error('Get my orders error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('search')
  async search(
    @Query('orderNumber') orderNumber?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.orderService.search(
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

  @Get('track')
  async trackOrder(@Query('receiptNumber') receiptNumber?: string) {
    if (!receiptNumber?.trim()) {
      throw new HttpException({ error: 'receiptNumber is required' }, 400);
    }
    try {
      const result = await this.orderService.getOrderStatus(receiptNumber.trim());
      if (!result) {
        throw new HttpException({ error: 'Order not found' }, 404);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Track order error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('place')
  async placeOrder(
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Body() body?: unknown,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      if (correlationId) console.log(`[order-service] place-order correlationId=${correlationId}`);

      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.result;
        }
        // Evict expired entries periodically
        for (const [k, v] of idempotencyCache) {
          if (v.expiresAt <= Date.now()) idempotencyCache.delete(k);
        }
      }

      const result = await this.orderService.placeOrder(userId, body);

      if ('error' in result) {
        throw new HttpException({ error: result.error }, result.status ?? 500);
      }

      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          result,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }

      return result;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof HttpException
      ) {
        throw error;
      }

      console.error('Place order error:', error);
      throw new InternalServerErrorException();
    }
  }
}
