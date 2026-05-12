import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsController } from '../../controllers/analytics.controller';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsHealthController } from './analytics-health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['apps/analytics-service/.env'],
    }),
  ],
  controllers: [AnalyticsController, AnalyticsHealthController],
  providers: [AnalyticsService],
})
export class AnalyticsServiceModule {}
