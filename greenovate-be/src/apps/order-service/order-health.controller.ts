import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class OrderHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('order-service');
  }
}
