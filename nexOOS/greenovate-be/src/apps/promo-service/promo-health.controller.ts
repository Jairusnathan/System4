import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class PromoHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('promo-service');
  }
}
