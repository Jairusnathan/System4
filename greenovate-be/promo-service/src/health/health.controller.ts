import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'promo-service', status: 'ok', port: process.env.PROMO_SERVICE_PORT || 4106 };
  }
}
