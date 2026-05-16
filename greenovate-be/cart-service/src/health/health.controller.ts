import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'cart-service', status: 'ok', port: process.env.CART_SERVICE_PORT || 4102 };
  }
}
