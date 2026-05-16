import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayExceptionFilter } from '../filters/service-unavailable.filter';
import { CorrelationIdMiddleware } from '../middleware/correlation-id.middleware';
import { AnalyticsGatewayController } from '../controllers/analytics-gateway.controller';
import { AuthGatewayController } from '../controllers/auth-gateway.controller';
import { BranchesGatewayController } from '../controllers/branches-gateway.controller';
import { CartGatewayController } from '../controllers/cart-gateway.controller';
import { DeliveryGatewayController } from '../controllers/delivery-gateway.controller';
import { GatewayHealthController } from '../controllers/gateway-health.controller';
import { LocationsGatewayController } from '../controllers/locations-gateway.controller';
import { OrdersGatewayController } from '../controllers/orders-gateway.controller';
import { ProductsGatewayController } from '../controllers/products-gateway.controller';
import { PromosGatewayController } from '../controllers/promos-gateway.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ['apps/api-gateway/.env'] }),
  ],
  providers: [{ provide: APP_FILTER, useClass: GatewayExceptionFilter }],
  controllers: [
    AnalyticsGatewayController,
    AuthGatewayController,
    BranchesGatewayController,
    CartGatewayController,
    DeliveryGatewayController,
    GatewayHealthController,
    LocationsGatewayController,
    OrdersGatewayController,
    ProductsGatewayController,
    PromosGatewayController,
  ],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

