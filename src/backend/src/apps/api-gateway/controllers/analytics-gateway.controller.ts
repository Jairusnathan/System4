import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('analytics')
export class AnalyticsGatewayController {
  @Post('search')
  async track(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.analytics,
      path: '/analytics/search',
      method: 'POST',
      body,
    });

    response.status(result.status);
    return result.data;
  }
}
