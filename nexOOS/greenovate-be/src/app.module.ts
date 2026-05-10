import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterSdkModule } from './api-center/api-center-sdk.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './common/config/env.validation.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { AnalyticsController } from './controllers/analytics.controller';
import { AuthController } from './controllers/auth.controller';
import { BranchesController } from './controllers/branches.controller';
import { CartController } from './controllers/cart.controller';
import { DeliveryController } from './controllers/delivery.controller';
import { LocationsController } from './controllers/locations.controller';
import { OrdersController } from './controllers/orders.controller';
import { ProductsController } from './controllers/products.controller';
import { PromosController } from './controllers/promos.controller';
import { HealthModule } from './health/health.module.js';
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
import { SupabaseModule } from './supabase/supabase.module.js';

const shouldValidateEnv = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      // Fail fast on production misconfiguration while keeping local DX flexible.
      ...(shouldValidateEnv ? { validate: validateEnv } : {}),
    }),
    SupabaseModule,
    HealthModule,
    ApiCenterSdkModule,
  ],
  controllers: [
    AppController,
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
    AppService,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
