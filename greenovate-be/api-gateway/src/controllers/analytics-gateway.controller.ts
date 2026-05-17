import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SERVICE_URLS } from '../shared/http/service-urls';
import { requestDownstream } from '../shared/http/request-downstream';

@Controller('analytics')
export class AnalyticsGatewayController {
  @Post('search')
  async track(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/analytics/search',
      method: 'POST',
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('trending')
  async trending(
    @Query('limit') limit: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: limit ? `/analytics/trending?limit=${limit}` : '/analytics/trending',
      method: 'GET',
    });
    response.status(result.status);
    return result.data;
  }
}
