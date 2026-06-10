import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeliveryController } from './delivery.controller';
import { LocationsController } from './locations.controller';
import { DeliveryService } from './delivery.service';
import { LocationsService } from './locations.service';
import { SupabaseService } from './supabase.service';
import { ApiCenterService } from './api-center.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [DeliveryController, LocationsController],
  providers: [DeliveryService, LocationsService, SupabaseService, ApiCenterService],
  exports: [ApiCenterService],
})
export class DeliveryModule {}
