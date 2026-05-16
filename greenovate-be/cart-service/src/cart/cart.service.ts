import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { ProductsService } from './products.service';

interface CartPayloadItem { id?: string; productId?: string; quantity?: number; }

@Injectable()
export class CartService {
  constructor(private readonly supabaseService: SupabaseService, private readonly productsService: ProductsService) {}

  private get cartAdmin() {
    const scopedClient = this.supabaseService.getClientForService('CART');
    if (scopedClient) return scopedClient;
    const defaultAdmin = this.supabaseService.getClient();
    if (defaultAdmin) return defaultAdmin;
    throw new Error('Cart Supabase client is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or CART_SUPABASE_URL + CART_SUPABASE_SECRET_KEY in .env');
  }

  async getCart(userId: string) {
    const { data: rows, error } = await this.cartAdmin.from('cart_items').select('product_id, quantity, created_at').eq('customer_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    const productIds = (rows ?? []).map((row: any) => String(row.product_id));
    const products = await this.productsService.getProductsByIds(productIds);
    const productsById = new Map(products.map((p) => [p.id, p]));
    return (rows ?? []).map((row: any) => {
      const productId = String(row.product_id);
      const product = productsById.get(productId);
      const stock = product?.stock;
      const quantity = Math.max(1, Number(row.quantity ?? 1));
      const clampedQty = (typeof stock === 'number' && Number.isFinite(stock) && stock > 0) ? Math.min(quantity, Math.max(1, Math.trunc(stock))) : quantity;
      return { ...(product ?? { id: productId, name: `Product ${productId}`, description: 'Unavailable.', price: 0, category: 'Unknown', image: '', stock: 0 }), quantity: clampedQty };
    });
  }

  async replaceCart(userId: string, payloadItems: CartPayloadItem[]) {
    const normalized = payloadItems.map((item) => ({ productId: typeof item?.productId === 'string' ? item.productId : item?.id, quantity: Number(item?.quantity ?? 0) })).filter((item): item is { productId: string; quantity: number } => typeof item.productId === 'string' && item.productId.length > 0 && Number.isFinite(item.quantity)).map((item) => ({ id: item.productId, quantity: Math.max(1, Math.trunc(item.quantity)) }));
    const merged = Array.from(normalized.reduce((map, item) => { map.set(item.id, (map.get(item.id) ?? 0) + item.quantity); return map; }, new Map<string, number>()));
    const mergedItems = merged.map(([productId, quantity]) => ({ customer_id: userId, product_id: productId, branch_id: null, quantity })).filter((item) => item.quantity > 0);
    const { error: deleteError } = await this.cartAdmin.from('cart_items').delete().eq('customer_id', userId);
    if (deleteError) throw deleteError;
    if (mergedItems.length > 0) { const { error: insertError } = await this.cartAdmin.from('cart_items').insert(mergedItems); if (insertError) throw insertError; }
  }

  async clearCart(userId: string) {
    const { error } = await this.cartAdmin.from('cart_items').delete().eq('customer_id', userId);
    if (error) throw error;
  }
}
