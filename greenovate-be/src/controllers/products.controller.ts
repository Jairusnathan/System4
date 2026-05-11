import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';
import { ProductsService } from '../services/products.service';

const parseNumber = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

@Controller('products')
export class ProductsController {
  private readonly productsService: ProductsService;

  constructor(productsService: ProductsService) {
    this.productsService = productsService;
  }

  @Get()
  async getProducts(
    @Query('branchId') branchId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('limit') limit?: string,
    @Query('inStockOnly') inStockOnly?: string,
    @Query('q') q?: string,
    @Query('category') category?: string | string[],
    @Query('sortBy') sortByParam?: string,
  ) {
    try {
      const categories = Array.isArray(category)
        ? category.map((value) => value.trim()).filter(Boolean)
        : [];
      const singleCategory =
        typeof category === 'string' ? category.trim() || undefined : undefined;
      const sortBy =
        sortByParam === 'price-asc' || sortByParam === 'price-desc'
          ? sortByParam
          : 'popularity';

      const data = await this.productsService.queryProducts({
        q: q?.trim() || undefined,
        category: singleCategory,
        categories,
        minPrice: parseNumber(minPrice),
        maxPrice: parseNumber(maxPrice),
        branchId: parseNumber(branchId),
        inStockOnly: inStockOnly === 'true',
        limit: parseNumber(limit),
        sortBy,
      });

      return {
        data,
        meta: {
          total: data.length,
          q: q?.trim() || undefined,
          category: categories.length > 0 ? categories : singleCategory,
          branchId: parseNumber(branchId),
          inStockOnly: inStockOnly === 'true',
          sortBy,
        },
      };
    } catch (error) {
      console.error('Products API error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('search')
  async searchProducts(
    @Query('q') q?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStockOnly') inStockOnly?: string,
  ) {
    try {
      const trimmedQuery = q?.trim();
      if (!trimmedQuery) {
        throw new BadRequestException('Search query is required');
      }

      const data = await this.productsService.queryProducts({
        q: trimmedQuery,
        category: category?.trim() || undefined,
        minPrice: parseNumber(minPrice),
        maxPrice: parseNumber(maxPrice),
        branchId: parseNumber(branchId),
        inStockOnly: inStockOnly === 'true',
        limit: parseNumber(limit),
      });

      return {
        data,
        meta: {
          total: data.length,
          q: trimmedQuery,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Product search API error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('suggestions')
  async getSuggestions(@Query('q') q?: string, @Query('limit') limit?: string) {
    try {
      const trimmedQuery = q?.trim();
      const parsedLimit = Number(limit ?? '8');

      if (!trimmedQuery) {
        return { data: [] };
      }

      const data = await this.productsService.getProductSuggestions(
        trimmedQuery,
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 8,
      );

      return {
        data,
        meta: {
          total: data.length,
          q: trimmedQuery,
        },
      };
    } catch (error) {
      console.error('Product suggestions API error:', error);
      throw new InternalServerErrorException();
    }
  }
}
