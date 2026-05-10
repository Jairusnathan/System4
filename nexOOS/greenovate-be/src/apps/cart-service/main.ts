import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { CartServiceModule } from './cart-service.module';

void bootstrapHttpApp(CartServiceModule, {
  port: SERVICE_PORTS.cart,
});
