import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [HealthModule, OrderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
