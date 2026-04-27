import { Injectable } from '@nestjs/common';
import { ProductsService } from './products.service';
import { SupabaseService } from './supabase.service';

@Injectable()
export class CartService {
  private readonly productsService: ProductsService;
  private readonly supabaseService: SupabaseService;

  constructor(
    productsService: ProductsService,
    supabaseService: SupabaseService,
  ) {
    this.productsService = productsService;
    this.supabaseService = supabaseService;
  }

  async getCart(userId: string) {
    const { data: rows, error } = await this.supabaseService.supabase
      .from('cart_items')
      .select('product_id, quantity, created_at')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const products = await this.productsService.getProductsByIds(
      (rows ?? []).map((row) => row.product_id),
    );
    const productsById = new Map(products.map((product) => [product.id, product]));

    return (rows ?? [])
      .map((row) => {
        const product = productsById.get(row.product_id);
        if (!product) {
          return null;
        }

        return {
          ...product,
          quantity: Math.max(1, Number(row.quantity ?? 1)),
        };
      })
      .filter(Boolean);
  }

  async replaceCart(
    userId: string,
    payloadItems: Array<{ id?: string; productId?: string; quantity?: number }>,
  ) {
    const normalizedItems = payloadItems
      .map((item) => ({
        productId: typeof item?.productId === 'string' ? item.productId : item?.id,
        quantity: Number(item?.quantity ?? 0),
      }))
      .filter(
        (item) =>
          typeof item.productId === 'string' &&
          item.productId &&
          Number.isFinite(item.quantity),
      )
      .map((item) => ({
        productId: item.productId as string,
        quantity: Math.max(1, Math.trunc(item.quantity)),
      }));

    const validProducts = await this.productsService.getProductsByIds(
      normalizedItems.map((item) => item.productId),
    );
    const validProductIds = new Set(validProducts.map((product) => product.id));
    const sanitizedItems = normalizedItems.filter((item) =>
      validProductIds.has(item.productId),
    );

    const mergedItems = Array.from(
      sanitizedItems.reduce((map, item) => {
        const current = map.get(item.productId) ?? 0;
        map.set(item.productId, current + item.quantity);
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
}
