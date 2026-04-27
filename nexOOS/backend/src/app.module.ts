import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsController } from './controllers/analytics.controller';
import { AuthController } from './controllers/auth.controller';
import { BranchesController } from './controllers/branches.controller';
import { CartController } from './controllers/cart.controller';
import { DeliveryController } from './controllers/delivery.controller';
import { LocationsController } from './controllers/locations.controller';
import { OrdersController } from './controllers/orders.controller';
import { ProductsController } from './controllers/products.controller';
import { PromosController } from './controllers/promos.controller';
import { AnalyticsService } from './services/analytics.service';
import { AppAuthService } from './services/auth.service';
import { BranchesService } from './services/branches.service';
import { CartService } from './services/cart.service';
import { DeliveryService } from './services/delivery.service';
import { LocationsService } from './services/locations.service';
import { MailerService } from './services/mailer.service';
import { OrdersService } from './services/orders.service';
import { ProductsService } from './services/products.service';
import { PromosService } from './services/promos.service';
import { SupabaseService } from './services/supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AnalyticsController,
    AuthController,
    BranchesController,
    CartController,
    DeliveryController,
    LocationsController,
    OrdersController,
    ProductsController,
    PromosController,
  ],
  providers: [
    AnalyticsService,
    AppAuthService,
    BranchesService,
    CartService,
    DeliveryService,
    LocationsService,
    MailerService,
    OrdersService,
    ProductsService,
    PromosService,
    SupabaseService,
  ],
})
export class AppModule {}
