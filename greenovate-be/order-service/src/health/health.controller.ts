import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'order-service', status: 'ok', port: process.env.OOS_ORDER_PORT || 3003 };
  }
}
