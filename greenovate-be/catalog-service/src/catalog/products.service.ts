import { Injectable } from '@nestjs/common';
import { Product } from '../types';
import { SupabaseService } from './supabase.service';

export interface ProductQueryOptions {
  q?: string; category?: string; categories?: string[];
  minPrice?: number; maxPrice?: number; branchId?: number;
  inStockOnly?: boolean; limit?: number;
  sortBy?: 'popularity' | 'price-asc' | 'price-desc';
}

type ProductRow = { id: number | string; name: string | null; price: number | string | null; stock: number | string | null; category: string | null; low_stock_threshold?: number | string | null; };
type ProductSalesRow = { product_id: number | string | null; quantity: number | string | null; };

const PRODUCT_CACHE_TTL_MS = Number(process.env.PRODUCT_CACHE_TTL_MS || 30_000);

@Injectable()
export class ProductsService {
  private catalogCache: { expiresAt: number; products: Product[] } | null = null;
  private catalogFetchPromise: Promise<Product[]> | null = null;
  private readonly fallbackProductImage = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800&h=800';

  constructor(private readonly supabaseService: SupabaseService) {}

  async queryProducts(options: ProductQueryOptions = {}) {
    const catalogProducts = await this.fetchCatalogProducts();
    const normalizedCategory = options.category?.trim();
    const normalizedCategories = (options.categories ?? []).map((c) => c.trim().toLowerCase()).filter((c) => c && c !== 'all');
    let filtered = catalogProducts.filter((p) => {
      if (normalizedCategories.length > 0 && !normalizedCategories.includes(p.category.toLowerCase())) return false;
      if (normalizedCategory && normalizedCategory !== 'All' && p.category.toLowerCase() !== normalizedCategory.toLowerCase()) return false;
      if (typeof options.minPrice === 'number' && p.price < options.minPrice) return false;
      if (typeof options.maxPrice === 'number' && p.price > options.maxPrice) return false;
      return true;
    });
    if (options.inStockOnly) filtered = filtered.filter((p) => (p.stock ?? 0) > 0);
    const searched = this.sortProducts(filtered, options.q, options.sortBy);
    if (typeof options.limit === 'number' && options.limit > 0) return searched.slice(0, options.limit);
    return searched;
  }

  async getProductsByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return [];
    const products = await this.fetchCatalogProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    return uniqueIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }

  async updateStock(productId: string, stock: number) {
    const numericId = Number(productId);
    if (!Number.isFinite(numericId)) throw new Error(`Invalid product id: ${productId}`);
    const { error } = await this.supabaseService.secondSupabaseAdmin.from('products').update({ stock: Math.max(0, Math.trunc(stock)) }).eq('id', numericId);
    if (error) throw error;
    this.catalogCache = null;
  }

  private async fetchCatalogProducts(): Promise<Product[]> {
    const now = Date.now();
    if (this.catalogCache && this.catalogCache.expiresAt > now) return this.catalogCache.products;
    if (this.catalogFetchPromise) return this.catalogFetchPromise;
    this.catalogFetchPromise = this.loadCatalogProducts();
    try {
      const products = await this.catalogFetchPromise;
      this.catalogCache = { products, expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS };
      return products;
    } finally { this.catalogFetchPromise = null; }
  }

  private async loadCatalogProducts(): Promise<Product[]> {
    const { data, error } = await this.supabaseService.secondSupabase
      .from('products')
      .select('id, name, price, stock, category, low_stock_threshold')
      .order('id', { ascending: true });

    if (error) { console.error('Product fetch failed:', error); return []; }

    const productRows = (data ?? []) as ProductRow[];
    const soldByProductId = await this.loadSoldCounts(productRows.map((row) => String(row.id)));

    return productRows.map((row) => this.mapProduct(row, soldByProductId.get(String(row.id)) ?? 0));
  }

  private async loadSoldCounts(productIds: string[]): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    try {
      const orderClient = this.supabaseService.getClientForService('order') ?? this.supabaseService.supabaseAdmin;
      const { data, error } = await orderClient
        .from('online_order_items')
        .select('product_id, quantity')
        .in('product_id', uniqueIds);

      if (error) { console.error('Sold-count fetch failed:', error); return new Map(); }

      const soldByProductId = new Map<string, number>();
      for (const row of (data ?? []) as ProductSalesRow[]) {
        const productId = String(row.product_id ?? '').trim();
        if (!productId) continue;
        soldByProductId.set(productId, (soldByProductId.get(productId) ?? 0) + Number(row.quantity ?? 0));
      }
      return soldByProductId;
    } catch (err) {
      console.error('Sold-count fetch skipped:', err);
      return new Map();
    }
  }

  private mapProduct(row: ProductRow, sold = 0): Product {
    const id = String(row.id);
    const category = row.category?.trim() || 'Uncategorized';
    const stock = Number(row.stock) || 0;
    const threshold = Number(row.low_stock_threshold) || 0;
    let description = `${category} item currently unavailable.`;
    if (threshold > 0 && stock > 0 && stock <= threshold) description = `Limited stocks available in ${category}.`;
    else if (stock > 0) description = `${category} item with ${stock} units currently available.`;

    return {
      id, name: row.name?.trim() || `Product ${id}`, description,
      price: Number(row.price) || 0, category,
      image: `${this.fallbackProductImage}&sig=${encodeURIComponent(id)}`,
      images: [], specifications: { Category: category, Stock: String(stock) },
      stock, sold: Math.max(0, Math.trunc(sold)),
    };
  }

  private sortProducts(products: Product[], query?: string, sortBy: ProductQueryOptions['sortBy'] = 'popularity') {
    if (!query?.trim()) {
      if (sortBy === 'price-asc') return [...products].sort((a, b) => a.price - b.price);
      if (sortBy === 'price-desc') return [...products].sort((a, b) => b.price - a.price);
      if (sortBy === 'popularity') return [...products].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0) || a.name.localeCompare(b.name));
      return [...products].sort((a, b) => a.name.localeCompare(b.name));
    }
    const q = query.trim().toLowerCase();
    return [...products]
      .map((p) => ({ p, score: p.name.toLowerCase() === q ? 1200 : p.name.toLowerCase().startsWith(q) ? 900 : p.name.toLowerCase().includes(q) ? 700 : p.category.toLowerCase().includes(q) ? 200 : 0 }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
      .map(({ p }) => p);
  }
}
