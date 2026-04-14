import { Controller, Get } from '@nestjs/common';
import { createHealthPayload } from '../../shared/health';

@Controller('health')
export class CatalogHealthController {
  @Get()
  getHealth() {
    return createHealthPayload('catalog-service');
  }
}
