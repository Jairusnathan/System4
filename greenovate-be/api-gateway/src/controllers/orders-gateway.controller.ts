import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SERVICE_URLS } from '../shared/http/service-urls';
import { requestDownstream } from '../shared/http/request-downstream';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Controller('orders')
export class OrdersGatewayController {
  @Get('my')
  async getMyOrders(
    @Headers('authorization') authorization: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/my',
      headers: {
        authorization,
        [CORRELATION_ID_HEADER]: correlationId,
      },
    });

    response.status(result.status);
    return result.data;
  }

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

  @Get('my-return-requests')
  async getMyReturnRequests(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/my-return-requests',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Post('return-request')
  async submitReturnRequest(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/return-request',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Post('cancel')
  async cancelOrder(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/cancel',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/all')
  async adminGetAllOrders(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/admin/all${suffix}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Patch('admin/status')
  async adminUpdateOrderStatus(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/admin/status',
      method: 'PATCH',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/stats')
  async adminGetOrderStats(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/admin/stats',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/returns')
  async adminGetAllReturns(
    @Headers('authorization') authorization: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/admin/returns${suffix}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Patch('admin/returns/:id')
  async adminUpdateReturnStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/admin/returns/${encodeURIComponent(id)}`,
      method: 'PATCH',
      headers: { authorization },
      body,
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
      timeoutMs: 30_000,
    });

    response.status(result.status);
    return result.data;
  }

  // ─── Payment endpoints ────────────────────────────────────────────────────

  @Post('payment/initiate')
  async initiatePayment(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/payment/initiate',
      method: 'POST',
      headers: {
        authorization,
        'idempotency-key': idempotencyKey,
        [CORRELATION_ID_HEADER]: correlationId,
      },
      body,
      timeoutMs: 30_000,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('payment/status')
  async getPaymentStatus(
    @Query('receipt') receipt: string | undefined,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const suffix = receipt ? `?receipt=${encodeURIComponent(receipt)}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: `/orders/payment/status${suffix}`,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
    response.status(result.status);
    return result.data;
  }

  @Post('payment/cancel')
  async cancelPendingPayment(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.orders,
      path: '/orders/payment/cancel',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }
}
