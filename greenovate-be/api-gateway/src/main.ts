import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key', 'x-correlation-id', 'Cookie'],
  });
  app.setGlobalPrefix('api');
  const port = process.env.OOS_GATEWAY_PORT || process.env.PORT || 3001;
  await app.listen(port);
  console.log(`api-gateway running on port ${port}`);
}
bootstrap();
