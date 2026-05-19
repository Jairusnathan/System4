import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'cart-service', status: 'ok', port: process.env.OOS_CART_PORT || 3004 };
  }
}
