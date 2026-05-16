import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BranchesController } from './branches.controller';
import { ProductsController } from './products.controller';
import { BranchesService } from './branches.service';
import { ProductsService } from './products.service';
import { RecommendationsService } from './recommendations.service';
import { SupabaseService } from './supabase.service';
import { CatalogInternalController } from './controllers/catalog-internal.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [BranchesController, ProductsController, CatalogInternalController],
  providers: [BranchesService, ProductsService, RecommendationsService, SupabaseService],
})
export class CatalogModule {}