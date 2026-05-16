import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'analytics-service', status: 'ok', port: process.env.ANALYTICS_SERVICE_PORT || 4107 };
  }
}
