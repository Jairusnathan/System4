import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'catalog-service', status: 'ok', port: process.env.CATALOG_SERVICE_PORT || 4103 };
  }
}
