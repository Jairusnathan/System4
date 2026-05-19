import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'delivery-service', status: 'ok', port: process.env.OOS_DELIVERY_PORT || 3007 };
  }
}
