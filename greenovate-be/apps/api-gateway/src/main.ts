import { loadEnvFiles } from '../../../src/shared/bootstrap/load-env-files';
import { bootstrapHttpApp } from '../../../src/shared/bootstrap/bootstrap-http-app';
import { ApiGatewayModule } from './api-gateway.module';

loadEnvFiles(['apps/api-gateway/.env']);

void bootstrapHttpApp(ApiGatewayModule, {
  port: Number(process.env.API_GATEWAY_PORT || process.env.PORT || 4000),
  globalPrefix: 'api',
  enableCors: true,
});
