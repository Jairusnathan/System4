import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';

@Controller('products')
export class ProductsGatewayController {
  @Get()
  async getProducts(
    @Query('branchId') branchId: string | undefined,
    @Query('minPrice') minPrice: string | undefined,
    @Query('maxPrice') maxPrice: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('inStockOnly') inStockOnly: string | undefined,
    @Query('q') q: string | undefined,
    @Query('category') category: string | string[] | undefined,
    @Query('sortBy') sortBy: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (branchId) search.set('branchId', branchId);
    if (minPrice) search.set('minPrice', minPrice);
    if (maxPrice) search.set('maxPrice', maxPrice);
    if (limit) search.set('limit', limit);
    if (inStockOnly) search.set('inStockOnly', inStockOnly);
    if (q) search.set('q', q);
    if (sortBy) search.set('sortBy', sortBy);

    const categories = Array.isArray(category) ? category : typeof category === 'string' ? [category] : [];
    for (const value of categories) {
      search.append('category', value);
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.catalog,
      path: `/products${suffix}`,
    });

    response.status(result.status);
    return result.data;
  }

  @Get('search')
  async searchProducts(
    @Query('q') q: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('category') category: string | undefined,
    @Query('minPrice') minPrice: string | undefined,
    @Query('maxPrice') maxPrice: string | undefined,
    @Query('inStockOnly') inStockOnly: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (branchId) search.set('branchId', branchId);
    if (limit) search.set('limit', limit);
    if (category) search.set('category', category);
    if (minPrice) search.set('minPrice', minPrice);
    if (maxPrice) search.set('maxPrice', maxPrice);
    if (inStockOnly) search.set('inStockOnly', inStockOnly);

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.catalog,
      path: `/products/search${suffix}`,
    });

    response.status(result.status);
    return result.data;
  }

  @Get('suggestions')
  async getSuggestions(
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (limit) search.set('limit', limit);

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.catalog,
      path: `/products/suggestions${suffix}`,
    });

    response.status(result.status);
    return result.data;
  }
}
