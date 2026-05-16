import { Injectable } from '@nestjs/common';
import { Product } from '../types';
import { SupabaseService } from './supabase.service';
import { ProductsService } from './products.service';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class RecommendationsService {
  private readonly cache = new Map<string, { data: Product[]; expiresAt: number }>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly productsService: ProductsService,
  ) {}

  async getRecommendations(productId: string, limit = 4): Promise<Product[]> {
    const cached = this.cache.get(productId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = await this.compute(productId, limit);
    this.cache.set(productId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  private async compute(productId: string, limit: number): Promise<Product[]> {
    try {
      const client =
        this.supabaseService.getClientForService('order') ??
        this.supabaseService.supabaseAdmin;

      // Step 1: find all orders that contain this product
      const { data: orderRows, error: err1 } = await client
        .from('online_order_items')
        .select('online_order_id')
        .eq('product_id', productId);

      if (err1 || !orderRows?.length) return [];

      const orderIds = [...new Set(orderRows.map((r: any) => r.online_order_id))];

      // Step 2: find all OTHER products in those same orders
      const { data: coItems, error: err2 } = await client
        .from('online_order_items')
        .select('product_id')
        .in('online_order_id', orderIds)
        .neq('product_id', productId);

      if (err2 || !coItems?.length) return [];

      // Step 3: count frequency of each co-purchased product
      const freq = new Map<string, number>();
      for (const row of coItems as any[]) {
        const id = String(row.product_id);
        freq.set(id, (freq.get(id) ?? 0) + 1);
      }

      // Step 4: return top N by frequency with full product details
      const topIds = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      return this.productsService.getProductsByIds(topIds);
    } catch (err) {
      console.error('Market basket analysis failed:', err);
      return [];
    }
  }
}
