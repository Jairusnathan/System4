import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [HealthModule, DeliveryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
