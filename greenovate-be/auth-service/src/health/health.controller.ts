import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { service: 'auth-service', status: 'ok', port: process.env.OOS_AUTH_PORT || 3002 };
  }
}
