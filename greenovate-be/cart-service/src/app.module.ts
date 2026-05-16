import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { CartModule } from './cart/cart.module';

@Module({
  imports: [HealthModule, CartModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
