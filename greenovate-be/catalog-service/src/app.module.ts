import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [HealthModule, CatalogModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
