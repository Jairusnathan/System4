import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PromoModule } from './promo/promo.module';

@Module({
  imports: [HealthModule, PromoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
