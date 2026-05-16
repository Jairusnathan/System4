import { BadRequestException, Controller, Get, InternalServerErrorException, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { RecommendationsService } from './recommendations.service';

const parseNumber = (value?: string) => { if (!value) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  async getProducts(@Query('branchId') branchId?: string, @Query('minPrice') minPrice?: string, @Query('maxPrice') maxPrice?: string, @Query('limit') limit?: string, @Query('inStockOnly') inStockOnly?: string, @Query('q') q?: string, @Query('category') category?: string | string[], @Query('sortBy') sortByParam?: string) {
    try {
      const categories = Array.isArray(category) ? category.map((v) => v.trim()).filter(Boolean) : [];
      const singleCategory = typeof category === 'string' ? category.trim() || undefined : undefined;
      const sortBy = sortByParam === 'price-asc' || sortByParam === 'price-desc' ? sortByParam : 'popularity';
      const data = await this.productsService.queryProducts({ q: q?.trim() || undefined, category: singleCategory, categories, minPrice: parseNumber(minPrice), maxPrice: parseNumber(maxPrice), branchId: parseNumber(branchId), inStockOnly: inStockOnly === 'true', limit: parseNumber(limit), sortBy });
      return { data, meta: { total: data.length } };
    } catch (error) { console.error('Products API error:', error); throw new InternalServerErrorException(); }
  }

  @Get('search')
  async searchProducts(@Query('q') q?: string, @Query('limit') limit?: string, @Query('category') category?: string) {
    try {
      const trimmedQuery = q?.trim();
      if (!trimmedQuery) throw new BadRequestException('Search query is required');
      const data = await this.productsService.queryProducts({ q: trimmedQuery, category: category?.trim() || undefined, limit: parseNumber(limit) });
      return { data, meta: { total: data.length, q: trimmedQuery } };
    } catch (error) { if (error instanceof BadRequestException) throw error; throw new InternalServerErrorException(); }
  }

  @Get('suggestions')
  async getSuggestions(@Query('q') q?: string, @Query('limit') limit?: string) {
    try {
      const trimmedQuery = q?.trim();
      if (!trimmedQuery) return { data: [] };
      const data = await this.productsService.queryProducts({ q: trimmedQuery, limit: parseNumber(limit) || 8 });
      return { data: data.map((p) => ({ id: p.id, name: p.name, category: p.category })) };
    } catch (error) { throw new InternalServerErrorException(); }
  }

  @Get(':id/recommendations')
  async getRecommendations(@Param('id') id: string, @Query('limit') limit?: string) {
    try {
      const data = await this.recommendationsService.getRecommendations(id, parseNumber(limit) ?? 4);
      return { data };
    } catch (error) { throw new InternalServerErrorException(); }
  }
}
