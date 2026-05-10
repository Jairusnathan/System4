import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class AuthHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('auth-service');
  }
}
