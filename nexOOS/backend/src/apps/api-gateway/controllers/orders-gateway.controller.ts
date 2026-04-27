import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('orders')
export class OrdersGatewayController {
  @Get('search')
  async search(
    @Query('orderNumber') orderNumber: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (orderNumber) {
      search.set('orderNumber', orderNumber);
    }
    if (status) {
      search.set('status', status);
    }
    if (limit) {
      search.set('limit', limit);
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/search${suffix}`,
    });

    response.status(result.status);
    return result.data;
  }

  @Post('place')
  async placeOrder(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/place',
      method: 'POST',
      headers: { authorization },
      body,
    });

    response.status(result.status);
    return result.data;
  }
}
