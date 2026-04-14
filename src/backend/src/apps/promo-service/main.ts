import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { PromoServiceModule } from './promo-service.module';

void bootstrapHttpApp(PromoServiceModule, {
  port: SERVICE_PORTS.promo,
});
