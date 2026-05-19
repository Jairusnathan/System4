import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'promo-service', status: 'ok', port: process.env.OOS_PROMO_PORT || 3006 };
  }
}
