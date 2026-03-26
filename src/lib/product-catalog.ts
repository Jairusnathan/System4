import { products as productData } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

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

export interface ProductSuggestion {
  id: string;
  name: string;
  category: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

const tokenize = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .filter(Boolean);

const scoreProduct = (product: Product, query: string) => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return 0;
  }

  const tokens = tokenize(normalizedQuery);
  const name = normalize(product.name);
  const description = normalize(product.description);

  let score = 0;

  if (name === normalizedQuery) score += 1200;
  if (name.startsWith(normalizedQuery)) score += 900;
  if (name.includes(normalizedQuery)) score += 700;
  if (description.includes(normalizedQuery)) score += 180;

  const nameTokenMatches = tokens.filter((token) => name.includes(token)).length;
  const descriptionTokenMatches = tokens.filter((token) =>
    description.includes(token)
  ).length;

  if (nameTokenMatches === tokens.length) score += 450;
  score += nameTokenMatches * 90;
  score += descriptionTokenMatches * 20;

  return score;
};

const sortProducts = (
  products: Product[],
  query?: string,
  sortBy: ProductQueryOptions['sortBy'] = 'popularity'
) => {
  if (sortBy === 'price-asc') {
    return [...products].sort((a, b) => a.price - b.price);
  }

  if (sortBy === 'price-desc') {
    return [...products].sort((a, b) => b.price - a.price);
  }

  const normalizedQuery = query?.trim();

  if (!normalizedQuery) {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }

  return [...products]
    .map((product) => ({
      product,
      score: scoreProduct(product, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.product.name.localeCompare(b.product.name);
    })
    .map(({ product }) => product);
};

const getStockByProduct = async (branchId?: number) => {
  let query = supabase.from('branch_inventory').select('product_id, stock');

  if (typeof branchId === 'number' && !Number.isNaN(branchId)) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Inventory lookup failed:', error);
    return null;
  }

  const stockByProduct = new Map<string, number>();

  for (const row of data ?? []) {
    stockByProduct.set(
      row.product_id,
      (stockByProduct.get(row.product_id) ?? 0) + Number(row.stock ?? 0)
    );
  }

  return stockByProduct;
};

export async function queryProducts(options: ProductQueryOptions = {}) {
  const normalizedCategory = options.category?.trim();
  const normalizedCategories = (options.categories ?? [])
    .map((category) => category.trim().toLowerCase())
    .filter((category) => category && category !== 'all');
  let filtered = productData.filter((product) => {
    if (normalizedCategories.length > 0) {
      if (!normalizedCategories.includes(product.category.toLowerCase())) {
        return false;
      }
    }

    if (normalizedCategory && normalizedCategory !== 'All') {
      if (product.category.toLowerCase() !== normalizedCategory.toLowerCase()) {
        return false;
      }
    }

    if (typeof options.minPrice === 'number' && product.price < options.minPrice) {
      return false;
    }

    if (typeof options.maxPrice === 'number' && product.price > options.maxPrice) {
      return false;
    }

    return true;
  });

  if (typeof options.branchId === 'number' || options.inStockOnly) {
    const stockByProduct = await getStockByProduct(options.branchId);

    if (stockByProduct && typeof options.branchId === 'number') {
      filtered = filtered.filter(
        (product) => (stockByProduct.get(product.id) ?? 0) > 0
      );
    } else if (stockByProduct && options.inStockOnly) {
      filtered = filtered.filter(
        (product) => (stockByProduct.get(product.id) ?? 0) > 0
      );
    }
  }

  const searched = sortProducts(filtered, options.q, options.sortBy);

  if (typeof options.limit === 'number' && options.limit > 0) {
    return searched.slice(0, options.limit);
  }

  return searched;
}

export async function getProductSuggestions(
  query: string,
  limit = 8
): Promise<ProductSuggestion[]> {
  if (!query.trim()) {
    return [];
  }

  const matches = await queryProducts({ q: query, limit });

  return matches.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
  }));
}
