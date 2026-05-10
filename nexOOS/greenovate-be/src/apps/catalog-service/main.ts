import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { CatalogServiceModule } from './catalog-service.module';

void bootstrapHttpApp(CatalogServiceModule, {
  port: SERVICE_PORTS.catalog,
});
