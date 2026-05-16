import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ProductsService } from './products.service';
import { AppAuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [CartController],
  providers: [AppAuthService, CartService, ProductsService, SupabaseService],
})
export class CartModule {}
