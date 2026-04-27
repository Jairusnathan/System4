import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromosController } from '../../controllers/promos.controller';
import { PromosService } from '../../services/promos.service';
import { SupabaseService } from '../../services/supabase.service';
import { PromoHealthController } from './promo-health.controller';
import { PromoInternalController } from './promo-internal.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [PromosController, PromoInternalController, PromoHealthController],
  providers: [PromosService, SupabaseService],
})
export class PromoServiceModule {}
