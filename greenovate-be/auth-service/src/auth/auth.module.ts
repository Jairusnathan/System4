import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AppAuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { SupabaseService } from './supabase.service';
import { AnalyticsController } from '../analytics/analytics.controller';
import { AnalyticsService } from '../analytics/analytics.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [AuthController, AnalyticsController],
  providers: [AppAuthService, MailerService, SupabaseService, AnalyticsService],
})
export class AuthModule {}
