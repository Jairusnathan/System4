import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { SERVICE_PORTS } from '../../shared/http/service-urls';
import { AnalyticsServiceModule } from './analytics-service.module';

loadEnvFiles(['apps/analytics-service/.env']);

void bootstrapHttpApp(AnalyticsServiceModule, {
  port: SERVICE_PORTS.analytics,
});
