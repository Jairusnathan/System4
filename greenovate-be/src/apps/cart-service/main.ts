import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { CartServiceModule } from './cart-service.module';

loadEnvFiles(['apps/cart-service/.env']);

void bootstrapHttpApp(CartServiceModule, {
  port: SERVICE_PORTS.cart,
});
