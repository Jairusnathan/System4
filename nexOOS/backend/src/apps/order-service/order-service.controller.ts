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

@Controller('orders')
export class OrderServiceController {
  constructor(
    private readonly authService: AppAuthService,
    private readonly orderService: OrderServiceService,
  ) {}

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

  @Post('place')
  async placeOrder(
    @Headers('authorization') authorization?: string,
    @Body() body?: unknown,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const result = await this.orderService.placeOrder(userId, body);

      if ('error' in result) {
        throw new HttpException({ error: result.error }, result.status ?? 500);
      }

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof HttpException) {
        throw error;
      }

      console.error('Place order error:', error);
      throw new InternalServerErrorException();
    }
  }
}
