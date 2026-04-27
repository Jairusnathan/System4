import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppAuthService } from '../../services/auth.service';
import { CartServiceController } from './cart-service.controller';
import { CartHealthController } from './cart-health.controller';
import { CartServiceService } from './cart-service.service';
import { SupabaseService } from '../../services/supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CartServiceController, CartHealthController],
  providers: [AppAuthService, CartServiceService, SupabaseService],
})
export class CartServiceModule {}
