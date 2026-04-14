import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('branches')
export class BranchesGatewayController {
  @Get()
  async getBranches(@Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.catalog,
      path: '/branches',
    });

    response.status(result.status);
    return result.data;
  }

  @Get(':id/inventory')
  async getInventory(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.catalog,
      path: `/branches/${encodeURIComponent(id)}/inventory`,
    });

    response.status(result.status);
    return result.data;
  }
}
