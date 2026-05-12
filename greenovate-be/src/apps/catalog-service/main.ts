import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { CatalogServiceModule } from './catalog-service.module';

loadEnvFiles(['apps/catalog-service/.env']);

void bootstrapHttpApp(CatalogServiceModule, {
  port: Number(process.env.CATALOG_SERVICE_PORT || 4102),
});
