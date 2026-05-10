import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BranchesController } from '../../controllers/branches.controller';
import { ProductsController } from '../../controllers/products.controller';
import { BranchesService } from '../../services/branches.service';
import { ProductsService } from '../../services/products.service';
import { SupabaseService } from '../../services/supabase.service';
import { CatalogHealthController } from './catalog-health.controller';
import { CatalogInternalController } from './controllers/catalog-internal.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    BranchesController,
    ProductsController,
    CatalogInternalController,
    CatalogHealthController,
  ],
  providers: [BranchesService, ProductsService, SupabaseService],
})
export class CatalogServiceModule {}
