import { Injectable } from '@nestjs/common';
import { Product } from '../types';
import { ProductsService } from './products.service';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class RecommendationsService {
  private readonly cache = new Map<string, { data: Product[]; expiresAt: number }>();

  constructor(private readonly productsService: ProductsService) {}

  async getRecommendations(productId: string, limit = 4): Promise<Product[]> {
    const cached = this.cache.get(productId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = await this.compute(productId, limit);
    this.cache.set(productId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  private async compute(productId: string, limit: number): Promise<Product[]> {
    try {
      const orderServiceUrl = process.env.OOS_CATALOG_ORDER_SERVICE_URL?.trim() || 'http://127.0.0.1:3003';
      const res = await fetch(`${orderServiceUrl}/orders/internal/co-purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, limit }),
      });

      if (!res.ok) return [];

      const payload = await res.json() as { data?: string[] };
      const topIds = payload?.data ?? [];
      if (topIds.length === 0) return [];

      return this.productsService.getProductsByIds(topIds);
    } catch (err) {
      console.error('Market basket analysis failed:', err);
      return [];
    }
  }
}
