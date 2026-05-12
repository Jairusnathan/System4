import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { DeliveryServiceModule } from './delivery-service.module';

loadEnvFiles(['apps/delivery-service/.env']);

void bootstrapHttpApp(DeliveryServiceModule, {
  port: SERVICE_PORTS.delivery,
});
