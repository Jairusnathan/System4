import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('locations')
export class LocationsGatewayController {
  @Get()
  async getLocations(
    @Query('scope') scope: string | undefined,
    @Query('province') province: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (scope) {
      search.set('scope', scope);
    }
    if (province) {
      search.set('province', province);
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.delivery,
      path: `/locations${suffix}`,
    });

    response.status(result.status);
    return result.data;
  }
}
