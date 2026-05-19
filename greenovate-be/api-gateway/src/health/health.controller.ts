import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'api-gateway', status: 'ok', port: process.env.OOS_GATEWAY_PORT || 3001 };
  }
}
