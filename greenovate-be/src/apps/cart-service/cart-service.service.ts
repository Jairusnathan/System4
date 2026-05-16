import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase.service';
import { ProductsService } from '../../services/products.service';

export interface CatalogProduct {
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
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly productsService: ProductsService,
  ) {}

  private get cartAdmin() {
    const scopedClient = this.supabaseService.getClientForService('CART');
    if (scopedClient) {
      return scopedClient;
    }

    const defaultAdmin = this.supabaseService.getClient();
    if (defaultAdmin) {
      return defaultAdmin;
    }

    throw new Error(
      'Cart Supabase client is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or CART_SUPABASE_URL + CART_SUPABASE_SECRET_KEY in apps/cart-service/.env',
    );
  }

  async getCart(userId: string) {
    const { data: rows, error } = await this.cartAdmin
      .from('cart_items')
      .select('product_id, quantity, created_at')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const productIds = (rows ?? []).map((row) => String(row.product_id));
    const products = await this.fetchProductsByIds(productIds);
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    return (rows ?? []).map((row) => {
      const productId = String(row.product_id);
      const product = productsById.get(productId);

      return {
        ...(product ?? this.buildFallbackProduct(productId)),
        quantity: this.clampQuantityToStock(
          Math.max(1, Number(row.quantity ?? 1)),
          product?.stock,
        ),
      };
    });
  }

  async replaceCart(userId: string, payloadItems: CartPayloadItem[]) {
    const normalizedItems = payloadItems
      .map((item) => ({
        productId:
          typeof item?.productId === 'string' ? item.productId : item?.id,
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

    const mergedItemsById = Array.from(
      normalizedItems.reduce((map, item) => {
        const current = map.get(item.id) ?? 0;
        map.set(item.id, current + item.quantity);
        return map;
      }, new Map<string, number>()),
    );
    const products = await this.fetchProductsByIds(
      mergedItemsById.map(([productId]) => productId),
    );
    const stockByProductId = new Map(
      products.map((product) => [product.id, product.stock]),
    );
    const mergedItems = mergedItemsById
      .map(([productId, quantity]) => ({
        customer_id: userId,
        product_id: productId,
        branch_id: null,
        quantity: this.clampQuantityToStock(
          quantity,
          stockByProductId.get(productId),
        ),
      }))
      .filter((item) => item.quantity > 0);

    const { error: deleteError } = await this.cartAdmin
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    if (mergedItems.length > 0) {
      const { error: insertError } = await this.cartAdmin
        .from('cart_items')
        .insert(mergedItems);

      if (insertError) {
        throw insertError;
      }
    }
  }

  async clearCart(userId: string) {
    const { error } = await this.cartAdmin
      .from('cart_items')
      .delete()
      .eq('customer_id', userId);

    if (error) {
      throw error;
    }
  }

  private readonly fallbackImage =
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

  private buildFallbackProduct(productId: string): CatalogProduct {
    return {
      id: productId,
      name: `Product ${productId}`,
      description: 'Product details are temporarily unavailable.',
      price: 0,
      category: 'Unknown',
      image: `${this.fallbackImage}&sig=${encodeURIComponent(productId)}`,
      images: [],
      specifications: {},
      stock: 0,
    };
  }

  private async fetchProductsByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    try {
      return await this.productsService.getProductsByIds(uniqueIds);
    } catch (error) {
      console.error('Cart product lookup failed:', error);
      return [];
    }
  }

  private clampQuantityToStock(quantity: number, stock?: number) {
    const normalizedQuantity = Math.max(1, Math.trunc(quantity));

    if (typeof stock !== 'number' || !Number.isFinite(stock) || stock <= 0) {
      return normalizedQuantity;
    }

    return Math.min(normalizedQuantity, Math.max(1, Math.trunc(stock)));
  }
}
