import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class DeliveryHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('delivery-service');
  }
}
