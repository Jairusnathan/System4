import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class CartHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('cart-service');
  }
}
