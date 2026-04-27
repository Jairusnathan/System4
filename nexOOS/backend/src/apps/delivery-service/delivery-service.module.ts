import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeliveryController } from '../../controllers/delivery.controller';
import { LocationsController } from '../../controllers/locations.controller';
import { DeliveryService } from '../../services/delivery.service';
import { LocationsService } from '../../services/locations.service';
import { SupabaseService } from '../../services/supabase.service';
import { DeliveryHealthController } from './delivery-health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [DeliveryController, LocationsController, DeliveryHealthController],
  providers: [DeliveryService, LocationsService, SupabaseService],
})
export class DeliveryServiceModule {}
