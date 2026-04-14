import { Injectable } from '@nestjs/common';
import { Product } from '../types';
import { SupabaseService } from './supabase.service';

export interface ProductQueryOptions {
  q?: string;
  category?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  branchId?: number;
  inStockOnly?: boolean;
  limit?: number;
  sortBy?: 'popularity' | 'price-asc' | 'price-desc';
}

type SecondDatabaseProductRow = {
  id: number | string;
  name: string | null;
  price: number | string | null;
  stock: number | string | null;
  category: string | null;
  low_stock_threshold?: number | string | null;
};

@Injectable()
export class ProductsService {
  private readonly supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  private readonly fallbackProductImage =
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

  async queryProducts(options: ProductQueryOptions = {}) {
    const catalogProducts = await this.fetchCatalogProducts();
    const normalizedCategory = options.category?.trim();
    const normalizedCategories = (options.categories ?? [])
      .map((category) => category.trim().toLowerCase())
      .filter((category) => category && category !== 'all');

    let filtered = catalogProducts.filter((product) => {
      if (
        normalizedCategories.length > 0 &&
        !normalizedCategories.includes(product.category.toLowerCase())
      ) {
        return false;
      }

      if (
        normalizedCategory &&
        normalizedCategory !== 'All' &&
        product.category.toLowerCase() !== normalizedCategory.toLowerCase()
      ) {
        return false;
      }

      if (
        typeof options.minPrice === 'number' &&
        product.price < options.minPrice
      ) {
        return false;
      }

      if (
        typeof options.maxPrice === 'number' &&
        product.price > options.maxPrice
      ) {
        return false;
      }

      return true;
    });

    if (options.inStockOnly) {
      filtered = filtered.filter((product) => (product.stock ?? 0) > 0);
    }

    const searched = this.sortProducts(filtered, options.q, options.sortBy);

    if (typeof options.limit === 'number' && options.limit > 0) {
      return searched.slice(0, options.limit);
    }

    return searched;
  }

  async getProductSuggestions(query: string, limit = 8) {
    if (!query.trim()) {
      return [];
    }

    const matches = await this.queryProducts({ q: query, limit });
    return matches.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
    }));
  }

  async getProductsByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const products = await this.fetchCatalogProducts();
    const byId = new Map(products.map((product) => [product.id, product]));

    return uniqueIds
      .map((id) => byId.get(id))
      .filter((product): product is Product => Boolean(product));
  }

  async updateStock(productId: string, stock: number) {
    const numericId = Number(productId);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid product id: ${productId}`);
    }

    const { error } = await this.supabaseService.secondSupabaseAdmin
      .from('products')
      .update({ stock: Math.max(0, Math.trunc(stock)) })
      .eq('id', numericId);

    if (error) {
      throw error;
    }
  }

  private async fetchCatalogProducts(): Promise<Product[]> {
    const { data, error } = await this.supabaseService.secondSupabase
      .from('products')
      .select('id, name, price, stock, category, low_stock_threshold')
      .order('id', { ascending: true });

    if (error) {
      console.error('Second database product fetch failed:', error);
      return [];
    }

    return (data ?? []).map((row) =>
      this.mapSecondDatabaseProduct(row as SecondDatabaseProductRow),
    );
  }

  private mapSecondDatabaseProduct(row: SecondDatabaseProductRow): Product {
    const id = String(row.id);
    const category = row.category?.trim() || 'Uncategorized';

    return {
      id,
      name: row.name?.trim() || `Product ${id}`,
      description: this.buildProductDescription(row),
      price: this.toNumber(row.price),
      category,
      image: `${this.fallbackProductImage}&sig=${encodeURIComponent(id)}`,
      images: [],
      specifications: {
        Category: category,
        Stock: String(this.toNumber(row.stock)),
      },
      stock: this.toNumber(row.stock),
    };
  }

  private buildProductDescription(row: SecondDatabaseProductRow) {
    const stock = this.toNumber(row.stock);
    const threshold = this.toNumber(row.low_stock_threshold);

    if (threshold > 0 && stock > 0 && stock <= threshold) {
      return `Limited stocks available in ${row.category ?? 'this category'}.`;
    }

    if (stock > 0) {
      return `${row.category ?? 'Product'} item with ${stock} units currently available.`;
    }

    return `${row.category ?? 'Product'} item currently unavailable.`;
  }

  private toNumber(value: number | string | null | undefined, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private normalize(value: string) {
    return value.trim().toLowerCase();
  }

  private tokenize(value: string) {
    return this.normalize(value).split(/\s+/).filter(Boolean);
  }

  private scoreProduct(product: Product, query: string) {
    const normalizedQuery = this.normalize(query);
    if (!normalizedQuery) {
      return 0;
    }

    const tokens = this.tokenize(normalizedQuery);
    const name = this.normalize(product.name);
    const description = this.normalize(product.description);

    let score = 0;
    if (name === normalizedQuery) score += 1200;
    if (name.startsWith(normalizedQuery)) score += 900;
    if (name.includes(normalizedQuery)) score += 700;
    if (description.includes(normalizedQuery)) score += 180;

    const nameTokenMatches = tokens.filter((token) => name.includes(token)).length;
    const descriptionTokenMatches = tokens.filter((token) =>
      description.includes(token),
    ).length;

    if (nameTokenMatches === tokens.length) score += 450;
    score += nameTokenMatches * 90;
    score += descriptionTokenMatches * 20;

    return score;
  }

  private sortProducts(
    products: Product[],
    query?: string,
    sortBy: ProductQueryOptions['sortBy'] = 'popularity',
  ) {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      if (sortBy === 'price-asc') {
        return [...products].sort((a, b) => a.price - b.price);
      }

      if (sortBy === 'price-desc') {
        return [...products].sort((a, b) => b.price - a.price);
      }

      return [...products].sort((a, b) => a.name.localeCompare(b.name));
    }

    const matchedProducts = [...products]
      .map((product) => ({
        product,
        score: this.scoreProduct(product, normalizedQuery),
      }))
      .filter(({ score }) => score > 0);

    if (sortBy === 'price-asc') {
      return matchedProducts
        .sort((a, b) => {
          if (a.product.price !== b.product.price) {
            return a.product.price - b.product.price;
          }

          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return a.product.name.localeCompare(b.product.name);
        })
        .map(({ product }) => product);
    }

    if (sortBy === 'price-desc') {
      return matchedProducts
        .sort((a, b) => {
          if (b.product.price !== a.product.price) {
            return b.product.price - a.product.price;
          }

          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return a.product.name.localeCompare(b.product.name);
        })
        .map(({ product }) => product);
    }

    return matchedProducts
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.product.name.localeCompare(b.product.name);
      })
      .map(({ product }) => product);
  }
}
