import { Injectable } from '@nestjs/common';
import { Product } from '../types';

@Injectable()
export class ProductsService {
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    try {
      const catalogUrl = process.env.OOS_CART_CATALOG_SERVICE_URL?.trim() || 'http://127.0.0.1:3005';
      const res = await fetch(`${catalogUrl}/internal/products/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: uniqueIds }),
      });

      if (!res.ok) return [];

      const payload = await res.json() as { data?: Product[] };
      return payload?.data ?? [];
    } catch {
      return [];
    }
  }
}
