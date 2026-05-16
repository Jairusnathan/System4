import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'order-service', status: 'ok', port: process.env.ORDER_SERVICE_PORT || 4104 };
  }
}
