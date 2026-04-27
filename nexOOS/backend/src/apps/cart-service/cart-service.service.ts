import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase.service';
import { SERVICE_URLS } from '../../shared/http/service-urls';
import { requestDownstream } from '../../shared/http/request-downstream';

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images?: string[];
  specifications?: Record<string, string>;
  stock?: number;
}

interface CartPayloadItem {
  id?: string;
  productId?: string;
  quantity?: number;
}

interface NormalizedCartItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class CartServiceService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getCart(userId: string) {
    const { data: rows, error } = await this.supabaseService.supabase
      .from('cart_items')
      .select('product_id, quantity, created_at')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const productIds = (rows ?? []).map((row) => String(row.product_id));
    const products = await this.fetchProductsByIds(productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    return (rows ?? [])
      .map((row) => {
        const product = productsById.get(String(row.product_id));
        if (!product) {
          return null;
        }

        return {
          ...product,
          quantity: Math.max(1, Number(row.quantity ?? 1)),
        };
      })
      .filter((item): item is CatalogProduct & { quantity: number } => Boolean(item));
  }

  async replaceCart(userId: string, payloadItems: CartPayloadItem[]) {
    const normalizedItems = payloadItems
      .map((item) => ({
        productId: typeof item?.productId === 'string' ? item.productId : item?.id,
        quantity: Number(item?.quantity ?? 0),
      }))
      .filter(
        (item): item is NormalizedCartItem =>
          typeof item.productId === 'string' &&
          item.productId.length > 0 &&
          Number.isFinite(item.quantity),
      )
      .map((item) => ({
        id: item.productId,
        quantity: Math.max(1, Math.trunc(item.quantity)),
      }));

    const validProducts = await this.fetchProductsByIds(normalizedItems.map((item) => item.id));
    const validProductIds = new Set(validProducts.map((product) => product.id));
    const sanitizedItems = normalizedItems.filter((item) => validProductIds.has(item.id));

    const mergedItems = Array.from(
      sanitizedItems.reduce((map, item) => {
        const current = map.get(item.id) ?? 0;
        map.set(item.id, current + item.quantity);
        return map;
      }, new Map<string, number>()),
    ).map(([productId, quantity]) => ({
      customer_id: userId,
      product_id: productId,
      branch_id: null,
      quantity,
    }));

    const { error: deleteError } = await this.supabaseService.supabase
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    if (mergedItems.length > 0) {
      const { error: insertError } = await this.supabaseService.supabase
        .from('cart_items')
        .insert(mergedItems);

      if (insertError) {
        throw insertError;
      }
    }
  }

  async clearCart(userId: string) {
    const { error } = await this.supabaseService.supabase
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    if (error) {
      throw error;
    }
  }

  private async fetchProductsByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const result = await requestDownstream<{ data?: CatalogProduct[] }>({
      baseUrl: SERVICE_URLS.catalog,
      path: '/internal/products/by-ids',
      method: 'POST',
      body: { ids: uniqueIds },
    });

    const products = Array.isArray(result.data?.data) ? result.data.data : [];
    return products.filter((product) => uniqueIds.includes(product.id));
  }
}
