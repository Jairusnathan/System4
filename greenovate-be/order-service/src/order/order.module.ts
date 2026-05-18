import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AppAuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { SupabaseService } from './supabase.service';
import { ApiCenterService } from './api-center.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [OrderController],
  providers: [AppAuthService, OrderService, MailerService, SupabaseService, ApiCenterService],
})
export class OrderModule {}
