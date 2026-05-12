import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { OrderServiceModule } from './order-service.module';

loadEnvFiles(['apps/order-service/.env']);

void bootstrapHttpApp(OrderServiceModule, {
  port: Number(process.env.ORDER_SERVICE_PORT || 4105),
});
