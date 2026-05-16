import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [HealthModule, GatewayModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
