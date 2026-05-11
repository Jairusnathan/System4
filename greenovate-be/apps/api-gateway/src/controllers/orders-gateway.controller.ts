import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SERVICE_URLS } from '../../../../src/shared/http/service-urls';
import { requestDownstream } from '../../../../src/shared/http/request-downstream';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Controller('orders')
export class OrdersGatewayController {
  @Get('search')
  async search(
    @Query('orderNumber') orderNumber: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (orderNumber) search.set('orderNumber', orderNumber);
    if (status) search.set('status', status);
    if (limit) search.set('limit', limit);

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/search${suffix}`,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });

    response.status(result.status);
    return result.data;
  }

  @Get('track')
  async trackOrder(
    @Query('receiptNumber') receiptNumber: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: receiptNumber
        ? `/orders/track?receiptNumber=${encodeURIComponent(receiptNumber)}`
        : '/orders/track',
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
    response.status(result.status);
    return result.data;
  }

  @Post('place')
  async placeOrder(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/place',
      method: 'POST',
      headers: {
        authorization,
        'idempotency-key': idempotencyKey,
        [CORRELATION_ID_HEADER]: correlationId,
      },
      body,
    });

    response.status(result.status);
    return result.data;
  }
}
