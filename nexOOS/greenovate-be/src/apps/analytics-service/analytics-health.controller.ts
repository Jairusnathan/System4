import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class AnalyticsHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('analytics-service');
  }
}
