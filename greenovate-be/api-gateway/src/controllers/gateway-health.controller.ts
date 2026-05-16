import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class GatewayHealthController {
  @Get()
  getHealth() {
    return { service: 'api-gateway', status: 'ok', port: process.env.API_GATEWAY_PORT || 4000 };
  }
}
