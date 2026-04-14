import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppAuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { OrderHealthController } from './order-health.controller';
import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [OrderServiceController, OrderHealthController],
  providers: [AppAuthService, OrderServiceService, SupabaseService],
})
export class OrderServiceModule {}
