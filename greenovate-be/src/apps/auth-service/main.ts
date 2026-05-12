import { loadEnvFiles } from '../../shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../shared/bootstrap/bootstrap-http-app';
import { AuthServiceModule } from './auth-service.module';

loadEnvFiles(['apps/auth-service/.env']);

void bootstrapHttpApp(AuthServiceModule, {
  port: Number(process.env.AUTH_SERVICE_PORT || 4101),
});
