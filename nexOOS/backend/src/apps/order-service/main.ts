import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { OrderServiceModule } from './order-service.module';

void bootstrapHttpApp(OrderServiceModule, {
  port: SERVICE_PORTS.orders,
});
