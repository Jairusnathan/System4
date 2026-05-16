import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromosController } from './promos.controller';
import { PromoInternalController } from './promo-internal.controller';
import { PromosService } from './promos.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [PromosController, PromoInternalController],
  providers: [PromosService, SupabaseService],
})
export class PromoModule {}
